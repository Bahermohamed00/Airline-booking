import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Offer } from '@prisma/client';
import { OffersService } from './offers.service.js';
import { CreateOfferDto } from './dto/create-offer.dto.js';
import { UpdateOfferDto } from './dto/update-offer.dto.js';
import { AdminOfferQueryDto } from './dto/admin-offer-query.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser, type AuthUser } from '../auth/decorators/current-user.decorator.js';

@Controller('admin/offers')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AdminOffersController {
  constructor(@Inject(OffersService) private readonly offers: OffersService) {}

  @Get()
  @Permissions({ resource: 'offers', action: 'read' })
  findAll(@Query() query: AdminOfferQueryDto): Promise<Offer[]> {
    return this.offers.findAllAdmin(query);
  }

  @Get(':id')
  @Permissions({ resource: 'offers', action: 'read' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Offer> {
    return this.offers.findOneAdmin(id);
  }

  @Post()
  @Permissions({ resource: 'offers', action: 'manage' })
  create(@Body() dto: CreateOfferDto, @CurrentUser() actor: AuthUser): Promise<Offer> {
    return this.offers.create(dto, actor);
  }

  @Patch(':id')
  @Permissions({ resource: 'offers', action: 'manage' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOfferDto, @CurrentUser() actor: AuthUser): Promise<Offer> {
    return this.offers.update(id, dto, actor);
  }

  /** Lifecycle-based deletion: deactivates the offer (INACTIVE) instead of hard-deleting. */
  @Delete(':id')
  @Permissions({ resource: 'offers', action: 'manage' })
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser): Promise<Offer> {
    return this.offers.deactivate(id, actor);
  }
}
