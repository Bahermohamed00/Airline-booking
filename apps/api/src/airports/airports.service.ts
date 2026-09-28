import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { Airport, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAirportDto } from './dto/create-airport.dto.js';
import { UpdateAirportDto } from './dto/update-airport.dto.js';

export type AirportView = Omit<Airport, 'latitude' | 'longitude'> & {
  latitude: number | null;
  longitude: number | null;
};

/** Serializes Prisma Decimal coordinates to plain numbers for API responses. */
export function toAirportView(airport: Airport): AirportView {
  return {
    ...airport,
    latitude: airport.latitude === null ? null : Number(airport.latitude),
    longitude: airport.longitude === null ? null : Number(airport.longitude),
  };
}

@Injectable()
export class AirportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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

  async create(dto: CreateAirportDto): Promise<AirportView> {
    await this.assertIataAvailable(dto.iataCode);
    try {
      const airport = await this.prisma.airport.create({ data: dto });
      return this.toView(airport);
    } catch (error) {
      this.rethrowUnique(error, `An airport with IATA code ${dto.iataCode} already exists`);
      throw error;
    }
  }

  async update(id: string, dto: UpdateAirportDto): Promise<AirportView> {
    const existing = await this.prisma.airport.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Airport not found');
    }
    if (dto.iataCode && dto.iataCode !== existing.iataCode) {
      await this.assertIataAvailable(dto.iataCode);
    }
    try {
      const airport = await this.prisma.airport.update({ where: { id }, data: dto });
      return this.toView(airport);
    } catch (error) {
      this.rethrowUnique(error, `An airport with IATA code ${dto.iataCode} already exists`);
      throw error;
    }
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
