import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Route } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { toAirportView, type AirportView } from '../airports/airports.service.js';
import { CreateRouteDto } from './dto/create-route.dto.js';
import { UpdateRouteDto } from './dto/update-route.dto.js';

export type RouteView = Route & { originAirport: AirportView; destinationAirport: AirportView };

const AIRPORT_INCLUDE = { originAirport: true, destinationAirport: true } as const;

type RouteWithAirports = Route & { originAirport: Parameters<typeof toAirportView>[0]; destinationAirport: Parameters<typeof toAirportView>[0] };

@Injectable()
export class RoutesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

  async create(dto: CreateRouteDto): Promise<RouteView> {
    await this.assertPairValid(dto.originAirportId, dto.destinationAirportId);
    try {
      const route = await this.prisma.route.create({
        data: {
          originAirportId: dto.originAirportId,
          destinationAirportId: dto.destinationAirportId,
          distanceKm: dto.distanceKm,
          durationMinutes: dto.durationMinutes,
        },
        include: AIRPORT_INCLUDE,
      });
      return this.toView(route);
    } catch (error) {
      this.rethrowUnique(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateRouteDto): Promise<RouteView> {
    const existing = await this.prisma.route.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Route not found');
    }

    const originAirportId = dto.originAirportId ?? existing.originAirportId;
    const destinationAirportId = dto.destinationAirportId ?? existing.destinationAirportId;
    if (originAirportId !== existing.originAirportId || destinationAirportId !== existing.destinationAirportId) {
      await this.assertPairValid(originAirportId, destinationAirportId, id);
    }

    try {
      const route = await this.prisma.route.update({
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
      return this.toView(route);
    } catch (error) {
      this.rethrowUnique(error);
      throw error;
    }
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
