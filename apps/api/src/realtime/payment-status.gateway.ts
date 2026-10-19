import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayInit,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  JwtStrategy,
  type JwtPayload,
} from '../auth/strategies/jwt.strategy.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { RealtimeEventsService, bookingRoom } from './realtime-events.service.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const extractToken = (client: Socket): string | null => {
  const auth = client.handshake.auth as Record<string, unknown> | undefined;
  if (typeof auth?.['token'] === 'string' && auth['token'].length > 0) {
    return auth['token'];
  }
  const header = client.handshake.headers['authorization'];
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }
  return null;
};

/**
 * Customer-facing payment status push (SRS realtime recovery): clients
 * subscribe to their own booking and receive minimal status events after the
 * authoritative database state has committed.
 *
 * Authentication reuses the exact HTTP trust rules (JwtStrategy.validate:
 * access-token type, active user, unrevoked unexpired session). Authorization
 * is per-subscription: a client joins a booking room only when the persisted
 * booking belongs to the authenticated user — a client-supplied bookingId is
 * never trusted on its own, and unknown/foreign ids get the same refusal.
 */
@WebSocketGateway({
  path: '/api/socket.io',
  cors: {
    origin: process.env['WEB_ORIGIN'] ?? 'http://localhost:4200',
    credentials: true,
  },
})
export class PaymentStatusGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(PaymentStatusGateway.name);

  @WebSocketServer() private server!: Server;

  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(JwtStrategy) private readonly jwtStrategy: JwtStrategy,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeEventsService)
    private readonly events: RealtimeEventsService,
  ) {}

  afterInit(server: Server): void {
    this.events.attach(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = extractToken(client);
      if (!token) {
        throw new Error('missing access token');
      }
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      client.data['user'] = await this.jwtStrategy.validate(payload);
    } catch {
      this.logger.debug(`WS auth failed — disconnecting client ${client.id}`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('booking.subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<{ ok: boolean }> {
    const user = client.data['user'] as AuthUser | undefined;
    const bookingId = (body as { bookingId?: unknown } | null)?.bookingId;
    if (!user || typeof bookingId !== 'string' || !UUID_RE.test(bookingId)) {
      return { ok: false };
    }
    const owned = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId: user.userId },
      select: { id: true },
    });
    if (!owned) {
      return { ok: false };
    }
    await client.join(bookingRoom(bookingId));
    return { ok: true };
  }

  @SubscribeMessage('booking.unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ): Promise<{ ok: boolean }> {
    const bookingId = (body as { bookingId?: unknown } | null)?.bookingId;
    if (typeof bookingId === 'string' && UUID_RE.test(bookingId)) {
      await client.leave(bookingRoom(bookingId));
    }
    return { ok: true };
  }
}
