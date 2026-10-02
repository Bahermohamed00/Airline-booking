import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { FlightsService } from './flights.service';
import { PrismaService } from '../prisma/prisma.service';

const createMockPrisma = () => ({
  flight: { findUnique: vi.fn(), findMany: vi.fn() },
  bookingSeat: { findMany: vi.fn() },
  seatHold: { findMany: vi.fn() },
});

describe('FlightsService.getSeatAvailability', () => {
  let service: FlightsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        FlightsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: vi.fn() } },
      ],
    }).compile();
    service = module.get(FlightsService);
  });

  it('404s for an unknown flight without querying seats', async () => {
    prisma.flight.findUnique.mockResolvedValue(null);
    await expect(service.getSeatAvailability('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.bookingSeat.findMany).not.toHaveBeenCalled();
    expect(prisma.seatHold.findMany).not.toHaveBeenCalled();
  });

  it('excludes cancelled bookings from occupied seats', async () => {
    prisma.flight.findUnique.mockResolvedValue({ id: 'f1' });
    prisma.bookingSeat.findMany.mockResolvedValue([]);
    prisma.seatHold.findMany.mockResolvedValue([]);
    await service.getSeatAvailability('f1');
    const where = prisma.bookingSeat.findMany.mock.calls[0]![0]!.where!;
    expect(where.flightSegment).toEqual({ flightId: 'f1' });
    expect(where.bookingPassenger.booking.status).toEqual({ not: 'CANCELLED' });
  });

  it('excludes expired and non-active holds from held seats', async () => {
    prisma.flight.findUnique.mockResolvedValue({ id: 'f1' });
    prisma.bookingSeat.findMany.mockResolvedValue([]);
    prisma.seatHold.findMany.mockResolvedValue([]);
    await service.getSeatAvailability('f1');
    const where = prisma.seatHold.findMany.mock.calls[0]![0]!.where!;
    expect(where.flightId).toBe('f1');
    expect(where.status).toBe('ACTIVE');
    expect(where.expiresAt).toEqual({ gt: expect.any(Date) });
  });

  it('returns occupied and held seat id lists', async () => {
    prisma.flight.findUnique.mockResolvedValue({ id: 'f1' });
    prisma.bookingSeat.findMany.mockResolvedValue([
      { seatId: 's1' },
      { seatId: 's2' },
    ]);
    prisma.seatHold.findMany.mockResolvedValue([{ seatId: 's3' }]);
    const view = await service.getSeatAvailability('f1');
    expect(view).toEqual({
      flightId: 'f1',
      occupiedSeatIds: ['s1', 's2'],
      heldSeatIds: ['s3'],
    });
  });
});
