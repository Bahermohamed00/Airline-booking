import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from './test-utils.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { configureSecurity } from '../src/app.setup.js';
import { prismaTestClient, resetDatabase } from './test-utils.js';

describe('Security headers & CORS (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .compile();

    app = moduleFixture.createNestApplication();
    configureSecurity(app); // same setup as production main.ts
    app.setGlobalPrefix('api');
    await app.init();
    await resetDatabase(prismaTestClient);
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  it('sends baseline browser security headers', async () => {
    const res = await request(app.getHttpServer()).get('/api').expect(200);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['referrer-policy']).toBeDefined();
    // Helmet's default CSP is present and is safe here: this API serves only JSON
    expect(res.headers['content-security-policy']).toBeDefined();
    // HSTS only belongs to HTTPS production — off in this environment
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });

  it('reflects only the configured origin and allows credentials', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/auth/login')
      .set('Origin', 'http://localhost:4200')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:4200',
    );
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('never answers with a wildcard or the attacker origin (browsers block the mismatch)', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');

    // The cors middleware only ever emits the configured origin — never '*',
    // never the request's Origin — so the browser blocks https://evil.example.
    const allowOrigin = res.headers['access-control-allow-origin'];
    expect(allowOrigin).not.toBe('*');
    expect(allowOrigin).not.toBe('https://evil.example');
    expect(allowOrigin).toBe('http://localhost:4200');
  });
});
