import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Weekday } from '@prisma/client';
import { ScheduleRulesService } from './schedule-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DashboardEventsService } from '../dashboard-events/dashboard-events.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

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

const actor = { userId: 'staff-1' } as unknown as AuthUser;

describe('ScheduleRulesService', () => {
  let service: ScheduleRulesService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let events: { publish: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    events = { publish: vi.fn().mockResolvedValue(undefined) };
    const module = await Test.createTestingModule({
      providers: [
        ScheduleRulesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: DashboardEventsService, useValue: events },
      ],
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
    await expect(service.create(dto, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.scheduleRule.create).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects a rule for an aircraft that does not exist', async () => {
    prisma.route.findUnique.mockResolvedValue({ id: 'route-1' });
    prisma.aircraft.findUnique.mockResolvedValue(null);
    await expect(service.create(dto, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.scheduleRule.create).not.toHaveBeenCalled();
  });

  it('rejects an inverted effective date range', async () => {
    prisma.route.findUnique.mockResolvedValue({ id: 'route-1' });
    prisma.aircraft.findUnique.mockResolvedValue({ id: 'aircraft-1' });
    await expect(service.create({ ...dto, effectiveFrom: '2026-12-31', effectiveTo: '2026-10-01' }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.scheduleRule.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate flight number', async () => {
    prisma.route.findUnique.mockResolvedValue({ id: 'route-1' });
    prisma.aircraft.findUnique.mockResolvedValue({ id: 'aircraft-1' });
    prisma.scheduleRule.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.create(dto, actor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.scheduleRule.create).not.toHaveBeenCalled();
  });

  it('creates a valid rule and audits SCHEDULE_RULE_CREATED', async () => {
    prisma.route.findUnique.mockResolvedValue({ id: 'route-1' });
    prisma.aircraft.findUnique.mockResolvedValue({ id: 'aircraft-1' });
    prisma.scheduleRule.findUnique.mockResolvedValue(null);
    prisma.scheduleRule.create.mockImplementation(({ data }) => Promise.resolve({ id: 'rule-1', ...data }));
    const rule = await service.create(dto, actor);
    expect(rule.id).toBe('rule-1');
    expect(rule.flightNumber).toBe('NV200');
    expect(rule.effectiveFrom.toISOString()).toContain('2026-10-01');
    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'staff-1',
      actorType: 'Staff',
      action: 'SCHEDULE_RULE_CREATED',
      targetType: 'ScheduleRule',
      targetId: 'rule-1',
      metadata: { flightNumber: 'NV200' },
    });
    expect(events.publish).toHaveBeenCalledWith('schedule-rule.created');
  });

  it('throws 404 when updating a rule that does not exist', async () => {
    prisma.scheduleRule.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { status: 'INACTIVE' }, actor)).rejects.toBeInstanceOf(NotFoundException);
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
    await expect(service.update('rule-1', { effectiveTo: '2026-09-01' }, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.scheduleRule.update).not.toHaveBeenCalled();
  });

  it('audits SCHEDULE_RULE_UPDATED with only the fields actually sent', async () => {
    prisma.scheduleRule.findUnique.mockResolvedValue({
      id: 'rule-1',
      routeId: 'route-1',
      aircraftId: 'aircraft-1',
      flightNumber: 'NV200',
      effectiveFrom: new Date('2026-10-01T00:00:00Z'),
      effectiveTo: new Date('2026-12-31T00:00:00Z'),
    });
    prisma.scheduleRule.update.mockImplementation(({ data }) => Promise.resolve({ id: 'rule-1', ...data }));

    await service.update('rule-1', { status: 'INACTIVE', operatingDays: undefined }, actor);

    expect(audit.log).toHaveBeenCalledWith({
      actorId: 'staff-1',
      actorType: 'Staff',
      action: 'SCHEDULE_RULE_UPDATED',
      targetType: 'ScheduleRule',
      targetId: 'rule-1',
      metadata: { flightNumber: 'NV200', changedFields: ['status'] },
    });
    expect(events.publish).toHaveBeenCalledWith('schedule-rule.updated');
    expect(events.publish).toHaveBeenCalledWith('schedule-rule.status.changed');
  });
});
