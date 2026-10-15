import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { DashboardEventsService } from '../dashboard-events/dashboard-events.service.js';
import { changedFieldsOf } from '../audit/changed-fields.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { CreateScheduleRuleDto } from './dto/create-schedule-rule.dto.js';
import { UpdateScheduleRuleDto } from './dto/update-schedule-rule.dto.js';

const RULE_INCLUDE = {
  route: { include: { originAirport: true, destinationAirport: true } },
  aircraft: true,
} as const;

const asDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`);
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

@Injectable()
export class ScheduleRulesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(DashboardEventsService) private readonly dashboardEvents: DashboardEventsService,
  ) {}

  findAll() {
    return this.prisma.scheduleRule.findMany({ include: RULE_INCLUDE, orderBy: { flightNumber: 'asc' } });
  }

  async findOne(id: string) {
    const rule = await this.prisma.scheduleRule.findUnique({ where: { id }, include: RULE_INCLUDE });
    if (!rule) {
      throw new NotFoundException('Schedule rule not found');
    }
    return rule;
  }

  async create(dto: CreateScheduleRuleDto, actor: AuthUser) {
    await this.assertReferencesExist(dto.routeId, dto.aircraftId);
    this.assertValidRange(dto.effectiveFrom, dto.effectiveTo);
    await this.assertFlightNumberAvailable(dto.flightNumber);
    let rule;
    try {
      rule = await this.prisma.scheduleRule.create({
        data: {
          routeId: dto.routeId,
          aircraftId: dto.aircraftId,
          flightNumber: dto.flightNumber,
          departureTimeLocal: dto.departureTimeLocal,
          operatingDays: dto.operatingDays,
          effectiveFrom: asDbDate(dto.effectiveFrom),
          effectiveTo: asDbDate(dto.effectiveTo),
          status: dto.status ?? 'ACTIVE',
        },
        include: RULE_INCLUDE,
      });
    } catch (error) {
      this.rethrowUnique(error, dto.flightNumber);
      throw error;
    }
    await this.auditService.log({
      actorId: actor.userId,
      actorType: 'Staff',
      action: 'SCHEDULE_RULE_CREATED',
      targetType: 'ScheduleRule',
      targetId: rule.id,
      metadata: { flightNumber: rule.flightNumber },
    });
    await this.dashboardEvents.publish('schedule-rule.created');
    return rule;
  }

  async update(id: string, dto: UpdateScheduleRuleDto, actor: AuthUser) {
    const existing = await this.prisma.scheduleRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Schedule rule not found');
    }

    const routeId = dto.routeId ?? existing.routeId;
    const aircraftId = dto.aircraftId ?? existing.aircraftId;
    if (routeId !== existing.routeId || aircraftId !== existing.aircraftId) {
      await this.assertReferencesExist(routeId, aircraftId);
    }

    const effectiveFrom = dto.effectiveFrom ?? isoDate(existing.effectiveFrom);
    const effectiveTo = dto.effectiveTo ?? isoDate(existing.effectiveTo);
    this.assertValidRange(effectiveFrom, effectiveTo);

    const flightNumber = dto.flightNumber ?? existing.flightNumber;
    if (flightNumber !== existing.flightNumber) {
      await this.assertFlightNumberAvailable(flightNumber);
    }

    let rule;
    try {
      rule = await this.prisma.scheduleRule.update({
        where: { id },
        data: {
          routeId,
          aircraftId,
          flightNumber,
          departureTimeLocal: dto.departureTimeLocal,
          operatingDays: dto.operatingDays,
          effectiveFrom: asDbDate(effectiveFrom),
          effectiveTo: asDbDate(effectiveTo),
          status: dto.status,
        },
        include: RULE_INCLUDE,
      });
    } catch (error) {
      this.rethrowUnique(error, flightNumber);
      throw error;
    }
    await this.auditService.log({
      actorId: actor.userId,
      actorType: 'Staff',
      action: 'SCHEDULE_RULE_UPDATED',
      targetType: 'ScheduleRule',
      targetId: rule.id,
      metadata: { flightNumber: rule.flightNumber, changedFields: changedFieldsOf(dto) },
    });
    await this.dashboardEvents.publish('schedule-rule.updated');
    if (dto.status !== undefined) {
      await this.dashboardEvents.publish('schedule-rule.status.changed');
    }
    return rule;
  }

  private async assertReferencesExist(routeId: string, aircraftId: string): Promise<void> {
    const [route, aircraft] = await Promise.all([
      this.prisma.route.findUnique({ where: { id: routeId }, select: { id: true } }),
      this.prisma.aircraft.findUnique({ where: { id: aircraftId }, select: { id: true } }),
    ]);
    if (!route) {
      throw new BadRequestException('Route does not exist');
    }
    if (!aircraft) {
      throw new BadRequestException('Aircraft does not exist');
    }
  }

  private assertValidRange(effectiveFrom: string, effectiveTo: string): void {
    if (effectiveFrom > effectiveTo) {
      throw new BadRequestException('effectiveFrom must be on or before effectiveTo');
    }
  }

  private async assertFlightNumberAvailable(flightNumber: string): Promise<void> {
    const taken = await this.prisma.scheduleRule.findUnique({ where: { flightNumber } });
    if (taken) {
      throw new ConflictException(`A schedule rule with flight number ${flightNumber} already exists`);
    }
  }

  private rethrowUnique(error: unknown, flightNumber: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(`A schedule rule with flight number ${flightNumber} already exists`);
    }
  }
}
