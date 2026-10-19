import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { generateSeatMap } from '../src/aircraft/seat-map.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

const PASSWORD = 'Password123!';

/**
 * Extras e2e: catalog eligibility, quotes, booking creation with priced +
 * snapshotted extras lines, idempotency, price-change handling, payment
 * amount consistency, and the staff catalog permission boundary. All catalog
 * rows are per-suite fixtures created directly in the *_test database (the
 * harness truncates every table in beforeEach) — no seed commands run.
 */
describe('Extras (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let extrasManageRoleId: string;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
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

  let flightId: string;
  let seats: { id: string }[];
  const svc: Record<string, string> = {};

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);

    const extrasManage = await prismaTestClient.permission.upsert({
      where: { resource_action: { resource: 'extras', action: 'manage' } },
      update: {},
      create: { resource: 'extras', action: 'manage' },
    });
    const role = await prismaTestClient.role.upsert({
      where: { name: 'Extras Manager' },
      update: {},
      create: { name: 'Extras Manager' },
    });
    await prismaTestClient.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: extrasManage.id } },
      update: {},
      create: { roleId: role.id, permissionId: extrasManage.id },
    });
    extrasManageRoleId = role.id;

    const [fra, jfk] = await Promise.all([
      prismaTestClient.airport.create({ data: { iataCode: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin' } }),
      prismaTestClient.airport.create({ data: { iataCode: 'JFK', name: 'JFK International', city: 'New York', country: 'United States', timezone: 'America/New_York' } }),
    ]);
    const route = await prismaTestClient.route.create({
      data: { originAirportId: fra.id, destinationAirportId: jfk.id, distanceKm: 6201, durationMinutes: 505 },
    });
    const aircraft = await prismaTestClient.aircraft.create({ data: { registration: 'NV-T100', model: 'Test Jet 100', capacity: 12 } });
    await prismaTestClient.seat.createMany({
      data: generateSeatMap(aircraft.capacity).map((s) => ({ ...s, aircraftId: aircraft.id, features: {} })),
    });
    const departure = new Date(Date.now() + 2 * 86_400_000);
    const flight = await prismaTestClient.flight.create({
      data: {
        flightNumber: 'NV900',
        routeId: route.id,
        aircraftId: aircraft.id,
        departureTime: departure,
        arrivalTime: new Date(departure.getTime() + 505 * 60000),
        status: 'SCHEDULED',
      },
    });
    await prismaTestClient.flightSegment.create({
      data: {
        flightId: flight.id,
        segmentNumber: 1,
        originAirportId: fra.id,
        destinationAirportId: jfk.id,
        departureTime: departure,
        arrivalTime: new Date(departure.getTime() + 505 * 60000),
      },
    });
    await prismaTestClient.fare.create({
      data: { flightId: flight.id, cabinClass: 'ECONOMY', basePrice: 421, taxAmount: 67, feeAmount: 17, currency: 'EUR', availableCount: 200 },
    });
    flightId = flight.id;
    seats = await prismaTestClient.seat.findMany({ where: { aircraftId: aircraft.id }, orderBy: { seatNumber: 'asc' } });

    // Catalog fixtures: eligible, ineligible (inactive/expired/foreign-currency).
    const create = (data: Record<string, unknown>) =>
      prismaTestClient.extraService.create({ data: data as never }).then((s) => s.id);
    svc['bag'] = await create({ code: 'BAG_23KG', name: 'Extra checked bag (23 kg)', price: 65, currency: 'EUR', category: 'BAGGAGE', pricingUnit: 'PER_ITEM', maxQuantity: 3, requiresPassenger: true, metadata: { bagWeightKg: 23 } });
    svc['meal'] = await create({ code: 'MEAL_HOT', name: 'Hot meal', price: 12.5, currency: 'EUR', category: 'MEAL', pricingUnit: 'PER_ITEM', maxQuantity: 1, requiresPassenger: true, metadata: { dietaryTags: ['vegetarian'] } });
    svc['prio'] = await create({ code: 'PRIORITY_BOARDING', name: 'Priority boarding', price: 15, currency: 'EUR', category: 'PRIORITY', pricingUnit: 'PER_PASSENGER', maxQuantity: 1, requiresPassenger: true });
    svc['ins'] = await create({ code: 'INS_DEMO_BASIC', name: 'Travel insurance (demonstration)', price: 9.99, currency: 'EUR', category: 'INSURANCE', pricingUnit: 'PER_PASSENGER', maxQuantity: 1, requiresPassenger: true, metadata: { demonstration: true } });
    svc['usd'] = await create({ code: 'BAG_USD', name: 'USD bag', price: 50, currency: 'USD', category: 'BAGGAGE', pricingUnit: 'PER_ITEM', maxQuantity: 2, requiresPassenger: true, metadata: { bagWeightKg: 23 } });
    svc['inactive'] = await create({ code: 'BAG_OLD', name: 'Old bag', price: 40, currency: 'EUR', status: 'INACTIVE', category: 'BAGGAGE', pricingUnit: 'PER_ITEM', maxQuantity: 2, requiresPassenger: true, metadata: { bagWeightKg: 23 } });
    svc['expired'] = await create({ code: 'MEAL_EXPIRED', name: 'Expired meal', price: 8, currency: 'EUR', category: 'MEAL', pricingUnit: 'PER_ITEM', maxQuantity: 1, requiresPassenger: true, validTo: new Date(Date.now() - 1000) });
  });

  async function loginAs(email: string, extrasManager = false): Promise<string> {
    await registerVerifiedUser(app, { email, password: PASSWORD, firstName: 'Extras', lastName: 'Actor' });
    if (extrasManager) {
      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
      await prismaTestClient.userRole.create({ data: { userId: user.id, roleId: extrasManageRoleId } });
    }
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  const bodyFor = (seatIds: string[], passengers = 1, extras: unknown[] = []) => ({
    idempotencyKey: randomUUID(),
    flightId,
    cabinClass: 'ECONOMY',
    seatIds,
    passengers: Array.from({ length: passengers }, (_, i) => ({
      firstName: `Pass${i + 1}`,
      lastName: 'Tester',
      passengerType: 'ADULT',
      dateOfBirth: '1990-01-01',
    })),
    ...(extras.length > 0 ? { extras } : {}),
  });

  // ---------- Catalog ----------

  it('catalog returns only active, in-window services in the fare currency', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/extras/catalog')
      .query({ flightId, cabinClass: 'ECONOMY' })
      .expect(200);

    const codes = res.body.map((s: { code: string }) => s.code);
    expect(codes).toEqual(expect.arrayContaining(['BAG_23KG', 'MEAL_HOT', 'PRIORITY_BOARDING', 'INS_DEMO_BASIC']));
    expect(codes).not.toContain('BAG_USD'); // currency ≠ fare currency
    expect(codes).not.toContain('BAG_OLD'); // inactive
    expect(codes).not.toContain('MEAL_EXPIRED'); // validity window over

    const bag = res.body.find((s: { code: string }) => s.code === 'BAG_23KG');
    expect(bag).toMatchObject({ price: 65, currency: 'EUR', pricingUnit: 'PER_ITEM', maxQuantity: 3, requiresPassenger: true, bagWeightKg: 23 });
    const ins = res.body.find((s: { code: string }) => s.code === 'INS_DEMO_BASIC');
    expect(ins.demonstration).toBe(true);
    // No internal columns leak into the public view.
    expect(bag).not.toHaveProperty('status');
    expect(bag).not.toHaveProperty('metadata');
  });

  it('catalog: 404 unknown flight, 400 unoffered cabin', async () => {
    await request(app.getHttpServer()).get('/api/extras/catalog').query({ flightId: randomUUID(), cabinClass: 'ECONOMY' }).expect(404);
    await request(app.getHttpServer()).get('/api/extras/catalog').query({ flightId, cabinClass: 'BUSINESS' }).expect(400);
  });

  // ---------- Quote ----------

  it('quote prices valid selections server-side', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/extras/quote')
      .send({
        flightId,
        cabinClass: 'ECONOMY',
        passengerCount: 2,
        selections: [
          { serviceId: svc['bag'], quantity: 2, passengerIndex: 0 },
          { serviceId: svc['prio'], quantity: 1, passengerIndex: 1 },
        ],
      })
      .expect(200);
    expect(res.body.currency).toBe('EUR');
    expect(res.body.extrasTotal).toBe(145); // 2×65 + 1×15
    expect(res.body.lines).toHaveLength(2);
    expect(res.body.lines[0]).toMatchObject({ code: 'BAG_23KG', quantity: 2, unitPrice: 65, totalPrice: 130, passengerIndex: 0 });
  });

  it('quote rejects invalid selections with EXTRAS_INVALID and structured issues', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/extras/quote')
      .send({
        flightId,
        cabinClass: 'ECONOMY',
        passengerCount: 2,
        selections: [
          { serviceId: svc['bag'], quantity: 4, passengerIndex: 0 }, // over maxQuantity 3
          { serviceId: svc['prio'], quantity: 1 }, // PER_PASSENGER without passenger
          { serviceId: svc['inactive'], quantity: 1, passengerIndex: 0 }, // inactive
          { serviceId: svc['usd'], quantity: 1, passengerIndex: 0 }, // currency mismatch
          { serviceId: randomUUID(), quantity: 1 }, // unknown
          { serviceId: svc['bag'], quantity: 1, passengerIndex: 5 }, // passenger out of range (2 pax)
          { serviceId: svc['meal'], quantity: 1, passengerIndex: 0 },
          { serviceId: svc['meal'], quantity: 1, passengerIndex: 0 }, // duplicate
        ],
      })
      .expect(400);
    expect(res.body.code).toBe('EXTRAS_INVALID');
    const reasons = res.body.issues.map((i: { reason: string }) => i.reason).sort();
    expect(reasons).toEqual([
      'CURRENCY_MISMATCH',
      'DUPLICATE',
      'INACTIVE',
      'INVALID_PASSENGER',
      'INVALID_QUANTITY',
      'PASSENGER_REQUIRED',
      'UNKNOWN_SERVICE',
    ]);
  });

  it('quote rejects client-supplied prices with 400 (whitelist)', async () => {
    await request(app.getHttpServer())
      .post('/api/extras/quote')
      .send({
        flightId,
        cabinClass: 'ECONOMY',
        passengerCount: 1,
        selections: [{ serviceId: svc['bag'], quantity: 1, passengerIndex: 0, price: 0.01 }],
      })
      .expect(400);
  });

  // ---------- Booking creation with extras ----------

  it('creates a booking with extras: snapshot lines, passenger associations, server total', async () => {
    const token = await loginAs('extras-create@test.dev');
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(
        bodyFor([seats[0]!.id, seats[1]!.id], 2, [
          { serviceId: svc['bag'], quantity: 2, passengerIndex: 0 },
          { serviceId: svc['prio'], quantity: 1, passengerIndex: 1 },
          { serviceId: svc['ins'], quantity: 1, passengerIndex: 0 },
        ]),
      )
      .expect(201);

    // 2×(421+67+17) = 1010 fare + 130 bags + 15 priority + 9.99 demo insurance
    expect(res.body.totalAmount).toBe(1164.99);
    expect(res.body.extras).toHaveLength(3);
    expect(res.body.extras).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'BAG_23KG', quantity: 2, unitPrice: 65, totalPrice: 130, passengerIndex: 0, currency: 'EUR' }),
        expect.objectContaining({ code: 'PRIORITY_BOARDING', quantity: 1, totalPrice: 15, passengerIndex: 1 }),
        expect.objectContaining({ code: 'INS_DEMO_BASIC', quantity: 1, totalPrice: 9.99, passengerIndex: 0 }),
      ]),
    );

    // Persisted snapshot lines survive independent of the live catalog row.
    const booking = await prismaTestClient.booking.findUniqueOrThrow({ where: { bookingReference: res.body.bookingReference } });
    const lines = await prismaTestClient.bookingExtra.findMany({ where: { bookingId: booking.id }, orderBy: { serviceCode: 'asc' } });
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => [l.serviceCode, Number(l.unitPrice), Number(l.price)])).toEqual([
      ['BAG_23KG', 65, 130],
      ['INS_DEMO_BASIC', 9.99, 9.99],
      ['PRIORITY_BOARDING', 15, 15],
    ]);
    const passengers = await prismaTestClient.bookingPassenger.findMany({
      where: { bookingId: booking.id },
      include: { passenger: true },
    });
    const bpName = (bpId: string | null) => passengers.find((p) => p.id === bpId)?.passenger.firstName;
    expect(bpName(lines.find((l) => l.serviceCode === 'PRIORITY_BOARDING')!.bookingPassengerId)).toBe('Pass2');
    expect(bpName(lines.find((l) => l.serviceCode === 'BAG_23KG')!.bookingPassengerId)).toBe('Pass1');

    // Snapshot survives a later catalog price change.
    await prismaTestClient.extraService.update({ where: { id: svc['bag']! }, data: { price: 99 } });
    const reread = await request(app.getHttpServer()).get(`/api/bookings/${booking.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(reread.body.extras.find((e: { code: string }) => e.code === 'BAG_23KG')).toMatchObject({ unitPrice: 65, totalPrice: 130 });
    expect(reread.body.totalAmount).toBe(1164.99);
  });

  it('booking creation rejects invalid extras with 400 EXTRAS_INVALID and persists nothing', async () => {
    const token = await loginAs('extras-invalid@test.dev');
    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(bodyFor([seats[0]!.id], 1, [{ serviceId: svc['bag'], quantity: 4, passengerIndex: 0 }]))
      .expect(400);
    expect(res.body.code).toBe('EXTRAS_INVALID');
    expect(res.body.issues[0]).toMatchObject({ reason: 'INVALID_QUANTITY' });
    expect(await prismaTestClient.booking.count()).toBe(0);
    expect(await prismaTestClient.bookingExtra.count()).toBe(0);
  });

  it('a service deactivated between selection and creation is rejected — no silent price/availability change', async () => {
    const token = await loginAs('extras-gone@test.dev');
    const body = bodyFor([seats[0]!.id], 1, [{ serviceId: svc['meal'], quantity: 1, passengerIndex: 0 }]);
    await prismaTestClient.extraService.update({ where: { id: svc['meal']! }, data: { status: 'INACTIVE' } });

    const res = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(400);
    expect(res.body.code).toBe('EXTRAS_INVALID');
    expect(res.body.issues[0]).toMatchObject({ reason: 'INACTIVE' });
    expect(await prismaTestClient.booking.count()).toBe(0);
  });

  // ---------- Idempotency ----------

  it('idempotent replay: same key + same extras replays; same key + changed extras conflicts', async () => {
    const token = await loginAs('extras-idem@test.dev');
    const extras = [{ serviceId: svc['bag'], quantity: 1, passengerIndex: 0 }];
    const body = bodyFor([seats[0]!.id], 1, extras);

    const first = await request(app.getHttpServer()).post('/api/bookings').set('Authorization', `Bearer ${token}`).send(body).expect(201);
    const replay = await request(app.getHttpServer()).post('/api/bookings').set('Authorization', `Bearer ${token}`).send(body).expect(201);
    expect(replay.body.id).toBe(first.body.id);
    expect(await prismaTestClient.bookingExtra.count({ where: { bookingId: first.body.id } })).toBe(1);

    const changed = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...body, extras: [{ serviceId: svc['bag'], quantity: 2, passengerIndex: 0 }] })
      .expect(409);
    expect(changed.text).toContain('different booking request');
  });

  // ---------- Price preview & payment consistency ----------

  it('price preview includes extras and payment charges exactly the persisted booking total', async () => {
    const token = await loginAs('extras-pay@test.dev');
    const extras = [
      { serviceId: svc['bag'], quantity: 1, passengerIndex: 0 },
      { serviceId: svc['meal'], quantity: 1, passengerIndex: 0 },
    ];

    const preview = await request(app.getHttpServer())
      .post('/api/bookings/price-preview')
      .set('Authorization', `Bearer ${token}`)
      .send({ flightId, cabinClass: 'ECONOMY', passengerCount: 1, extras })
      .expect(201);
    expect(preview.body.totalAmount).toBe(505 + 65 + 12.5); // 582.50
    expect(preview.body.extras.total).toBe(77.5);

    const created = await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(bodyFor([seats[0]!.id], 1, extras))
      .expect(201);
    expect(created.body.totalAmount).toBe(preview.body.totalAmount);

    // Mock provider only (PAYMENT_PROVIDER=mock is pinned by the e2e env).
    const paid = await request(app.getHttpServer())
      .post(`/api/bookings/${created.body.id}/payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'tok_visa_test', idempotencyKey: randomUUID() })
      .expect(201);
    expect(paid.body.payment.amount).toBe(582.5);
    expect(paid.body.booking.status).toBe('CONFIRMED');

    const payment = await prismaTestClient.payment.findFirstOrThrow({ where: { bookingId: created.body.id } });
    const booking = await prismaTestClient.booking.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(Number(payment.amount)).toBe(Number(booking.totalAmount));
  });

  // ---------- Staff catalog management ----------

  it('admin extras endpoints require extras:manage (403 without) and audit catalog writes', async () => {
    const plain = await loginAs('extras-plain@test.dev');
    await request(app.getHttpServer())
      .post('/api/admin/extras')
      .set('Authorization', `Bearer ${plain}`)
      .send({ code: 'MEAL_VEC', name: 'Vegan meal', price: 11, currency: 'EUR', category: 'MEAL', pricingUnit: 'PER_ITEM', maxQuantity: 1, requiresPassenger: true })
      .expect(403);

    const staff = await loginAs('extras-staff@test.dev', true);
    const created = await request(app.getHttpServer())
      .post('/api/admin/extras')
      .set('Authorization', `Bearer ${staff}`)
      .send({ code: 'MEAL_VEC', name: 'Vegan meal', price: 11, currency: 'EUR', category: 'MEAL', pricingUnit: 'PER_ITEM', maxQuantity: 1, requiresPassenger: true, metadata: { dietaryTags: ['vegan'] } })
      .expect(201);
    expect(created.body).toMatchObject({ code: 'MEAL_VEC', dietaryTags: ['vegan'] });

    const audit = await prismaTestClient.auditLog.findFirst({ where: { action: 'EXTRA_SERVICE_CREATED', targetId: created.body.id } });
    expect(audit).not.toBeNull();

    // The insurance demo/provider boundary holds over the wire.
    const refused = await request(app.getHttpServer())
      .post('/api/admin/extras')
      .set('Authorization', `Bearer ${staff}`)
      .send({ code: 'INS_REAL', name: 'Real insurance', price: 20, currency: 'EUR', category: 'INSURANCE', pricingUnit: 'PER_PASSENGER', requiresPassenger: true })
      .expect(400);
    expect(refused.body.code).toBe('INSURANCE_PROVIDER_REQUIRED');
  });
});
