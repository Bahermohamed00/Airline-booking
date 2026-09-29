import { Controller, Get, Inject, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { OffersService, type OfferPublicView } from './offers.service.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('offers')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class OffersController {
  constructor(@Inject(OffersService) private readonly offers: OffersService) {}

  @Get()
  @Public()
  findAll(): Promise<OfferPublicView[]> {
    return this.offers.findPublic();
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OfferPublicView> {
    return this.offers.findPublicOne(id);
  }
}
