import { Module } from '@nestjs/common';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { TokenService } from './token.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { PermissionsGuard } from './permissions.guard.js';
import { OwnershipGuard } from './ownership.guard.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtModuleOptions => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m') as NonNullable<JwtModuleOptions['signOptions']>['expiresIn'],
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionService, TokenService, JwtStrategy, JwtAuthGuard, RolesGuard, PermissionsGuard, OwnershipGuard],
  exports: [AuthService, PasswordService, SessionService, TokenService, JwtAuthGuard, RolesGuard, PermissionsGuard, OwnershipGuard],
})
export class AuthModule {}
