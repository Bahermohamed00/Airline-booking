import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BaggageService, type TrackedBaggageView } from './baggage.service.js';
import { TrackBaggageParamsDto } from './dto/track-baggage.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Public } from '../auth/decorators/public.decorator.js';

/**
 * Public baggage tracking by tag number (like real airline trackers, the tag
 * printed on the receipt acts as the capability token). Read-only, rate
 * limited against enumeration, and the response never exposes passenger or
 * booking identity — only the bag's own status and journey events.
 */
@Controller('baggage')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class BaggageTrackingController {
  constructor(@Inject(BaggageService) private readonly baggageService: BaggageService) {}

  @Get('track/:tagNumber')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  track(@Param() params: TrackBaggageParamsDto): Promise<TrackedBaggageView> {
    return this.baggageService.trackByTag(params.tagNumber);
  }
}
