import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ExtrasService, type ExtraCatalogView } from './extras.service.js';
import { ExtrasCatalogQueryDto } from './dto/extras-catalog-query.dto.js';
import { ExtrasQuoteDto } from './dto/extras-quote.dto.js';
import { JwtAuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { Public } from '../auth/decorators/public.decorator.js';

/**
 * Customer extras catalog. Read-only and public like flights/aircraft
 * reference data: prices and eligibility are server-computed from the DB, and
 * the actual purchase always goes through booking creation (JWT + ownership).
 */
@Controller('extras')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ExtrasController {
  constructor(@Inject(ExtrasService) private readonly extras: ExtrasService) {}

  @Get('catalog')
  @Public()
  catalog(@Query() query: ExtrasCatalogQueryDto): Promise<ExtraCatalogView[]> {
    return this.extras.catalog(query);
  }

  @Post('quote')
  @Public()
  @HttpCode(HttpStatus.OK)
  quote(@Body() dto: ExtrasQuoteDto) {
    return this.extras.quote(dto);
  }
}
