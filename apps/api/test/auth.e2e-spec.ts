import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

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
    await registerVerifiedUser(app, {
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
    expect(res.body.refreshToken).toBeUndefined();
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies?.some((c) => c.startsWith('refresh_token='))).toBe(true);
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

  it('GET /api/auth/me returns the profile for a valid access token', async () => {
    await registerVerifiedUser(app, {
      email: 'customer@test.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'Customer',
    });
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({
      email: 'customer@test.com',
      password: 'Password123!',
    });

    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(res.body.email).toBe('customer@test.com');
    expect(res.body.firstName).toBe('Test');
    expect(res.body.lastName).toBe('Customer');
    expect(res.body.roles).toContain('Customer');
    expect(res.body.emailVerified).toBe(true);
  });
});
