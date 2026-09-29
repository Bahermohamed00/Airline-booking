import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { PrismaService } from '../prisma/prisma.service';

const createMockPrisma = () => ({
  airport: { count: vi.fn() },
  route: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
});

const airportFixture = (iataCode: string) => ({
  id: `${iataCode.toLowerCase()}-airport`,
  iataCode,
  icaoCode: null,
  name: `${iataCode} Airport`,
  city: 'City',
  country: 'Country',
  timezone: 'UTC',
  latitude: null,
  longitude: null,
  status: 'ACTIVE',
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

const withAirports = (route: Record<string, unknown>) => ({
  ...route,
  originAirport: airportFixture('FRA'),
  destinationAirport: airportFixture('JFK'),
});

describe('RoutesService', () => {
  let service: RoutesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [RoutesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(RoutesService);
  });

  const dto = {
    originAirportId: 'a-airport',
    destinationAirportId: 'b-airport',
    distanceKm: 656,
    durationMinutes: 95,
  };

  it('rejects a route whose origin equals its destination', async () => {
    await expect(service.create({ ...dto, destinationAirportId: dto.originAirportId })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.route.create).not.toHaveBeenCalled();
  });

  it('rejects references to airports that do not exist', async () => {
    prisma.airport.count.mockResolvedValue(1);
    await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.route.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate origin/destination pair', async () => {
    prisma.airport.count.mockResolvedValue(2);
    prisma.route.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.route.create).not.toHaveBeenCalled();
  });

  it('creates a route when the pair is valid', async () => {
    prisma.airport.count.mockResolvedValue(2);
    prisma.route.findFirst.mockResolvedValue(null);
    prisma.route.create.mockImplementation(({ data }) => Promise.resolve(withAirports({ id: 'r1', ...data })));
    const route = await service.create(dto);
    expect(route.id).toBe('r1');
    expect(route.originAirport.iataCode).toBe('FRA');
    expect(prisma.route.create).toHaveBeenCalledOnce();
  });

  it('throws 404 when retrieving a route that does not exist', async () => {
    prisma.route.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows updating a route to its own airport pair (no false duplicate)', async () => {
    const existing = { id: 'r1', originAirportId: 'a-airport', destinationAirportId: 'b-airport' };
    prisma.route.findUnique.mockResolvedValue(existing);
    prisma.route.update.mockImplementation(({ data }) => Promise.resolve(withAirports({ ...existing, ...data })));
    const route = await service.update('r1', { distanceKm: 700 });
    expect(route.distanceKm).toBe(700);
    // Pair unchanged → no existence/duplicate validation needed.
    expect(prisma.route.findFirst).not.toHaveBeenCalled();
  });

  it('rejects updating a route onto another route’s pair', async () => {
    const existing = { id: 'r1', originAirportId: 'a-airport', destinationAirportId: 'b-airport' };
    prisma.route.findUnique.mockResolvedValue(existing);
    prisma.airport.count.mockResolvedValue(2);
    prisma.route.findFirst.mockResolvedValue({ id: 'r2' });
    await expect(service.update('r1', { destinationAirportId: 'c-airport' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.route.update).not.toHaveBeenCalled();
  });
});
