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

  async function seedRoute() {
    const [fra, dxb] = await Promise.all([
      prismaTestClient.airport.upsert({
        where: { iataCode: 'FRA' },
        update: {},
        create: { iataCode: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin' },
      }),
      prismaTestClient.airport.upsert({
        where: { iataCode: 'DXB' },
        update: {},
        create: { iataCode: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'United Arab Emirates', timezone: 'Asia/Dubai' },
      }),
    ]);
    const existing = await prismaTestClient.route.findFirst({
      where: { originAirportId: fra.id, destinationAirportId: dxb.id },
    });
    return (
      existing ??
      (await prismaTestClient.route.create({
        data: { originAirportId: fra.id, destinationAirportId: dxb.id, distanceKm: 4842, durationMinutes: 375 },
      }))
    );
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

  // ---------- Bookable offers (BR-16) ----------

  it('admin creates a bookable offer and the discount terms are persisted', async () => {
    const token = await loginAs('offers-admin4@test.dev', true);
    const route = await seedRoute();

    const created = (
      await adminReq(
        'post',
        '',
        token,
        offerBody({ status: 'ACTIVE', discountType: 'PERCENT', discountValue: 15, routeId: route.id, cabinClass: 'ECONOMY' }),
      ).expect(201)
    ).body;
    expect(created.discountType).toBe('PERCENT');
    expect(Number(created.discountValue)).toBe(15);
    expect(created.routeId).toBe(route.id);
    expect(created.cabinClass).toBe('ECONOMY');

    const persisted = await prismaTestClient.offer.findUniqueOrThrow({ where: { id: created.id } });
    expect(persisted.discountType).toBe('PERCENT');
    expect(Number(persisted.discountValue)).toBe(15);
    expect(persisted.routeId).toBe(route.id);
    expect(persisted.cabinClass).toBe('ECONOMY');
  });

  it('rejects invalid bookable terms with 400', async () => {
    const token = await loginAs('offers-admin5@test.dev', true);
    const route = await seedRoute();

    await adminReq('post', '', token, offerBody({ discountType: 'PERCENT', discountValue: 0 })).expect(400);
    await adminReq('post', '', token, offerBody({ discountType: 'PERCENT', discountValue: 100.5 })).expect(400);
    await adminReq('post', '', token, offerBody({ discountType: 'PERCENT', discountValue: -5 })).expect(400);
    await adminReq('post', '', token, offerBody({ discountType: 'FIXED_AMOUNT', discountValue: 0 })).expect(400);
    await adminReq('post', '', token, offerBody({ discountType: 'PERCENT' })).expect(400); // type without value
    await adminReq('post', '', token, offerBody({ discountValue: 20 })).expect(400); // value without type
    await adminReq('post', '', token, offerBody({ discountType: 'PERCENT', discountValue: 10, routeId: randomUUID() })).expect(400);
    await adminReq('post', '', token, offerBody({ discountType: 'HALF_OFF', discountValue: 10 })).expect(400);
    await adminReq('post', '', token, offerBody({ cabinClass: 'SUITE' })).expect(400);
    await adminReq('post', '', token, offerBody({ discountType: 'PERCENT', discountValue: 10, routeId: 'not-a-uuid' })).expect(400);

    const created = (
      await adminReq('post', '', token, offerBody({ discountType: 'PERCENT', discountValue: 10, routeId: route.id })).expect(201)
    ).body;
    // Merged update semantics: existing PERCENT 10 + new value 150 is out of range.
    await adminReq('patch', `/${created.id}`, token, { discountValue: 150 }).expect(400);
    const updated = (await adminReq('patch', `/${created.id}`, token, { discountType: 'FIXED_AMOUNT' }).expect(200)).body;
    expect(updated.discountType).toBe('FIXED_AMOUNT');
    expect(Number(updated.discountValue)).toBe(10);
  });

  it('PATCH with explicit null clears discount, route and cabin scope; omitted fields are preserved', async () => {
    const token = await loginAs('offers-admin8@test.dev', true);
    const route = await seedRoute();

    const created = (
      await adminReq(
        'post',
        '',
        token,
        offerBody({ status: 'ACTIVE', discountType: 'PERCENT', discountValue: 15, routeId: route.id, cabinClass: 'ECONOMY' }),
      ).expect(201)
    ).body;

    // Clearing the route scope makes the offer route-unrestricted.
    const unscoped = (await adminReq('patch', `/${created.id}`, token, { routeId: null }).expect(200)).body;
    expect(unscoped.routeId).toBeNull();
    expect(unscoped.cabinClass).toBe('ECONOMY');

    // Omitted fields keep their existing values.
    const patched = (await adminReq('patch', `/${created.id}`, token, { badge: 'Flash sale' }).expect(200)).body;
    expect(patched.discountType).toBe('PERCENT');
    expect(Number(patched.discountValue)).toBe(15);
    expect(patched.cabinClass).toBe('ECONOMY');

    // Contradictory null + value on the discount pair is rejected.
    await adminReq('patch', `/${created.id}`, token, { discountType: null, discountValue: 10 }).expect(400);
    await adminReq('patch', `/${created.id}`, token, { discountType: 'PERCENT', discountValue: null }).expect(400);

    // Null on either discount member clears the pair → marketing-only.
    const cleared = (await adminReq('patch', `/${created.id}`, token, { discountType: null, cabinClass: null }).expect(200)).body;
    expect(cleared.discountType).toBeNull();
    expect(cleared.discountValue).toBeNull();
    expect(cleared.cabinClass).toBeNull();

    const detail = (await adminReq('get', `/${created.id}`, token).expect(200)).body;
    expect(detail.discountType).toBeNull();
    expect(detail.discountValue).toBeNull();
    expect(detail.routeId).toBeNull();
    expect(detail.cabinClass).toBeNull();

    const publicList = await request(app.getHttpServer()).get('/api/offers').expect(200);
    const view = publicList.body.find((o: { id: string }) => o.id === created.id);
    expect(view.bookable).toBe(false);
    expect(view.discount).toBeNull();
    expect(view.eligibility).toBeNull();

    // Clearing an already marketing-only offer is a harmless no-op.
    await adminReq('patch', `/${created.id}`, token, { discountValue: null }).expect(200);
  });

  it('permanent delete removes an unused offer and audits OFFER_HARD_DELETED', async () => {
    const token = await loginAs('offers-admin6@test.dev', true);
    const offer = await seedOffer({ discountType: 'FIXED_AMOUNT', discountValue: 25 });

    const removed = (await adminReq('delete', `/${offer.id}/permanent`, token).expect(200)).body;
    expect(removed.id).toBe(offer.id);
    expect(await prismaTestClient.offer.findUnique({ where: { id: offer.id } })).toBeNull();

    const audit = await prismaTestClient.auditLog.findMany({ where: { action: 'OFFER_HARD_DELETED', targetId: offer.id } });
    expect(audit).toHaveLength(1);

    await adminReq('delete', `/${offer.id}/permanent`, token).expect(404);
    await adminReq('delete', `/${randomUUID()}/permanent`, token).expect(404);
  });

  it('permanent delete 409s with OFFER_IN_USE when a booking references the offer', async () => {
    const token = await loginAs('offers-admin7@test.dev', true);
    const offer = await seedOffer({ discountType: 'PERCENT', discountValue: 10 });
    const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'offers-admin7@test.dev' } });
    await prismaTestClient.booking.create({
      data: {
        bookingReference: 'BR16USED01',
        userId: user.id,
        totalAmount: 421,
        currency: 'EUR',
        contactEmail: 'offers-admin7@test.dev',
        offerId: offer.id,
      },
    });

    const res = await adminReq('delete', `/${offer.id}/permanent`, token).expect(409);
    expect(res.body.code).toBe('OFFER_IN_USE');
    expect(res.body.bookingCount).toBe(1);
    expect(await prismaTestClient.offer.findUnique({ where: { id: offer.id } })).not.toBeNull();

    // Lifecycle deactivate still works on a referenced offer.
    await adminReq('delete', `/${offer.id}`, token).expect(200);
  });

  it('public view exposes bookable/discount/eligibility and still hides internals', async () => {
    const route = await seedRoute();
    await seedOffer({
      title: 'Bookable Dubai',
      discountType: 'PERCENT',
      discountValue: 15,
      routeId: route.id,
      cabinClass: 'ECONOMY',
    });
    await seedOffer({ title: 'Marketing Only' });

    const res = await request(app.getHttpServer()).get('/api/offers').expect(200);
    const bookable = res.body.find((o: { title: string }) => o.title === 'Bookable Dubai');
    expect(bookable.bookable).toBe(true);
    expect(bookable.discount).toEqual({ type: 'PERCENT', value: 15 });
    expect(bookable.eligibility).toEqual({ routeId: route.id, originIata: 'FRA', destinationIata: 'DXB', cabinClass: 'ECONOMY' });
    expect(bookable).not.toHaveProperty('status');
    expect(bookable).not.toHaveProperty('createdAt');
    expect(bookable).not.toHaveProperty('updatedAt');

    const marketing = res.body.find((o: { title: string }) => o.title === 'Marketing Only');
    expect(marketing.bookable).toBe(false);
    expect(marketing.discount).toBeNull();
    expect(marketing.eligibility).toBeNull();
  });

  // ---------- Customer visibility ----------

  it('customer sees only ACTIVE, currently valid offers — draft/inactive/expired/future hidden', async () => {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const active = await seedOffer({ title: 'Active Now', status: 'ACTIVE' });
    // Boundary: an offer stays visible through its whole final day.
    await seedOffer({ title: 'Last Day', status: 'ACTIVE', validUntil: todayStart });
    // Boundary: an offer becomes visible on its first day.
    await seedOffer({ title: 'First Day', status: 'ACTIVE', validFrom: todayStart });
    await seedOffer({ title: 'Draft One', status: 'DRAFT' });
    await seedOffer({ title: 'Inactive One', status: 'INACTIVE' });
    await seedOffer({ title: 'Expired One', status: 'ACTIVE', validUntil: new Date(Date.now() - 86_400_000) });
    await seedOffer({ title: 'Future One', status: 'ACTIVE', validFrom: new Date(Date.now() + 30 * 86_400_000), validUntil: new Date(Date.now() + 60 * 86_400_000) });
    await seedOffer({ title: 'Marked Expired', status: 'EXPIRED' });

    const res = await request(app.getHttpServer()).get('/api/offers').expect(200);
    expect(res.body.map((o: { title: string }) => o.title).sort()).toEqual(['Active Now', 'First Day', 'Last Day']);

    const view = res.body.find((o: { title: string }) => o.title === 'Active Now');
    expect(view).toBeTruthy();
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
