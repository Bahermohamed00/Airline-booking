import { Controller, Get, Inject, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OffersService } from './offers.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { OffersQueryDto } from './dto/offers-query.dto.js';

@Public()
@Controller('offers')
export class OffersController {
  constructor(@Inject(OffersService) private readonly offersService: OffersService) {}

  @Get()
  @Throttle({ 'public-search': { limit: 30, ttl: 60 * 1000 } })
  listActive(@Query() query: OffersQueryDto) {
    return this.offersService.listActive(query);
  }
}
