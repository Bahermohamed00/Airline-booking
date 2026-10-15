import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Route } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { DashboardEventsService } from '../dashboard-events/dashboard-events.service.js';
import { changedFieldsOf } from '../audit/changed-fields.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { toAirportView, type AirportView } from '../airports/airport-view.js';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { UpdateRouteDto } from './dto/update-route.dto.js';

export type RouteView = Route & { originAirport: AirportView; destinationAirport: AirportView };

const AIRPORT_INCLUDE = { originAirport: true, destinationAirport: true } as const;

type RouteWithAirports = Route & { originAirport: Parameters<typeof toAirportView>[0]; destinationAirport: Parameters<typeof toAirportView>[0] };

@Injectable()
export class RoutesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(DashboardEventsService) private readonly dashboardEvents: DashboardEventsService,
  ) {}

  async findAll(): Promise<RouteView[]> {
    const routes = await this.prisma.route.findMany({
      include: AIRPORT_INCLUDE,
      orderBy: [{ originAirport: { iataCode: 'asc' } }, { destinationAirport: { iataCode: 'asc' } }],
    });
    return routes.map((r) => this.toView(r));
  }

  async findOne(id: string): Promise<RouteView> {
    const route = await this.prisma.route.findUnique({ where: { id }, include: AIRPORT_INCLUDE });
    if (!route) {
      throw new NotFoundException('Route not found');
    }
    return this.toView(route);
  }

  async create(dto: CreateRouteDto, actor: AuthUser): Promise<RouteView> {
    await this.assertPairValid(dto.originAirportId, dto.destinationAirportId);
    let route: RouteWithAirports;
    try {
      route = await this.prisma.route.create({
        data: {
          originAirportId: dto.originAirportId,
          destinationAirportId: dto.destinationAirportId,
          distanceKm: dto.distanceKm,
          durationMinutes: dto.durationMinutes,
        },
        include: AIRPORT_INCLUDE,
      });
    } catch (error) {
      this.rethrowUnique(error);
      throw error;
    }
    await this.auditService.log({
      actorId: actor.userId,
      actorType: 'Staff',
      action: 'ROUTE_CREATED',
      targetType: 'Route',
      targetId: route.id,
    });
    await this.dashboardEvents.publish('route.created');
    return this.toView(route);
  }

  async update(id: string, dto: UpdateRouteDto, actor: AuthUser): Promise<RouteView> {
    const existing = await this.prisma.route.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Route not found');
    }

    const originAirportId = dto.originAirportId ?? existing.originAirportId;
    const destinationAirportId = dto.destinationAirportId ?? existing.destinationAirportId;
    if (originAirportId !== existing.originAirportId || destinationAirportId !== existing.destinationAirportId) {
      await this.assertPairValid(originAirportId, destinationAirportId, id);
    }

    let route: RouteWithAirports;
    try {
      route = await this.prisma.route.update({
        where: { id },
        data: {
          originAirportId,
          destinationAirportId,
          distanceKm: dto.distanceKm,
          durationMinutes: dto.durationMinutes,
          status: dto.status,
        },
        include: AIRPORT_INCLUDE,
      });
    } catch (error) {
      this.rethrowUnique(error);
      throw error;
    }
    await this.auditService.log({
      actorId: actor.userId,
      actorType: 'Staff',
      action: 'ROUTE_UPDATED',
      targetType: 'Route',
      targetId: route.id,
      metadata: { changedFields: changedFieldsOf(dto) },
    });
    await this.dashboardEvents.publish('route.updated');
    return this.toView(route);
  }

  /** Existence, inequality and pair-uniqueness of the two referenced airports. */
  private async assertPairValid(originAirportId: string, destinationAirportId: string, excludeRouteId?: string): Promise<void> {
    if (originAirportId === destinationAirportId) {
      throw new BadRequestException('Origin and destination airports must differ');
    }
    const airports = await this.prisma.airport.count({ where: { id: { in: [originAirportId, destinationAirportId] } } });
    if (airports !== 2) {
      throw new BadRequestException('Origin or destination airport does not exist');
    }
    const duplicate = await this.prisma.route.findFirst({
      where: {
        originAirportId,
        destinationAirportId,
        ...(excludeRouteId ? { id: { not: excludeRouteId } } : {}),
      },
    });
    if (duplicate) {
      throw new ConflictException('A route already exists for this airport pair');
    }
  }

  private rethrowUnique(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('A route already exists for this airport pair');
    }
  }

  private toView(route: RouteWithAirports): RouteView {
    return {
      ...route,
      originAirport: toAirportView(route.originAirport),
      destinationAirport: toAirportView(route.destinationAirport),
    };
  }
}
