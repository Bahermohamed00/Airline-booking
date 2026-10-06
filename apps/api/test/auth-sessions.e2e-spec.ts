import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase, refreshCookieOf } from './test-utils.js';

const TEST_USER = {
  email: 'sessions@test.com',
  password: 'Password123!',
  firstName: 'Session',
  lastName: 'Tester',
  dateOfBirth: '1990-01-01',
};

describe('Auth sessions & logout (e2e)', () => {
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
    await registerVerifiedUser(app, TEST_USER);
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  async function login(): Promise<{ accessToken: string; cookie: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password });
    expect(res.status).toBe(200);
    return { accessToken: res.body.accessToken as string, cookie: refreshCookieOf(res) };
  }

  it('lists active sessions and flags the current one', async () => {
    const first = await login();
    const second = await login();

    const res = await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${second.accessToken}`)
      .expect(200);

    expect(res.body).toHaveLength(2);
    const current = (res.body as Array<{ current: boolean }>).filter((s) => s.current);
    expect(current).toHaveLength(1);
    void first;
  });

  it('logout revokes the current session and clears the cookie, leaving other sessions alive', async () => {
    const first = await login();
    const second = await login();

    const logoutRes = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .set('Cookie', first.cookie)
      .expect(200);

    const cleared = (logoutRes.headers['set-cookie'] as unknown as string[])?.find((c) => c.startsWith('refresh_token='));
    expect(cleared).toBeDefined();
    expect(cleared).toContain('Expires=Thu, 01 Jan 1970');

    // Session 1 is fully dead: access token and refresh token both rejected
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${first.accessToken}`).expect(401);
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', first.cookie).expect(401);

    // Session 2 still works
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${second.accessToken}`).expect(200);
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', second.cookie).expect(200);
  });

  it('logout-all revokes every session', async () => {
    const first = await login();
    const second = await login();

    await request(app.getHttpServer())
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .set('Cookie', first.cookie)
      .expect(200);

    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${first.accessToken}`).expect(401);
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${second.accessToken}`).expect(401);
  });

  it('revokes a specific session by id; stranger sessions answer 404', async () => {
    const first = await login();
    const second = await login();

    const list = await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(200);
    const otherSession = (list.body as Array<{ id: string; current: boolean }>).find((s) => !s.current)!;

    await request(app.getHttpServer())
      .delete(`/api/auth/sessions/${otherSession.id}`)
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(200);

    // The revoked session's refresh cookie is dead; mine still works
    await request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', second.cookie).expect(401);
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${first.accessToken}`).expect(200);

    // Re-deleting is a 404, and so is a session id that does not exist
    await request(app.getHttpServer())
      .delete(`/api/auth/sessions/${otherSession.id}`)
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete('/api/auth/sessions/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(404);
  });

  it('a different user cannot revoke my session (404, no existence leak)', async () => {
    // A second user on the same API
    await registerVerifiedUser(app, { email: 'stranger@test.com', password: 'Password123!', firstName: 'Stranger', lastName: 'User' });
    const strangerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'stranger@test.com', password: 'Password123!' });
    const strangerToken = strangerLogin.body.accessToken as string;

    const mine = await login();
    const list = await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${mine.accessToken}`)
      .expect(200);
    const mySession = (list.body as Array<{ id: string; current: boolean }>).find((s) => s.current)!;

    await request(app.getHttpServer())
      .delete(`/api/auth/sessions/${mySession.id}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(404);

    // My session is untouched
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${mine.accessToken}`).expect(200);
  });

  it('returns only safe session metadata and hides revoked sessions', async () => {
    const first = await login();
    await login(); // second session

    const list = await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(200);

    expect(list.body).toHaveLength(2);
    for (const s of list.body as Array<Record<string, unknown>>) {
      expect(Object.keys(s).sort()).toEqual(['createdAt', 'current', 'id', 'ipAddress', 'lastUsedAt', 'userAgent']);
    }
    const raw = JSON.stringify(list.body);
    expect(raw).not.toContain('tokenHash');
    expect(raw).not.toContain('refreshToken');

    const other = (list.body as Array<{ id: string; current: boolean }>).find((s) => !s.current)!;
    await request(app.getHttpServer())
      .delete(`/api/auth/sessions/${other.id}`)
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(200);

    const after = await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(200);
    expect(after.body).toHaveLength(1);
    expect(after.body[0].current).toBe(true);
  });

  it('session endpoints require authentication', async () => {
    await request(app.getHttpServer()).get('/api/auth/sessions').expect(401);
    await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
    await request(app.getHttpServer()).post('/api/auth/logout-all').expect(401);
  });
});
