import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { FlightsModule } from './flights/flights.module.js';
import { JwtAuthGuard } from './auth/auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { PermissionsGuard } from './auth/permissions.guard.js';

const isTest = process.env['NODE_ENV'] === 'test';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...(isTest
      ? []
      : [
          ThrottlerModule.forRoot({
            throttlers: [
              { name: 'default', ttl: 60 * 1000, limit: 100 },
              { name: 'public-search', ttl: 60 * 1000, limit: 30 },
            ],
          }),
        ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    FlightsModule,
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
    ...(isTest
      ? []
      : [
          {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
          },
        ]),
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
  ],
})
export class AppModule {}
