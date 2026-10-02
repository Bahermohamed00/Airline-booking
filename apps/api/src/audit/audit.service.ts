import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLog, Prisma } from '@prisma/client';
import type { AuditQueryDto } from './dto/audit-query.dto.js';

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

export interface AuditItem {
  id: string;
  event: string;
  actorType: string;
  actorId: string | null;
  targetType: string;
  targetId: string | null;
  ipAddress: string | null;
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface AuditQueryResult {
  items: AuditItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Metadata keys produced by the current audit writers and proven
 * non-sensitive. Anything else is stripped from API responses — new writers
 * must extend this list deliberately (and only with safe values).
 */
const SAFE_METADATA_KEYS = [
  'changedFields',
  'roleIds',
  'reason',
  'operation',
  'otherSessionsRevoked',
  'email',
  // Booking-domain metadata (non-sensitive identifiers only).
  'bookingReference',
  'flightNumber',
  'seatNumbers',
  'holdCount',
  // Payment-domain metadata (never tokens or card data).
  'paymentId',
  'refundId',
  'amount',
  'currency',
  'providerReference',
  // Offer metadata.
  'title',
] as const;

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

  async query(dto: AuditQueryDto): Promise<AuditQueryResult> {
    const where: Prisma.AuditLogWhereInput = {
      ...(dto.event ? { action: dto.event } : {}),
      ...(dto.actorId ? { actorId: dto.actorId } : {}),
      ...(dto.targetId ? { targetId: dto.targetId } : {}),
      ...(dto.actorType ? { actorType: dto.actorType } : {}),
      ...(dto.targetType ? { targetType: dto.targetType } : {}),
      ...(dto.from || dto.to
        ? {
            createdAt: {
              ...(dto.from ? { gte: new Date(dto.from) } : {}),
              ...(dto.to ? { lte: new Date(dto.to) } : {}),
            },
          }
        : {}),
      // Search is deliberately limited to safe scalar columns — never metadata
      // (JSON, could contain sensitive values) and never credentials.
      ...(dto.search
        ? {
            OR: [
              { action: { contains: dto.search, mode: 'insensitive' as const } },
              { targetId: { contains: dto.search, mode: 'insensitive' as const } },
              { targetType: { contains: dto.search, mode: 'insensitive' as const } },
              { ipAddress: { contains: dto.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.AuditLogOrderByWithRelationInput =
      dto.sortBy === 'event' ? { action: dto.sortOrder ?? 'desc' } : { createdAt: dto.sortOrder ?? 'desc' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toSafeItem(row)),
      page: dto.page,
      limit: dto.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / dto.limit)),
    };
  }

  private toSafeItem(row: AuditLog): AuditItem {
    return {
      id: row.id,
      event: row.action,
      actorType: row.actorType,
      actorId: row.actorId,
      targetType: row.targetType,
      targetId: row.targetId,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt,
      metadata: this.sanitizeMetadata(row.metadata),
    };
  }

  private sanitizeMetadata(metadata: Prisma.JsonValue | null): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return {};
    }
    const source = metadata as Record<string, unknown>;
    const safe: Record<string, unknown> = {};
    for (const key of SAFE_METADATA_KEYS) {
      const value = source[key];
      // Only scalar values (or flat scalar arrays) pass — a nested object could
      // hide sensitive content inside a whitelisted key.
      if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
        safe[key] = value;
      } else if (Array.isArray(value) && value.every((v) => ['string', 'number', 'boolean'].includes(typeof v))) {
        safe[key] = value;
      }
    }
    return safe;
  }
}
