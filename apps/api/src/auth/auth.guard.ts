import { Injectable, Inject, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './decorators/public.decorator.js';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Inject(Reflector) private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // WebSocket message handlers: passport-jwt expects an HTTP request object,
    // but a WS execution context carries the Socket (getRequest() returns
    // args[0], and Socket has no .headers) — running passport here throws and
    // rejects every message. Connection-level authentication already ran in
    // the gateway's handleConnection (JWT verify + active user + unrevoked
    // session); the handler boundary still requires that authenticated user
    // to be attached to the socket. This is NOT a bypass: sockets that failed
    // connection auth were disconnected and carry no user.
    if (context.getType() === 'ws') {
      const client = context.switchToWs().getClient<{ data?: { user?: unknown } }>();
      return !!client?.data?.['user'];
    }

    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  handleRequest<TUser = unknown>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
