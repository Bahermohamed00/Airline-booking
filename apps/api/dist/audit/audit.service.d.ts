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
export declare class AuditService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    log(entry: AuditEntry): Promise<AuditLog>;
    findMany(args?: Prisma.AuditLogFindManyArgs): Promise<AuditLog[]>;
    count(args?: Prisma.AuditLogCountArgs): Promise<number>;
}
