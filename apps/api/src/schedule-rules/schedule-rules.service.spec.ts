import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Weekday } from '@prisma/client';
import { ScheduleRulesService } from './schedule-rules.service';
import { PrismaService } from '../prisma/prisma.service';

const createMockPrisma = () => ({
  route: { findUnique: vi.fn() },
  aircraft: { findUnique: vi.fn() },
  scheduleRule: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
});

describe('ScheduleRulesService', () => {
  let service: ScheduleRulesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [ScheduleRulesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ScheduleRulesService);
  });

  const dto = {
    routeId: 'route-1',
    aircraftId: 'aircraft-1',
    flightNumber: 'NV200',
    departureTimeLocal: '09:30',
    operatingDays: [Weekday.MON, Weekday.WED, Weekday.FRI],
    effectiveFrom: '2026-10-01',
    effectiveTo: '2026-12-31',
  };

  it('rejects a rule for a route that does not exist', async () => {
    prisma.route.findUnique.mockResolvedValue(null);
    prisma.aircraft.findUnique.mockResolvedValue({ id: 'aircraft-1' });
    await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.scheduleRule.create).not.toHaveBeenCalled();
  });

  it('rejects a rule for an aircraft that does not exist', async () => {
    prisma.route.findUnique.mockResolvedValue({ id: 'route-1' });
    prisma.aircraft.findUnique.mockResolvedValue(null);
    await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.scheduleRule.create).not.toHaveBeenCalled();
  });

  it('rejects an inverted effective date range', async () => {
    prisma.route.findUnique.mockResolvedValue({ id: 'route-1' });
    prisma.aircraft.findUnique.mockResolvedValue({ id: 'aircraft-1' });
    await expect(service.create({ ...dto, effectiveFrom: '2026-12-31', effectiveTo: '2026-10-01' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.scheduleRule.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate flight number', async () => {
    prisma.route.findUnique.mockResolvedValue({ id: 'route-1' });
    prisma.aircraft.findUnique.mockResolvedValue({ id: 'aircraft-1' });
    prisma.scheduleRule.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.scheduleRule.create).not.toHaveBeenCalled();
  });

  it('creates a valid rule', async () => {
    prisma.route.findUnique.mockResolvedValue({ id: 'route-1' });
    prisma.aircraft.findUnique.mockResolvedValue({ id: 'aircraft-1' });
    prisma.scheduleRule.findUnique.mockResolvedValue(null);
    prisma.scheduleRule.create.mockImplementation(({ data }) => Promise.resolve({ id: 'rule-1', ...data }));
    const rule = await service.create(dto);
    expect(rule.id).toBe('rule-1');
    expect(rule.flightNumber).toBe('NV200');
    expect(rule.effectiveFrom.toISOString()).toContain('2026-10-01');
  });

  it('throws 404 when updating a rule that does not exist', async () => {
    prisma.scheduleRule.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { status: 'INACTIVE' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an update that inverts the effective range', async () => {
    prisma.scheduleRule.findUnique.mockResolvedValue({
      id: 'rule-1',
      routeId: 'route-1',
      aircraftId: 'aircraft-1',
      flightNumber: 'NV200',
      effectiveFrom: new Date('2026-10-01T00:00:00Z'),
      effectiveTo: new Date('2026-12-31T00:00:00Z'),
    });
    await expect(service.update('rule-1', { effectiveTo: '2026-09-01' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.scheduleRule.update).not.toHaveBeenCalled();
  });
});
