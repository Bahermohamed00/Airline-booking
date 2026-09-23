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
import { Injectable, Inject, UnauthorizedException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from './password.service.js';
import { AuditService } from '../audit/audit.service.js';
import { randomBytes } from 'crypto';
let AuthService = class AuthService {
    prisma;
    passwordService;
    jwtService;
    configService;
    auditService;
    constructor(prisma, passwordService, jwtService, configService, auditService) {
        this.prisma = prisma;
        this.passwordService = passwordService;
        this.jwtService = jwtService;
        this.configService = configService;
        this.auditService = auditService;
    }
    async register(dto) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) {
            throw new ConflictException('Email already registered');
        }
        const customerRole = await this.prisma.role.upsert({
            where: { name: 'Customer' },
            update: {},
            create: { name: 'Customer', description: 'Default customer role' },
        });
        const hashedPassword = await this.passwordService.hash(dto.password);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                passwordHash: hashedPassword,
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone,
                userRoles: { create: { roleId: customerRole.id } },
            },
        });
        await this.auditService.log({
            actorId: user.id,
            actorType: 'User',
            action: 'USER_REGISTERED',
            targetType: 'User',
            targetId: user.id,
        });
        return { userId: user.id, email: user.email };
    }
    async login(dto, ipAddress) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
            include: { userRoles: { include: { role: true } } },
        });
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }
        const valid = await this.passwordService.verify(dto.password, user.passwordHash);
        if (!valid) {
            throw new UnauthorizedException('Invalid credentials');
        }
        if (user.status !== 'ACTIVE') {
            throw new UnauthorizedException('Account not active');
        }
        if (user.mfaEnabled) {
            if (!dto.mfaCode) {
                return { accessToken: '', refreshToken: '', expiresIn: 0, mfaRequired: true };
            }
            const verified = speakeasy.totp.verify({
                secret: user.mfaSecret ?? '',
                encoding: 'base32',
                token: dto.mfaCode,
                window: 1,
            });
            if (!verified) {
                throw new UnauthorizedException('Invalid MFA code');
            }
        }
        const tokens = await this.generateTokens(user.id, user.email);
        await this.auditService.log({
            actorId: user.id,
            actorType: 'User',
            action: 'USER_LOGGED_IN',
            targetType: 'User',
            targetId: user.id,
            ipAddress,
        });
        return tokens;
    }
    async refresh(refreshToken) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.getOrThrow('JWT_SECRET'),
            });
            if (payload.type !== 'refresh') {
                throw new UnauthorizedException('Invalid token type');
            }
            const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
            if (!user || user.status !== 'ACTIVE') {
                throw new UnauthorizedException('User not active');
            }
            return this.generateTokens(user.id, user.email);
        }
        catch {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }
    async requestPasswordReset(dto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) {
            return { message: 'If the email exists, a reset link has been sent' };
        }
        const rawToken = randomBytes(32).toString('hex');
        const hashedToken = await this.passwordService.hash(rawToken);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken: hashedToken,
                resetTokenExpiresAt: expiresAt,
            },
        });
        console.log(`Password reset token for ${dto.email}: ${rawToken}`);
        await this.auditService.log({
            actorId: user.id,
            actorType: 'User',
            action: 'PASSWORD_RESET_REQUESTED',
            targetType: 'User',
            targetId: user.id,
        });
        return { message: 'If the email exists, a reset link has been sent' };
    }
    async resetPassword(dto) {
        const user = await this.prisma.user.findFirst({
            where: {
                resetTokenExpiresAt: { gt: new Date() },
            },
        });
        if (!user || !user.resetToken) {
            throw new BadRequestException('Invalid or expired token');
        }
        const valid = await this.passwordService.verify(dto.token, user.resetToken);
        if (!valid) {
            throw new BadRequestException('Invalid or expired token');
        }
        const hashedPassword = await this.passwordService.hash(dto.newPassword);
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hashedPassword,
                resetToken: null,
                resetTokenExpiresAt: null,
            },
        });
        await this.auditService.log({
            actorId: user.id,
            actorType: 'User',
            action: 'PASSWORD_RESET_COMPLETED',
            targetType: 'User',
            targetId: user.id,
        });
        return { message: 'Password updated successfully' };
    }
    async setupMfa(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        const secret = speakeasy.generateSecret({
            name: `${this.configService.get('MFA_ISSUER', 'AirlineBooking')}:${user.email}`,
            length: 32,
        });
        await this.prisma.user.update({
            where: { id: userId },
            data: { mfaSecret: secret.base32 },
        });
        return {
            secret: secret.base32,
            qrCodeUrl: secret.otpauth_url ?? '',
        };
    }
    async verifyMfaAndEnable(userId, code) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.mfaSecret) {
            throw new BadRequestException('MFA not initialized');
        }
        const verified = speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token: code,
            window: 1,
        });
        if (!verified) {
            throw new BadRequestException('Invalid MFA code');
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: { mfaEnabled: true },
        });
        await this.auditService.log({
            actorId: userId,
            actorType: 'User',
            action: 'MFA_ENABLED',
            targetType: 'User',
            targetId: userId,
        });
        return { enabled: true };
    }
    async disableMfa(userId) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { mfaEnabled: false, mfaSecret: null },
        });
        await this.auditService.log({
            actorId: userId,
            actorType: 'User',
            action: 'MFA_DISABLED',
            targetType: 'User',
            targetId: userId,
        });
        return { enabled: false };
    }
    async generateTokens(userId, email) {
        const accessExpiresIn = this.configService.get('JWT_EXPIRES_IN', '15m');
        const refreshExpiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d');
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync({ sub: userId, email, type: 'access' }, { expiresIn: accessExpiresIn }),
            this.jwtService.signAsync({ sub: userId, email, type: 'refresh' }, { expiresIn: refreshExpiresIn }),
        ]);
        return {
            accessToken,
            refreshToken,
            expiresIn: 900,
        };
    }
};
AuthService = __decorate([
    Injectable(),
    __param(0, Inject(PrismaService)),
    __param(1, Inject(PasswordService)),
    __param(2, Inject(JwtService)),
    __param(3, Inject(ConfigService)),
    __param(4, Inject(AuditService)),
    __metadata("design:paramtypes", [PrismaService,
        PasswordService,
        JwtService,
        ConfigService,
        AuditService])
], AuthService);
export { AuthService };
//# sourceMappingURL=auth.service.js.map