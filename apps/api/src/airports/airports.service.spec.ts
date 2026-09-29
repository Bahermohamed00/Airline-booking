import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AirportsService } from './airports.service';
import { PrismaService } from '../prisma/prisma.service';

const createMockPrisma = () => ({
  airport: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
});

describe('AirportsService', () => {
  let service: AirportsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [AirportsService, { provide: PrismaService, useValue: prisma }],
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

  it('rejects a duplicate IATA code on create', async () => {
    prisma.airport.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.airport.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate IATA code on update but allows unchanged code', async () => {
    prisma.airport.findUnique
      .mockResolvedValueOnce({ id: 'a1', iataCode: 'FRA' }) // existing
      .mockResolvedValueOnce({ id: 'a2' }); // taken
    await expect(service.update('a1', { iataCode: 'MUC' })).rejects.toBeInstanceOf(ConflictException);

    prisma.airport.findUnique.mockResolvedValue({ id: 'a1', iataCode: 'FRA' });
    prisma.airport.update.mockImplementation(({ data }) => Promise.resolve({ id: 'a1', ...dto, ...data, latitude: null, longitude: null }));
    const updated = await service.update('a1', { city: 'Frankfurt am Main' });
    expect(updated.city).toBe('Frankfurt am Main');
  });
});
