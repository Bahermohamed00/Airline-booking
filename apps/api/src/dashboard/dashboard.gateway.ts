import { Inject, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { JwtStrategy } from '../auth/strategies/jwt.strategy.js';
import { DashboardEventsService } from '../dashboard-events/dashboard-events.service.js';

/**
 * Dashboard real-time channel. Emits `dashboard.invalidate` — a pure
 * change notification (event type + timestamp), never statistics; clients
 * re-fetch authoritative numbers via GET /api/admin/dashboard.
 *
 * Auth: the handshake carries the same JWT access token as HTTP (`auth.token`
 * or the Authorization header). The token goes through the exact same
 * JwtService verification + JwtStrategy.validate pipeline as REST (session
 * validity, active user, DB-resolved permissions). Without `dashboard:read`
 * (or the super_admin bypass) the socket is disconnected immediately.
 */
@WebSocketGateway({
  namespace: '/dashboard',
  cors: {
    origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:4200',
    credentials: true,
  },
})
export class DashboardGateway implements OnGatewayConnection, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DashboardGateway.name);
  private unsubscribe?: () => void;

  @WebSocketServer()
  private server!: Server;

  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(JwtStrategy) private readonly jwtStrategy: JwtStrategy,
    @Inject(DashboardEventsService) private readonly events: DashboardEventsService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.events.subscribe((event) => {
      this.server?.emit('dashboard.invalidate', { type: event.type, at: event.at });
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = this.extractToken(socket);
      if (!token) throw new Error('missing token');
      const payload = await this.jwt.verifyAsync(token);
      const user = await this.jwtStrategy.validate(payload as never);
      if (!user.permissions.includes('dashboard:read') && !user.permissions.includes('super_admin')) {
        throw new Error('dashboard:read required');
      }
      socket.data['user'] = { userId: user.userId, roles: user.roles };
      this.logger.debug(`dashboard client connected: ${user.userId}`);
    } catch {
      socket.disconnect(true);
    }
  }

  private extractToken(socket: Socket): string | null {
    const authToken = socket.handshake.auth?.['token'];
    if (typeof authToken === 'string' && authToken) return authToken;
    const header = socket.handshake.headers['authorization'];
    if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
    return null;
  }
}
