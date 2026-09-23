var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
import { JwtAuthGuard } from './auth/auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { PermissionsGuard } from './auth/permissions.guard.js';
const isTest = process.env['NODE_ENV'] === 'test';
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
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
        ],
        controllers: [AppController],
        providers: [
            AppService,
            {
                provide: APP_PIPE,
                useFactory: () => new ValidationPipe({
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
], AppModule);
export { AppModule };
//# sourceMappingURL=app.module.js.map