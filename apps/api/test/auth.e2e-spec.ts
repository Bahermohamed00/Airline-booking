import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaTestClient, resetDatabase } from './test-utils.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  it('POST /api/auth/register creates a customer', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'customer@test.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'Customer',
      })
      .expect(201);

    expect(res.body.email).toBe('customer@test.com');
    expect(res.body.userId).toBeDefined();
  });

  it('POST /api/auth/login returns tokens for valid credentials', async () => {
    await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'customer@test.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'Customer',
    });

    const res = await request(app.getHttpServer()).post('/api/auth/login').send({
      email: 'customer@test.com',
      password: 'Password123!',
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('POST /api/auth/login rejects invalid credentials', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({
      email: 'customer@test.com',
      password: 'WrongPassword!',
    });

    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });
});
