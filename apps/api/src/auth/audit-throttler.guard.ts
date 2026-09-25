import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerGuard, ThrottlerStorage, InjectThrottlerOptions, InjectThrottlerStorage, type ThrottlerLimitDetail, type ThrottlerModuleOptions } from '@nestjs/throttler';
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
