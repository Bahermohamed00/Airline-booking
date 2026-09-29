import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Aircraft, Prisma, Seat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAircraftDto } from './dto/create-aircraft.dto.js';
import { UpdateAircraftDto } from './dto/update-aircraft.dto.js';
import { generateSeatMap } from './seat-map.js';

export type AircraftView = Omit<Aircraft, 'seats'> & { seatCount: number };

type AircraftWithCount = Aircraft & { _count: { seats: number } };

const SEAT_COUNT_INCLUDE = { _count: { select: { seats: true } } } as const;

@Injectable()
export class AircraftService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAll(): Promise<AircraftView[]> {
    const aircraft = await this.prisma.aircraft.findMany({
      include: SEAT_COUNT_INCLUDE,
      orderBy: { registration: 'asc' },
    });
    return aircraft.map((a) => this.toView(a));
  }

  async findOne(id: string): Promise<AircraftView> {
    const aircraft = await this.prisma.aircraft.findUnique({ where: { id }, include: SEAT_COUNT_INCLUDE });
    if (!aircraft) {
      throw new NotFoundException('Aircraft not found');
    }
    return this.toView(aircraft);
  }

  async findSeats(id: string): Promise<Seat[]> {
    const aircraft = await this.prisma.aircraft.findUnique({ where: { id }, select: { id: true } });
    if (!aircraft) {
      throw new NotFoundException('Aircraft not found');
    }
    return this.prisma.seat.findMany({
      where: { aircraftId: id },
      orderBy: [{ seatRow: 'asc' }, { seatColumn: 'asc' }],
    });
  }

  async create(dto: CreateAircraftDto): Promise<AircraftView> {
    const taken = await this.prisma.aircraft.findUnique({ where: { registration: dto.registration } });
    if (taken) {
      throw new ConflictException(`An aircraft with registration ${dto.registration} already exists`);
    }
    try {
      const aircraft = await this.prisma.$transaction(async (tx) => {
        const created = await tx.aircraft.create({
          data: {
            registration: dto.registration,
            model: dto.model,
            capacity: dto.capacity,
            status: dto.status ?? 'ACTIVE',
          },
        });
        await tx.seat.createMany({
          data: generateSeatMap(dto.capacity).map((s) => ({ ...s, aircraftId: created.id, features: {} })),
        });
        return created;
      });
      return { ...aircraft, seatCount: dto.capacity };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`An aircraft with registration ${dto.registration} already exists`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateAircraftDto): Promise<AircraftView> {
    const existing = await this.prisma.aircraft.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Aircraft not found');
    }
    if (dto.registration && dto.registration !== existing.registration) {
      const taken = await this.prisma.aircraft.findUnique({ where: { registration: dto.registration } });
      if (taken) {
        throw new ConflictException(`An aircraft with registration ${dto.registration} already exists`);
      }
    }
    try {
      const aircraft = await this.prisma.aircraft.update({
        where: { id },
        data: dto,
        include: SEAT_COUNT_INCLUDE,
      });
      return this.toView(aircraft);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`An aircraft with registration ${dto.registration} already exists`);
      }
      throw error;
    }
  }

  private toView(aircraft: AircraftWithCount): AircraftView {
    const { _count, ...rest } = aircraft;
    return { ...rest, seatCount: _count.seats };
  }
}
