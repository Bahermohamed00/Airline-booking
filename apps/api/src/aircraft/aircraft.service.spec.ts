import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AircraftService } from './aircraft.service';
import { PrismaService } from '../prisma/prisma.service';

const createMockPrisma = () => {
  const tx = {
    aircraft: { create: vi.fn() },
    seat: { createMany: vi.fn() },
  };
  return {
    aircraft: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    seat: { findMany: vi.fn() },
    $transaction: vi.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    __tx: tx,
  };
};

describe('AircraftService', () => {
  let service: AircraftService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [AircraftService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AircraftService);
  });

  const dto = { registration: 'NV-738Z', model: 'Boeing 737-800', capacity: 180 };

  it('rejects a duplicate registration before creating anything', async () => {
    prisma.aircraft.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates the aircraft and its full seat map in one transaction', async () => {
    prisma.aircraft.findUnique.mockResolvedValue(null);
    prisma.__tx.aircraft.create.mockImplementation(({ data }) => Promise.resolve({ id: 'ac-1', ...data }));
    prisma.__tx.seat.createMany.mockResolvedValue({ count: 180 });

    const view = await service.create(dto);

    expect(view.id).toBe('ac-1');
    expect(view.seatCount).toBe(180);
    const seatsArg = prisma.__tx.seat.createMany.mock.calls[0]![0] as { data: Array<{ aircraftId: string }> };
    expect(seatsArg.data).toHaveLength(180);
    expect(seatsArg.data.every((s) => s.aircraftId === 'ac-1')).toBe(true);
  });

  it('throws 404 for a nonexistent aircraft and for its seats', async () => {
    prisma.aircraft.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findSeats('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects renaming onto another aircraft’s registration', async () => {
    prisma.aircraft.findUnique
      .mockResolvedValueOnce({ id: 'ac-1', registration: 'NV-320A' }) // existing
      .mockResolvedValueOnce({ id: 'ac-2' }); // taken
    await expect(service.update('ac-1', { registration: 'NV-321B' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.aircraft.update).not.toHaveBeenCalled();
  });
});
