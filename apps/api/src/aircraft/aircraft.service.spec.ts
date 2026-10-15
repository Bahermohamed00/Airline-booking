import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AircraftService } from './aircraft.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DashboardEventsService } from '../dashboard-events/dashboard-events.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

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

const actor = { userId: 'staff-1' } as unknown as AuthUser;

describe('AircraftService', () => {
  let service: AircraftService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let events: { publish: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    events = { publish: vi.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        AircraftService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: DashboardEventsService, useValue: events },
      ],
    }).compile();
    service = module.get(AircraftService);
  });

  const dto = { registration: 'NV-738Z', model: 'Boeing 737-800', capacity: 180 };

  it('rejects a duplicate registration before creating anything', async () => {
    prisma.aircraft.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create(dto, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('creates the aircraft and its full seat map in one transaction, then audits AIRCRAFT_CREATED', async () => {
    prisma.aircraft.findUnique.mockResolvedValue(null);
    prisma.__tx.aircraft.create.mockImplementation(({ data }) => Promise.resolve({ id: 'ac-1', ...data }));
    prisma.__tx.seat.createMany.mockResolvedValue({ count: 180 });

    const view = await service.create(dto, actor);

    expect(view.id).toBe('ac-1');
    expect(view.seatCount).toBe(180);
    const seatsArg = prisma.__tx.seat.createMany.mock.calls[0]![0] as { data: Array<{ aircraftId: string }> };
    expect(seatsArg.data).toHaveLength(180);
    expect(seatsArg.data.every((s) => s.aircraftId === 'ac-1')).toBe(true);
    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'staff-1',
      actorType: 'Staff',
      action: 'AIRCRAFT_CREATED',
      targetType: 'Aircraft',
      targetId: 'ac-1',
      metadata: { registration: 'NV-738Z' },
    });
  });

  it('throws 404 for a nonexistent aircraft and for its seats', async () => {
    prisma.aircraft.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findSeats('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects renaming onto another aircraft’s registration without auditing', async () => {
    prisma.aircraft.findUnique
      .mockResolvedValueOnce({ id: 'ac-1', registration: 'NV-320A' }) // existing
      .mockResolvedValueOnce({ id: 'ac-2' }); // taken
    await expect(service.update('ac-1', { registration: 'NV-321B' }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.aircraft.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('audits AIRCRAFT_UPDATED with only the fields actually sent', async () => {
    prisma.aircraft.findUnique.mockResolvedValue({ id: 'ac-1', registration: 'NV-320A' });
    prisma.aircraft.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'ac-1', ...dto, ...data, _count: { seats: 180 } }),
    );

    await service.update('ac-1', { status: 'MAINTENANCE', model: undefined }, actor);

    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'staff-1',
      actorType: 'Staff',
      action: 'AIRCRAFT_UPDATED',
      targetType: 'Aircraft',
      targetId: 'ac-1',
      metadata: { changedFields: ['status'] },
    });
  });
});
