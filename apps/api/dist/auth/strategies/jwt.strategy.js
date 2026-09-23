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
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
let JwtStrategy = class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    prisma;
    constructor(configService, prisma) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow('JWT_SECRET'),
        });
        this.prisma = prisma;
    }
    async validate(payload) {
        if (payload.type !== 'access') {
            throw new UnauthorizedException('Invalid token type');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            include: {
                userRoles: {
                    include: {
                        role: {
                            include: {
                                rolePermissions: {
                                    include: { permission: true },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!user || user.status !== 'ACTIVE') {
            throw new UnauthorizedException('User not active');
        }
        const roles = user.userRoles.map((ur) => ur.role.name);
        const permissionSet = new Set();
        for (const ur of user.userRoles) {
            if (ur.role.isSuperAdmin) {
                permissionSet.add('super_admin');
            }
            for (const rp of ur.role.rolePermissions) {
                permissionSet.add(`${rp.permission.resource}:${rp.permission.action}`);
            }
        }
        return {
            userId: user.id,
            email: user.email,
            roles,
            permissions: Array.from(permissionSet),
        };
    }
};
JwtStrategy = __decorate([
    Injectable(),
    __param(0, Inject(ConfigService)),
    __param(1, Inject(PrismaService)),
    __metadata("design:paramtypes", [ConfigService,
        PrismaService])
], JwtStrategy);
export { JwtStrategy };
//# sourceMappingURL=jwt.strategy.js.map