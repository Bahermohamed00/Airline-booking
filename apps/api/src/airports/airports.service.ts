import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { Airport, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { DashboardEventsService } from '../dashboard-events/dashboard-events.service.js';
import { changedFieldsOf } from '../audit/changed-fields.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { CreateAirportDto } from './dto/create-airport.dto.js';
import { UpdateAirportDto } from './dto/update-airport.dto.js';
import { toAirportView, type AirportView } from './airport-view.js';

@Injectable()
export class AirportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(DashboardEventsService) private readonly dashboardEvents: DashboardEventsService,
  ) {}

  async findAll(): Promise<AirportView[]> {
    const airports = await this.prisma.airport.findMany({ orderBy: { iataCode: 'asc' } });
    return airports.map((a) => this.toView(a));
  }

  async findOne(id: string): Promise<AirportView> {
    const airport = await this.prisma.airport.findUnique({ where: { id } });
    if (!airport) {
      throw new NotFoundException('Airport not found');
    }
    return this.toView(airport);
  }

  async create(dto: CreateAirportDto, actor: AuthUser): Promise<AirportView> {
    await this.assertIataAvailable(dto.iataCode);
    let airport: Airport;
    try {
      airport = await this.prisma.airport.create({ data: dto });
    } catch (error) {
      this.rethrowUnique(error, `An airport with IATA code ${dto.iataCode} already exists`);
      throw error;
    }
    await this.auditService.log({
      actorId: actor.userId,
      actorType: 'Staff',
      action: 'AIRPORT_CREATED',
      targetType: 'Airport',
      targetId: airport.id,
      metadata: { iataCode: airport.iataCode },
    });
    await this.dashboardEvents.publish('airport.created');
    return this.toView(airport);
  }

  async update(id: string, dto: UpdateAirportDto, actor: AuthUser): Promise<AirportView> {
    const existing = await this.prisma.airport.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Airport not found');
    }
    if (dto.iataCode && dto.iataCode !== existing.iataCode) {
      await this.assertIataAvailable(dto.iataCode);
    }
    let airport: Airport;
    try {
      airport = await this.prisma.airport.update({ where: { id }, data: dto });
    } catch (error) {
      this.rethrowUnique(error, `An airport with IATA code ${dto.iataCode} already exists`);
      throw error;
    }
    await this.auditService.log({
      actorId: actor.userId,
      actorType: 'Staff',
      action: 'AIRPORT_UPDATED',
      targetType: 'Airport',
      targetId: airport.id,
      metadata: { changedFields: changedFieldsOf(dto) },
    });
    await this.dashboardEvents.publish('airport.updated');
    return this.toView(airport);
  }

  private async assertIataAvailable(iataCode: string): Promise<void> {
    const taken = await this.prisma.airport.findUnique({ where: { iataCode } });
    if (taken) {
      throw new ConflictException(`An airport with IATA code ${iataCode} already exists`);
    }
  }

  private rethrowUnique(error: unknown, message: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }
  }

  private toView(airport: Airport): AirportView {
    return toAirportView(airport);
  }
}
