import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLog, Prisma } from '@prisma/client';

export interface AuditEntry {
  actorId?: string;
  actorType: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  bookingId?: string;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        actorType: entry.actorType,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata as Prisma.InputJsonValue,
        ipAddress: entry.ipAddress,
        bookingId: entry.bookingId,
      },
    });
  }

  async findMany(args?: Prisma.AuditLogFindManyArgs): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany(args);
  }

  async count(args?: Prisma.AuditLogCountArgs): Promise<number> {
    return this.prisma.auditLog.count(args);
  }
}
