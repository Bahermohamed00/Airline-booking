var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
let AuditService = class AuditService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async log(entry) {
        return this.prisma.auditLog.create({
            data: {
                actorId: entry.actorId,
                actorType: entry.actorType,
                action: entry.action,
                targetType: entry.targetType,
                targetId: entry.targetId,
                metadata: entry.metadata,
                ipAddress: entry.ipAddress,
                bookingId: entry.bookingId,
            },
        });
    }
    async findMany(args) {
        return this.prisma.auditLog.findMany(args);
    }
    async count(args) {
        return this.prisma.auditLog.count(args);
    }
};
AuditService = __decorate([
    Injectable(),
    __param(0, Inject(PrismaService)),
    __metadata("design:paramtypes", [PrismaService])
], AuditService);
export { AuditService };
//# sourceMappingURL=audit.service.js.map