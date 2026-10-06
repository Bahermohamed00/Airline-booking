import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SystemSetting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';

/**
 * System settings are seed-managed: the API can read and update values, but
 * keys are never created or deleted at runtime.
 */
@Injectable()
export class SettingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  async findAll(): Promise<SystemSetting[]> {
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async update(
    key: string,
    value: string,
    actor?: AuthUser,
  ): Promise<SystemSetting> {
    const existing = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    if (!existing) {
      throw new NotFoundException('Setting not found');
    }

    const setting = await this.prisma.systemSetting.update({
      where: { key },
      data: { value },
    });

    await this.auditService.log({
      actorId: actor?.userId,
      actorType: actor ? 'Staff' : 'System',
      action: 'SETTING_UPDATED',
      targetType: 'SystemSetting',
      targetId: setting.id,
      metadata: { key, oldValue: existing.value, newValue: value },
    });

    return setting;
  }
}
