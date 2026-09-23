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
import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from '../auth/password.service.js';
import { AuditService } from '../audit/audit.service.js';
let UsersService = class UsersService {
    prisma;
    passwordService;
    auditService;
    constructor(prisma, passwordService, auditService) {
        this.prisma = prisma;
        this.passwordService = passwordService;
        this.auditService = auditService;
    }
    async create(dto, actorId) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) {
            throw new ConflictException('Email already registered');
        }
        const hashedPassword = await this.passwordService.hash(dto.password);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                passwordHash: hashedPassword,
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone,
                status: dto.status ?? 'ACTIVE',
                userRoles: dto.roleIds ? { create: dto.roleIds.map((roleId) => ({ roleId })) } : undefined,
            },
            include: { userRoles: { include: { role: true } } },
        });
        await this.auditService.log({
            actorId: actorId ?? user.id,
            actorType: actorId ? 'Staff' : 'User',
            action: 'USER_CREATED',
            targetType: 'User',
            targetId: user.id,
        });
        return user;
    }
    async findAll(args) {
        return this.prisma.user.findMany(args);
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { userRoles: { include: { role: true } } },
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }
    async findByEmail(email) {
        return this.prisma.user.findUnique({ where: { email } });
    }
    async update(id, dto, actorId) {
        const existing = await this.prisma.user.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException('User not found');
        }
        if (dto.email && dto.email !== existing.email) {
            const taken = await this.prisma.user.findUnique({ where: { email: dto.email } });
            if (taken) {
                throw new ConflictException('Email already registered');
            }
        }
        const user = await this.prisma.$transaction(async (tx) => {
            if (dto.roleIds) {
                await tx.userRole.deleteMany({ where: { userId: id } });
                await tx.userRole.createMany({
                    data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
                });
            }
            return tx.user.update({
                where: { id },
                data: {
                    email: dto.email,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    phone: dto.phone,
                    status: dto.status,
                },
                include: { userRoles: { include: { role: true } } },
            });
        });
        await this.auditService.log({
            actorId: actorId ?? id,
            actorType: actorId ? 'Staff' : 'User',
            action: 'USER_UPDATED',
            targetType: 'User',
            targetId: id,
            metadata: { changedFields: Object.keys(dto) },
        });
        return user;
    }
    async remove(id, actorId) {
        const existing = await this.prisma.user.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException('User not found');
        }
        await this.prisma.user.update({
            where: { id },
            data: { status: 'DEACTIVATED' },
        });
        await this.auditService.log({
            actorId,
            actorType: 'Staff',
            action: 'USER_DEACTIVATED',
            targetType: 'User',
            targetId: id,
        });
    }
};
UsersService = __decorate([
    Injectable(),
    __param(0, Inject(PrismaService)),
    __param(1, Inject(PasswordService)),
    __param(2, Inject(AuditService)),
    __metadata("design:paramtypes", [PrismaService,
        PasswordService,
        AuditService])
], UsersService);
export { UsersService };
//# sourceMappingURL=users.service.js.map