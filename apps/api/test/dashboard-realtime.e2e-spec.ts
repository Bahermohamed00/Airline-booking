import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { prismaTestClient, registerVerifiedUser, resetDatabase } from './test-utils.js';

const PASSWORD = 'Password123!';

/**
 * Dashboard real-time channel (e2e): real Socket.IO server on an ephemeral
 * port, real JWT auth + dashboard:read permission, in-memory event bus (no
 * REDIS_URL in the test env). Events are invalidation notifications only.
 */
describe('Dashboard realtime gateway (e2e)', () => {
  let app: INestApplication<App>;
  let port: number;
  let opsRoleId: string;
  let routeId: string;
  let aircraftId: string;

  const sockets: Socket[] = [];

  beforeAll(async () => {
    // Force the in-memory bus regardless of any developer .env REDIS_URL.
    process.env['REDIS_URL'] = '';
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaTestClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    port = typeof address === 'object' && address ? address.port : 0;
  });

  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    await app.close();
    await prismaTestClient.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prismaTestClient);

    const [dashRead, flightsManage] = await Promise.all([
      prismaTestClient.permission.upsert({
        where: { resource_action: { resource: 'dashboard', action: 'read' } },
        update: {},
        create: { resource: 'dashboard', action: 'read' },
      }),
      prismaTestClient.permission.upsert({
        where: { resource_action: { resource: 'flights', action: 'manage' } },
        update: {},
        create: { resource: 'flights', action: 'manage' },
      }),
    ]);
    const role = await prismaTestClient.role.create({ data: { name: 'Ops Manager', isSuperAdmin: false } });
    opsRoleId = role.id;
    await prismaTestClient.rolePermission.createMany({
      data: [
        { roleId: role.id, permissionId: dashRead.id },
        { roleId: role.id, permissionId: flightsManage.id },
      ],
    });

    const [fra, jfk] = await Promise.all([
      prismaTestClient.airport.create({
        data: { iataCode: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin' },
      }),
      prismaTestClient.airport.create({
        data: { iataCode: 'JFK', name: 'JFK International', city: 'New York', country: 'United States', timezone: 'America/New_York' },
      }),
    ]);
    const route = await prismaTestClient.route.create({
      data: { originAirportId: fra.id, destinationAirportId: jfk.id, distanceKm: 6201, durationMinutes: 505 },
    });
    routeId = route.id;
    const aircraft = await prismaTestClient.aircraft.create({
      data: { registration: 'NV-WS01', model: 'Test Jet 100', capacity: 12 },
    });
    aircraftId = aircraft.id;
  });

  async function loginAs(email: string, roleId?: string): Promise<string> {
    await registerVerifiedUser(app, { email, password: PASSWORD, firstName: 'Ws', lastName: 'Tester' });
    if (roleId) {
      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
      await prismaTestClient.userRole.create({ data: { userId: user.id, roleId } });
    }
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  function connect(token?: string): Socket {
    const socket = io(`http://127.0.0.1:${port}/dashboard`, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  }

  function waitForEvent(socket: Socket, event: string, timeoutMs = 5000): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeoutMs);
      socket.on(event, (payload: Record<string, unknown>) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  function waitForConnect(socket: Socket, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('connect timeout')), timeoutMs);
      socket.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  const CREATE_BODY = {
    departureDate: '2026-10-05',
    departureTime: '08:00',
    arrivalDate: '2026-10-05',
    arrivalTime: '11:25',
    flightNumber: 'NV700',
    price: 250,
  };

  it('an authenticated ops client receives flight.created after a successful creation', async () => {
    const token = await loginAs('ops@ws.test', opsRoleId);
    const socket = connect(token);
    await waitForConnect(socket);
    const eventPromise = waitForEvent(socket, 'dashboard.invalidate');

    await request(app.getHttpServer())
      .post('/api/flights')
      .set('Authorization', `Bearer ${token}`)
      .send({ routeId, aircraftId, ...CREATE_BODY })
      .expect(201);

    const event = await eventPromise;
    expect(event['type']).toBe('flight.created');
    expect(event['at']).toBeDefined();
    // Invalidation only — the event must not carry statistics.
    expect(Object.keys(event).sort()).toEqual(['at', 'type']);
  });

  it('emits nothing when the creation fails validation', async () => {
    const token = await loginAs('ops2@ws.test', opsRoleId);
    const socket = connect(token);
    await waitForConnect(socket);

    const events: string[] = [];
    socket.on('dashboard.invalidate', (p: { type: string }) => events.push(p.type));

    await request(app.getHttpServer())
      .post('/api/flights')
      .set('Authorization', `Bearer ${token}`)
      .send({ routeId, aircraftId, departureDate: 'not-a-date' })
      .expect(400);

    await new Promise((r) => setTimeout(r, 400));
    expect(events).toEqual([]);
  });

  it('emits flight.status.changed and flight.cancelled for a manual cancellation', async () => {
    const token = await loginAs('ops3@ws.test', opsRoleId);
    const socket = connect(token);
    await waitForConnect(socket);

    const created = await request(app.getHttpServer())
      .post('/api/flights')
      .set('Authorization', `Bearer ${token}`)
      .send({ routeId, aircraftId, ...CREATE_BODY })
      .expect(201);

    const received: string[] = [];
    socket.on('dashboard.invalidate', (p: { type: string }) => received.push(p.type));

    await request(app.getHttpServer())
      .patch(`/api/flights/${created.body.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'CANCELLED' })
      .expect(200);

    await new Promise((r) => setTimeout(r, 400));
    expect(received).toContain('flight.status.changed');
    expect(received).toContain('flight.cancelled');
  });

  it('emits schedule-rule.created for a rule mutation', async () => {
    const token = await loginAs('ops4@ws.test', opsRoleId);
    const socket = connect(token);
    await waitForConnect(socket);
    const eventPromise = waitForEvent(socket, 'dashboard.invalidate');

    await request(app.getHttpServer())
      .post('/api/schedule-rules')
      .set('Authorization', `Bearer ${token}`)
      .send({
        routeId,
        aircraftId,
        flightNumber: 'NV300',
        departureTimeLocal: '08:00',
        operatingDays: ['MON'],
        effectiveFrom: '2026-10-01',
        effectiveTo: '2026-12-31',
      })
      .expect(201);

    expect((await eventPromise)['type']).toBe('schedule-rule.created');
  });

  it('rejects clients without a token or without dashboard:read', async () => {
    const anonymous = connect(undefined);
    const anonDisconnected = waitForEvent(anonymous, 'disconnect');
    await expect(anonDisconnected).resolves.toBeDefined();

    const customerToken = await loginAs('customer@ws.test');
    const customer = connect(customerToken);
    const customerDisconnected = waitForEvent(customer, 'disconnect');
    await expect(customerDisconnected).resolves.toBeDefined();
  });
});
