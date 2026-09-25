import { Module, NestModule, MiddlewareConsumer, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { RolesModule } from './roles/roles.module.js';
import { JwtAuthGuard } from './auth/auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { PermissionsGuard } from './auth/permissions.guard.js';
import { OwnershipGuard } from './auth/ownership.guard.js';
import { AuditThrottlerGuard } from './auth/audit-throttler.guard.js';

const isTest = process.env['NODE_ENV'] === 'test';
// E2E suites skip throttling per request by default; the rate-limit suite opts
// in by setting E2E_THROTTLE=1 before building the app (evaluated per request).
const skipThrottleInTest = (): boolean => isTest && process.env['E2E_THROTTLE'] !== '1';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60 * 1000, limit: 100 },
        { name: 'public-search', ttl: 60 * 1000, limit: 30 },
      ],
      skipIf: skipThrottleInTest,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: true },
        }),
    },
    {
      provide: APP_GUARD,
      useClass: AuditThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OwnershipGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(cookieParser()).forRoutes('*');
  }
}
