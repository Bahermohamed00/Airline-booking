import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthUser } from '../decorators/current-user.decorator.js';

interface JwtPayload {
  sub: string;
  email: string;
  sid: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(ConfigService) configService: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
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
        sessions: {
          where: { id: payload.sid },
          select: { id: true, revokedAt: true, expiresAt: true },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not active');
    }

    const session = user.sessions[0];
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissionSet = new Set<string>();
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
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      roles,
      permissions: Array.from(permissionSet),
      sessionId: session.id,
    };
  }
}
