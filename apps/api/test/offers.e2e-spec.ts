import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

const PASSWORD = 'Password123!';

/**
 * Phase 5: Offers — Super Admin CRUD with RBAC, customer public reads with
 * server-side eligibility (status + validity window), audit events.
 */
describe('Offers (e2e)', () => {
  let app: INestApplication<App>;
  let superAdminRoleId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);
    for (const [resource, action] of [
      ['offers', 'read'],
      ['offers', 'manage'],
    ] as const) {
      await prismaTestClient.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action },
      });
    }
    const superAdmin = await prismaTestClient.role.upsert({
      where: { name: 'Super Admin' },
      update: { isSuperAdmin: true },
      create: { name: 'Super Admin', isSuperAdmin: true },
    });
    superAdminRoleId = superAdmin.id;
  });

  async function loginAs(email: string, superAdmin: boolean): Promise<string> {
    await registerVerifiedUser(app, { email, password: PASSWORD, firstName: 'Offers', lastName: 'Actor' });
    if (superAdmin) {
      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
      await prismaTestClient.userRole.create({ data: { userId: user.id, roleId: superAdminRoleId } });
    }
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  const offerBody = (overrides: Record<string, unknown> = {}) => ({
    title: 'Winter Sun in Dubai',
    description: 'Trade the cold for the coast — daily nonstop flights.',
    badge: 'Winter sun',
    destination: 'Frankfurt → Dubai',
    offerValue: 'from €349',
    terms: 'One-way Economy fare, taxes included.',
    imageUrl: 'assets/img/dest-dubai.jpg',
    validFrom: '2026-01-01',
    validUntil: '2027-12-31',
    ...overrides,
  });

  function adminReq(method: 'get' | 'post' | 'patch' | 'delete', path: string, token?: string, body?: unknown) {
    const req = request(app.getHttpServer())[method](`/api/admin/offers${path}`);
    if (token) req.set('Authorization', `Bearer ${token}`);
    return body === undefined ? req : req.send(body as Record<string, unknown>);
  }

  async function seedOffer(overrides: Record<string, unknown> = {}) {
    const base = {
      description: 'A realistic fictional NovaAir offer.',
      validFrom: new Date('2026-01-01T00:00:00Z'),
      validUntil: new Date('2027-12-31T00:00:00Z'),
      status: 'ACTIVE' as const,
    };
    return prismaTestClient.offer.create({ data: { title: `Offer ${randomUUID().slice(0, 8)}`, ...base, ...overrides } as never });
  }

  // ---------- Admin CRUD ----------

  it('Super Admin performs full CRUD against PostgreSQL with audit events', async () => {
    const token = await loginAs('offers-admin@test.dev', true);

    const created = (await adminReq('post', '', token, offerBody({ status: 'ACTIVE' })).expect(201)).body;
    expect(created.id).toBeTruthy();
    expect(created.status).toBe('ACTIVE');
    expect((await prismaTestClient.offer.findUniqueOrThrow({ where: { id: created.id } })).title).toBe(offerBody().title);

    const list = (await adminReq('get', '', token).expect(200)).body;
    expect(list).toHaveLength(1);

    const updated = (
      await adminReq('patch', `/${created.id}`, token, { offerValue: 'from €299', status: 'ACTIVE' }).expect(200)
    ).body;
    expect(updated.offerValue).toBe('from €299');

    const removed = (await adminReq('delete', `/${created.id}`, token).expect(200)).body;
    expect(removed.status).toBe('INACTIVE'); // lifecycle delete, not hard delete
    expect((await prismaTestClient.offer.findUniqueOrThrow({ where: { id: created.id } })).status).toBe('INACTIVE');

    const audit = await prismaTestClient.auditLog.findMany({
      where: { targetType: 'Offer', targetId: created.id },
      orderBy: { action: 'asc' },
    });
    expect(audit.map((a) => a.action)).toEqual(['OFFER_CREATED', 'OFFER_DELETED', 'OFFER_UPDATED']);
  });

  it('validates input: range, lengths, image URL, unknown fields, duplicate title', async () => {
    const token = await loginAs('offers-admin2@test.dev', true);

    await adminReq('post', '', token, offerBody({ validFrom: '2027-12-31', validUntil: '2026-01-01' })).expect(400);
    await adminReq('post', '', token, offerBody({ title: 'AB' })).expect(400); // too short
    await adminReq('post', '', token, offerBody({ description: 'short' })).expect(400); // too short
    await adminReq('post', '', token, offerBody({ imageUrl: 'http://insecure.example.com/x.jpg' })).expect(400);
    await adminReq('post', '', token, offerBody({ imageUrl: 'ftp://files/x.jpg' })).expect(400);
    await adminReq('post', '', token, offerBody({ status: 'PUBLISHED' })).expect(400);
    await adminReq('post', '', token, offerBody({ discountPercent: 30 })).expect(400); // unknown field
    await adminReq('post', '', token, offerBody({ validFrom: '01-01-2026' })).expect(400);

    await adminReq('post', '', token, offerBody()).expect(201);
    await adminReq('post', '', token, offerBody()).expect(409); // duplicate title
  });

  it('enforces authorization: 401 unauthenticated, 403 for customers on admin endpoints', async () => {
    const customer = await loginAs('offers-customer@test.dev', false);

    await adminReq('post', '', undefined, offerBody()).expect(401);
    await adminReq('get', '', undefined).expect(401);

    await adminReq('post', '', customer, offerBody()).expect(403);
    await adminReq('get', '', customer).expect(403);
    const offer = await seedOffer();
    await adminReq('patch', `/${offer.id}`, customer, { title: 'Hacked' }).expect(403);
    await adminReq('delete', `/${offer.id}`, customer).expect(403);
  });

  it('404s admin detail/update/delete for nonexistent offers', async () => {
    const token = await loginAs('offers-admin3@test.dev', true);
    await adminReq('get', `/${randomUUID()}`, token).expect(404);
    await adminReq('patch', `/${randomUUID()}`, token, { title: 'Nonexistent' }).expect(404);
    await adminReq('delete', `/${randomUUID()}`, token).expect(404);
    await adminReq('get', '/not-a-uuid', token).expect(400);
  });

  // ---------- Customer visibility ----------

  it('customer sees only ACTIVE, currently valid offers — draft/inactive/expired/future hidden', async () => {
    const active = await seedOffer({ title: 'Active Now', status: 'ACTIVE' });
    await seedOffer({ title: 'Draft One', status: 'DRAFT' });
    await seedOffer({ title: 'Inactive One', status: 'INACTIVE' });
    await seedOffer({ title: 'Expired One', status: 'ACTIVE', validUntil: new Date(Date.now() - 86_400_000) });
    await seedOffer({ title: 'Future One', status: 'ACTIVE', validFrom: new Date(Date.now() + 30 * 86_400_000), validUntil: new Date(Date.now() + 60 * 86_400_000) });
    await seedOffer({ title: 'Marked Expired', status: 'EXPIRED' });

    const res = await request(app.getHttpServer()).get('/api/offers').expect(200);
    expect(res.body.map((o: { title: string }) => o.title)).toEqual(['Active Now']);

    const view = res.body[0];
    expect(view.title).toBe('Active Now');
    expect(view).not.toHaveProperty('status');
    expect(view).not.toHaveProperty('createdAt');
    expect(view).not.toHaveProperty('updatedAt');

    const detail = await request(app.getHttpServer()).get(`/api/offers/${active.id}`).expect(200);
    expect(detail.body.title).toBe('Active Now');

    // Hidden offers are 404 even when they exist (no existence leak).
    const draft = await prismaTestClient.offer.findFirstOrThrow({ where: { title: 'Draft One' } });
    await request(app.getHttpServer()).get(`/api/offers/${draft.id}`).expect(404);
    await request(app.getHttpServer()).get(`/api/offers/${randomUUID()}`).expect(404);
    await request(app.getHttpServer()).get('/api/offers/not-a-uuid').expect(400);
  });
});
