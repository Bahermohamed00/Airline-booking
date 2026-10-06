import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  prismaTestClient,
  registerVerifiedUser,
  resetDatabase,
} from './test-utils.js';

const PASSWORD = 'Password123!';

describe('Admin baggage API (e2e)', () => {
  let app: INestApplication<App>;
  let roleIds: Record<string, string>;
  let baggageId: string;

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

  afterAll(async () => {
    await app.close();
    await prismaTestClient.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);

    const baggageManage = await prismaTestClient.permission.upsert({
      where: { resource_action: { resource: 'baggage', action: 'manage' } },
      update: {},
      create: { resource: 'baggage', action: 'manage' },
    });
    const superAdmin = await prismaTestClient.role.upsert({
      where: { name: 'Super Admin' },
      update: { isSuperAdmin: true },
      create: { name: 'Super Admin', isSuperAdmin: true },
    });
    const support = await prismaTestClient.role.upsert({
      where: { name: 'Support Staff' },
      update: { isSuperAdmin: false },
      create: { name: 'Support Staff', isSuperAdmin: false },
    });
    await prismaTestClient.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: support.id,
          permissionId: baggageManage.id,
        },
      },
      update: {},
      create: { roleId: support.id, permissionId: baggageManage.id },
    });
    const flightManager = await prismaTestClient.role.upsert({
      where: { name: 'Flight Manager' },
      update: { isSuperAdmin: false },
      create: { name: 'Flight Manager', isSuperAdmin: false },
    });
    roleIds = {
      'Super Admin': superAdmin.id,
      'Support Staff': support.id,
      'Flight Manager': flightManager.id,
    };

    // Minimal booking chain: customer → booking → passenger → bookingPassenger → baggage(+1 event)
    const customer = await prismaTestClient.user.create({
      data: {
        email: 'bags@example.com',
        passwordHash: 'x'.repeat(64),
        firstName: 'Bag',
        lastName: 'Owner',
        status: 'ACTIVE',
      },
    });
    const booking = await prismaTestClient.booking.create({
      data: {
        bookingReference: 'NVBAG01',
        userId: customer.id,
        status: 'CONFIRMED',
        totalAmount: 100,
        currency: 'EUR',
        contactEmail: customer.email,
      },
    });
    const passenger = await prismaTestClient.passenger.create({
      data: { userId: customer.id, firstName: 'Bag', lastName: 'Owner' },
    });
    const bookingPassenger = await prismaTestClient.bookingPassenger.create({
      data: { bookingId: booking.id, passengerId: passenger.id },
    });
    const bag = await prismaTestClient.baggage.create({
      data: {
        bookingPassengerId: bookingPassenger.id,
        type: 'CHECKED',
        weightKg: 18,
        tagNumber: 'NV00000009',
        status: 'CHECKED_IN',
        events: {
          create: [{ eventType: 'CHECKED_IN', location: 'FRA Terminal 1' }],
        },
      },
    });
    baggageId = bag.id;
  });

  async function loginAs(email: string, roleName?: string): Promise<string> {
    await registerVerifiedUser(app, {
      email,
      password: PASSWORD,
      firstName: 'Baggage',
      lastName: 'Tester',
    });
    if (roleName) {
      const user = await prismaTestClient.user.findUniqueOrThrow({
        where: { email },
      });
      await prismaTestClient.userRole.create({
        data: { userId: user.id, roleId: roleIds[roleName]! },
      });
    }
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/baggage');
    expect(res.status).toBe(401);
  });

  it('rejects staff without baggage:manage with 403', async () => {
    const token = await loginAs('fm@baggage.test', 'Flight Manager');
    const res = await request(app.getHttpServer())
      .get('/api/admin/baggage')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('lists baggage with events and passenger/booking context', async () => {
    const token = await loginAs('admin@baggage.test', 'Super Admin');
    const res = await request(app.getHttpServer())
      .get('/api/admin/baggage')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const row = res.body[0];
    expect(row.tagNumber).toBe('NV00000009');
    expect(row.events).toHaveLength(1);
    expect(row.bookingPassenger.passenger.firstName).toBe('Bag');
    expect(row.bookingPassenger.booking.bookingReference).toBe('NVBAG01');
  });

  it('records an event, flips the status, and writes a BAGGAGE_EVENT_RECORDED audit row', async () => {
    const token = await loginAs('support@baggage.test', 'Support Staff');

    const res = await request(app.getHttpServer())
      .post(`/api/admin/baggage/${baggageId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ eventType: 'DELAYED', location: 'JFK Baggage Services' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DELAYED');
    expect(res.body.events).toHaveLength(2);

    const stored = await prismaTestClient.baggage.findUniqueOrThrow({
      where: { id: baggageId },
    });
    expect(stored.status).toBe('DELAYED');

    const audit = await prismaTestClient.auditLog.findFirstOrThrow({
      where: { action: 'BAGGAGE_EVENT_RECORDED' },
    });
    expect(audit.actorType).toBe('Staff');
    expect(audit.metadata).toMatchObject({
      tagNumber: 'NV00000009',
      eventType: 'DELAYED',
      location: 'JFK Baggage Services',
    });
  });

  it('returns 404 for an unknown baggage id', async () => {
    const token = await loginAs('admin@baggage.test', 'Super Admin');
    const res = await request(app.getHttpServer())
      .post(`/api/admin/baggage/${randomUUID()}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ eventType: 'DELIVERED', location: 'FRA' });
    expect(res.status).toBe(404);
  });

  it('returns 400 for an invalid event type or empty location', async () => {
    const token = await loginAs('admin@baggage.test', 'Super Admin');

    const badType = await request(app.getHttpServer())
      .post(`/api/admin/baggage/${baggageId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ eventType: 'TELEPORTED', location: 'FRA' });
    expect(badType.status).toBe(400);

    const emptyLocation = await request(app.getHttpServer())
      .post(`/api/admin/baggage/${baggageId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ eventType: 'DELIVERED', location: '' });
    expect(emptyLocation.status).toBe(400);
  });
});
