import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerStorage, InjectThrottlerOptions, InjectThrottlerStorage, type ThrottlerLimitDetail, type ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service.js';

/** ThrottlerGuard that also writes one AUTH_RATE_LIMITED audit row per throttled request. */
@Injectable()
export class AuditThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    @Inject(Reflector) reflector: Reflector,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Rate limiting is HTTP-scoped. In WS/RPC contexts the base guard treats the
   * socket as the request and the message payload as the response — calling
   * res.header(...) on a plain object throws and would silently reject every
   * WebSocket message. Realtime abuse control belongs to connection auth and
   * per-subscription authorization, not HTTP rate limits.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    return super.canActivate(context);
  }

  protected async throwThrottlingException(context: ExecutionContext, throttlerLimitDetail: ThrottlerLimitDetail): Promise<void> {
    const req = context.switchToHttp().getRequest<Request>();
    // Best-effort: throttling must never depend on audit availability.
    await this.auditService
      .log({
        actorType: 'Guest',
        action: 'AUTH_RATE_LIMITED',
        targetType: 'Endpoint',
        targetId: `${req.method} ${req.path}`,
        ipAddress: req.ip,
      })
      .catch(() => undefined);
    return super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
