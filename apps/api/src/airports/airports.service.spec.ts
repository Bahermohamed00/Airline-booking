import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AirportsService } from './airports.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DashboardEventsService } from '../dashboard-events/dashboard-events.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

const createMockPrisma = () => ({
  airport: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
});

const actor = { userId: 'staff-1' } as unknown as AuthUser;

describe('AirportsService', () => {
  let service: AirportsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let events: { publish: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    events = { publish: vi.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        AirportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: DashboardEventsService, useValue: events },
      ],
    }).compile();
    service = module.get(AirportsService);
  });

  const dto = {
    iataCode: 'FRA',
    name: 'Frankfurt Airport',
    city: 'Frankfurt',
    country: 'Germany',
    timezone: 'Europe/Berlin',
  };

  it('lists airports ordered by IATA code with numeric coordinates', async () => {
    prisma.airport.findMany.mockResolvedValue([
      { id: 'a1', ...dto, latitude: { toString: () => '50.0379' }, longitude: { toString: () => '8.5622' } },
    ]);
    const airports = await service.findAll();
    expect(airports[0]!.latitude).toBe(50.0379);
    expect(prisma.airport.findMany).toHaveBeenCalledWith({ orderBy: { iataCode: 'asc' } });
  });

  it('throws 404 when retrieving an airport that does not exist', async () => {
    prisma.airport.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a duplicate IATA code on create without auditing', async () => {
    prisma.airport.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create(dto, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.airport.create).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('audits AIRPORT_CREATED on successful create with the actor and IATA code', async () => {
    prisma.airport.findUnique.mockResolvedValue(null);
    prisma.airport.create.mockImplementation(({ data }) => Promise.resolve({ id: 'a1', ...data, latitude: null, longitude: null }));

    await service.create(dto, actor);

    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'staff-1',
      actorType: 'Staff',
      action: 'AIRPORT_CREATED',
      targetType: 'Airport',
      targetId: 'a1',
      metadata: { iataCode: 'FRA' },
    });
  });

  it('rejects a duplicate IATA code on update but allows unchanged code', async () => {
    prisma.airport.findUnique
      .mockResolvedValueOnce({ id: 'a1', iataCode: 'FRA' }) // existing
      .mockResolvedValueOnce({ id: 'a2' }); // taken
    await expect(service.update('a1', { iataCode: 'MUC' }, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(audit.log).not.toHaveBeenCalled();

    prisma.airport.findUnique.mockResolvedValue({ id: 'a1', iataCode: 'FRA' });
    prisma.airport.update.mockImplementation(({ data }) => Promise.resolve({ id: 'a1', ...dto, ...data, latitude: null, longitude: null }));
    const updated = await service.update('a1', { city: 'Frankfurt am Main' }, actor);
    expect(updated.city).toBe('Frankfurt am Main');
  });

  it('audits AIRPORT_UPDATED with only the fields actually sent', async () => {
    prisma.airport.findUnique.mockResolvedValue({ id: 'a1', iataCode: 'FRA' });
    prisma.airport.update.mockImplementation(({ data }) => Promise.resolve({ id: 'a1', ...dto, ...data, latitude: null, longitude: null }));

    // class-transformer leaves untouched optional fields explicitly undefined.
    await service.update('a1', { city: 'Frankfurt am Main', iataCode: undefined, name: undefined }, actor);

    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'staff-1',
      actorType: 'Staff',
      action: 'AIRPORT_UPDATED',
      targetType: 'Airport',
      targetId: 'a1',
      metadata: { changedFields: ['city'] },
    });
  });
});
