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
 * Customer Support workflow (e2e): customer submits a complaint → Support Staff
 * sees it → claims → IN_PROGRESS → resolves → RESOLVED → closes → CLOSED →
 * reopen path — plus RBAC, validation, and audit persistence.
 */
describe('Support tickets (e2e)', () => {
  let app: INestApplication<App>;
  let supportRoleId: string;

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
    const [read, manage] = await Promise.all([
      prismaTestClient.permission.upsert({
        where: { resource_action: { resource: 'support', action: 'read' } },
        update: {},
        create: { resource: 'support', action: 'read' },
      }),
      prismaTestClient.permission.upsert({
        where: { resource_action: { resource: 'support', action: 'manage' } },
        update: {},
        create: { resource: 'support', action: 'manage' },
      }),
    ]);
    const role = await prismaTestClient.role.create({ data: { name: 'Support Staff', isSuperAdmin: false } });
    supportRoleId = role.id;
    await prismaTestClient.rolePermission.createMany({
      data: [
        { roleId: role.id, permissionId: read.id },
        { roleId: role.id, permissionId: manage.id },
      ],
    });
  });

  async function loginAs(email: string, support = false): Promise<string> {
    await registerVerifiedUser(app, { email, password: PASSWORD, firstName: 'Case', lastName: 'Tester' });
    if (support) {
      const user = await prismaTestClient.user.findUniqueOrThrow({ where: { email } });
      await prismaTestClient.userRole.create({ data: { userId: user.id, roleId: supportRoleId } });
    }
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  const VALID_BODY = { subject: 'Cannot log in', description: 'My password stopped working today.' };

  it('walks the full lifecycle: customer submits → staff claims → resolves → closes', async () => {
    const customerToken = await loginAs('customer@support.test');
    const customer = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'customer@support.test' } });

    // 1–2. Authenticated customer submits; ticket is created OPEN.
    const created = await request(app.getHttpServer())
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(VALID_BODY)
      .expect(201);
    expect(created.body.ticketNumber).toMatch(/^NT[A-Z0-9]{6}$/);
    expect(created.body.status).toBe('OPEN');

    const stored = await prismaTestClient.supportTicket.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stored.userId).toBe(customer.id); // identity from JWT, not the body
    expect(stored.status).toBe('OPEN');

    const createdAudit = await prismaTestClient.auditLog.findFirstOrThrow({ where: { action: 'TICKET_CREATED' } });
    expect(createdAudit.actorId).toBe(customer.id);
    expect(createdAudit.actorType).toBe('User');
    expect(createdAudit.metadata).toEqual({ ticketNumber: created.body.ticketNumber });

    // The customer sees their own ticket in history.
    const mine = await request(app.getHttpServer())
      .get('/api/support/tickets/mine')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(mine.body.map((t: { id: string }) => t.id)).toEqual([created.body.id]);

    // 3. Support Staff sees it in the dashboard list with customer identity.
    const staffToken = await loginAs('agent@support.test', true);
    const agent = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'agent@support.test' } });
    const list = await request(app.getHttpServer())
      .get('/api/admin/support/tickets')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(list.body.total).toBe(1);
    const item = list.body.items[0];
    expect(item.ticketNumber).toBe(created.body.ticketNumber);
    expect(item.customer.email).toBe('customer@support.test');
    // Agents get the callback number, but no personal profile data beyond contact details.
    expect(item.customer.phone).toBe('+49 170 1234567');
    const ticketPayload = JSON.stringify(item);
    for (const forbidden of ['streetAddress', 'dateOfBirth', 'nationalId']) {
      expect(ticketPayload).not.toContain(forbidden);
    }
    expect(item.status).toBe('OPEN');

    // Detail view carries the full complaint.
    const detail = await request(app.getHttpServer())
      .get(`/api/admin/support/tickets/${created.body.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(detail.body.description).toBe(VALID_BODY.description);

    // 4–5. Claim → IN_PROGRESS with assignee; TICKET_CLAIMED audited.
    const claimed = await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    expect(claimed.body.status).toBe('IN_PROGRESS');
    expect(claimed.body.assignee.id).toBe(agent.id);
    expect(
      await prismaTestClient.auditLog.findFirstOrThrow({ where: { action: 'TICKET_CLAIMED' } }),
    ).toMatchObject({ actorId: agent.id, actorType: 'Staff' });

    // Claiming again is an invalid transition.
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(400);

    // 6. Resolve → RESOLVED with resolvedAt.
    const resolved = await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${created.body.id}/resolve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    expect(resolved.body.status).toBe('RESOLVED');
    expect(resolved.body.resolvedAt).not.toBeNull();

    // 8. Reopen: RESOLVED → OPEN, resolvedAt cleared, TICKET_REOPENED audited.
    const reopened = await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${created.body.id}/reopen`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    expect(reopened.body.status).toBe('OPEN');
    expect(reopened.body.resolvedAt).toBeNull();
    expect(await prismaTestClient.auditLog.count({ where: { action: 'TICKET_REOPENED' } })).toBe(1);

    // An OPEN ticket can never be closed directly.
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${created.body.id}/close`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(400);

    // Back through the lifecycle to closure.
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${created.body.id}/claim`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${created.body.id}/resolve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    const closed = await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${created.body.id}/close`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    expect(closed.body.status).toBe('CLOSED');
    expect(closed.body.closedAt).not.toBeNull();

    // CLOSED is terminal — even reopen is rejected.
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${created.body.id}/reopen`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(400);

    // History: the ticket remains stored with its full audit trail.
    const final = await prismaTestClient.supportTicket.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(final.status).toBe('CLOSED');
  });

  it('requires authentication for customer submission and rejects invalid bodies', async () => {
    await request(app.getHttpServer()).post('/api/support/tickets').send(VALID_BODY).expect(401);

    const token = await loginAs('customer2@support.test');
    const post = (body: unknown) =>
      request(app.getHttpServer()).post('/api/support/tickets').set('Authorization', `Bearer ${token}`).send(body as never);

    await post({ description: 'no subject at all here' }).expect(400);
    await post({ subject: 'Ab' }).expect(400); // too short
    await post({ subject: 'Valid subject', description: 'short' }).expect(400);
    await post({ ...VALID_BODY, unexpected: 'field' }).expect(400);

    expect(await prismaTestClient.supportTicket.count()).toBe(0);
    expect(await prismaTestClient.auditLog.count({ where: { action: 'TICKET_CREATED' } })).toBe(0);
  });

  it('enforces RBAC: customers get 403 on the agent API, anonymous 401', async () => {
    const customerToken = await loginAs('customer3@support.test');
    const ticket = (
      await request(app.getHttpServer())
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(VALID_BODY)
        .expect(201)
    ).body;

    await request(app.getHttpServer()).get('/api/admin/support/tickets').expect(401);
    await request(app.getHttpServer())
      .get('/api/admin/support/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${ticket.id}/claim`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/admin/support/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);

    // Read-only agent (support:read without manage) cannot mutate.
    const readOnly = await prismaTestClient.role.create({ data: { name: 'Support Reader', isSuperAdmin: false } });
    const read = await prismaTestClient.permission.findFirstOrThrow({
      where: { resource: 'support', action: 'read' },
    });
    await prismaTestClient.rolePermission.create({ data: { roleId: readOnly.id, permissionId: read.id } });
    await registerVerifiedUser(app, { email: 'reader@support.test', password: PASSWORD, firstName: 'Read', lastName: 'Only' });
    const readerUser = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'reader@support.test' } });
    await prismaTestClient.userRole.create({ data: { userId: readerUser.id, roleId: readOnly.id } });
    const readerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'reader@support.test', password: PASSWORD });
    const readerToken = readerLogin.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/api/admin/support/tickets')
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${ticket.id}/claim`)
      .set('Authorization', `Bearer ${readerToken}`)
      .expect(403);
  });

  it('filters the agent list by status, ticket number, and customer email', async () => {
    const customerToken = await loginAs('filter@support.test');
    const otherToken = await loginAs('other@support.test');
    await request(app.getHttpServer())
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(VALID_BODY)
      .expect(201);
    const second = (
      await request(app.getHttpServer())
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ subject: 'General question', description: 'How do I update my profile?' })
        .expect(201)
    ).body;

    const staffToken = await loginAs('agent2@support.test', true);
    const get = (q: string) =>
      request(app.getHttpServer()).get(`/api/admin/support/tickets${q}`).set('Authorization', `Bearer ${staffToken}`);

    expect((await get('').expect(200)).body.total).toBe(2);
    const byNumber = (await get(`?ticketNumber=${second.ticketNumber}`).expect(200)).body;
    expect(byNumber.items.map((t: { id: string }) => t.id)).toEqual([second.id]);
    const byEmail = (await get('?email=filter@').expect(200)).body;
    expect(byEmail.total).toBe(1);
    expect(byEmail.items[0].customer.email).toBe('filter@support.test');
    const byStatus = (await get('?status=RESOLVED').expect(200)).body;
    expect(byStatus.total).toBe(0);
    await get('?status=BOGUS').expect(400);

    // 404 for unknown ticket id.
    await request(app.getHttpServer())
      .get(`/api/admin/support/tickets/${randomUUID()}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(404);
  });

  it('overview returns support-specific counts (no admin statistics)', async () => {
    const customerToken = await loginAs('ov-c@support.test');
    const staffToken = await loginAs('ov-s@support.test', true);
    const post = () =>
      request(app.getHttpServer())
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(VALID_BODY)
        .expect(201);

    const first = (await post()).body;
    await post();

    const before = await request(app.getHttpServer())
      .get('/api/admin/support/overview')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(before.body).toEqual({ total: 2, open: 2, unreadMessages: 2, inProgress: 0, resolved: 0, closed: 0 });

    // Claim one ticket and read its messages → counts move accordingly.
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${first.id}/claim`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${first.id}/read`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/api/admin/support/overview')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(after.body).toEqual({ total: 2, open: 1, unreadMessages: 1, inProgress: 1, resolved: 0, closed: 0 });

    // The response carries nothing but support statistics.
    expect(Object.keys(after.body).sort()).toEqual(['closed', 'inProgress', 'open', 'resolved', 'total', 'unreadMessages']);
  });

  it('inbox unread badge lifecycle: unread on creation, cleared after opening the conversation', async () => {
    const customerToken = await loginAs('badge-c@support.test');
    const staffToken = await loginAs('badge-s@support.test', true);

    const ticket = (
      await request(app.getHttpServer())
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(VALID_BODY)
        .expect(201)
    ).body;

    // The opening complaint is stored as an unread CUSTOMER message.
    const list = await request(app.getHttpServer())
      .get('/api/admin/support/tickets')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(list.body.items[0].unreadCount).toBe(1);
    expect(list.body.items[0].lastMessageAt).toBeDefined();

    const conversation = await request(app.getHttpServer())
      .get(`/api/admin/support/tickets/${ticket.id}/messages`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(conversation.body.messages).toHaveLength(1);
    expect(conversation.body.messages[0]).toMatchObject({
      senderType: 'CUSTOMER',
      body: VALID_BODY.description,
      deliveryStatus: 'NONE',
    });

    // Opening the conversation marks it read — badge disappears.
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${ticket.id}/read`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    const after = await request(app.getHttpServer())
      .get('/api/admin/support/tickets')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(after.body.items[0].unreadCount).toBe(0);
  });

  it('reply flow: stored SENT message, audit, customer-side visibility, closed-ticket rejection', async () => {
    const customerToken = await loginAs('reply-c@support.test');
    const staffToken = await loginAs('reply-s@support.test', true);
    const agent = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'reply-s@support.test' } });

    const ticket = (
      await request(app.getHttpServer())
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(VALID_BODY)
        .expect(201)
    ).body;
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${ticket.id}/claim`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);

    const reply = await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${ticket.id}/replies`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ body: 'We reset your password — please try again.' })
      .expect(201);
    expect(reply.body).toMatchObject({
      senderType: 'SUPPORT_STAFF',
      senderId: agent.id,
      deliveryStatus: 'SENT',
    });

    const audit = await prismaTestClient.auditLog.findFirstOrThrow({ where: { action: 'TICKET_MESSAGE_SENT' } });
    expect(audit).toMatchObject({ actorId: agent.id, actorType: 'Staff' });
    expect(audit.metadata).toEqual({ ticketNumber: ticket.ticketNumber });

    // The customer sees the full conversation, including the reply (and never ticket internals beyond their own).
    const customerView = await request(app.getHttpServer())
      .get(`/api/support/tickets/${ticket.id}/messages`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(customerView.body.messages.map((m: { senderType: string }) => m.senderType)).toEqual([
      'CUSTOMER',
      'SUPPORT_STAFF',
    ]);

    // Another customer cannot read this conversation (404, no existence leak).
    const otherToken = await loginAs('reply-other@support.test');
    await request(app.getHttpServer())
      .get(`/api/support/tickets/${ticket.id}/messages`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    // Customers cannot use agent endpoints for messages/read/replies.
    await request(app.getHttpServer())
      .get(`/api/admin/support/tickets/${ticket.id}/messages`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${ticket.id}/replies`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'x' })
      .expect(403);

    // Resolve + close, then a reply is rejected.
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${ticket.id}/resolve`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${ticket.id}/close`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${ticket.id}/replies`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ body: 'late reply' })
      .expect(400);
  });

  it('unread filter returns only tickets with unread customer messages, with exact counts', async () => {
    const customerToken = await loginAs('unread-c@support.test');
    const staffToken = await loginAs('unread-s@support.test', true);

    const mk = async (subject: string) =>
      (
        await request(app.getHttpServer())
          .post('/api/support/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ subject, description: VALID_BODY.description })
          .expect(201)
      ).body;

    const a = await mk('Ticket A'); // will get 3 unread customer messages
    const b = await mk('Ticket B'); // will be read → excluded
    const c = await mk('Ticket C'); // 1 unread
    for (const body of ['follow-up 1', 'follow-up 2']) {
      await request(app.getHttpServer())
        .post(`/api/support/tickets/${a.id}/messages`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ body })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${b.id}/read`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);

    const unread = await request(app.getHttpServer())
      .get('/api/admin/support/tickets?unreadOnly=true')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);

    const ids = unread.body.items.map((t: { id: string }) => t.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(c.id);
    expect(ids).not.toContain(b.id);
    const aItem = unread.body.items.find((t: { id: string }) => t.id === a.id);
    expect(aItem.unreadCount).toBe(3); // opening message + 2 follow-ups
    const cItem = unread.body.items.find((t: { id: string }) => t.id === c.id);
    expect(cItem.unreadCount).toBe(1);

    // A staff reply does not increase the unread count.
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${c.id}/claim`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${c.id}/replies`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ body: 'staff answer' })
      .expect(201);
    const unreadAfter = await request(app.getHttpServer())
      .get(`/api/admin/support/tickets?unreadOnly=true&ticketNumber=${c.ticketNumber}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(unreadAfter.body.items[0].unreadCount).toBe(1);
  });

  it('history: closed-only list with search, date range, combined filters, and pagination', async () => {
    const customerToken = await loginAs('hist-c@support.test');
    const staffToken = await loginAs('hist-s@support.test', true);
    const agent = await prismaTestClient.user.findUniqueOrThrow({ where: { email: 'hist-s@support.test' } });

    const mk = async (subject: string) =>
      (
        await request(app.getHttpServer())
          .post('/api/support/tickets')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ subject, description: VALID_BODY.description })
          .expect(201)
      ).body;

    const closed1 = await mk('Password reset help');
    const closed2 = await mk('Profile update question');
    const openOne = await mk('Still open issue');

    for (const t of [closed1, closed2]) {
      await prismaTestClient.supportTicket.update({
        where: { id: t.id },
        data: { status: 'CLOSED', closedAt: new Date('2026-10-05T10:00:00Z'), assigneeId: agent.id },
      });
    }
    // A ticket closed outside the requested date range.
    const oldClosed = await mk('Ancient resolved issue');
    await prismaTestClient.supportTicket.update({
      where: { id: oldClosed.id },
      data: { status: 'CLOSED', closedAt: new Date('2026-09-01T10:00:00Z') },
    });

    const get = (q: string) =>
      request(app.getHttpServer())
        .get(`/api/admin/support/tickets${q}`)
        .set('Authorization', `Bearer ${staffToken}`);

    // Only CLOSED tickets appear; OPEN never leaks into history.
    const closed = (await get('?status=CLOSED').expect(200)).body;
    expect(closed.total).toBe(3);
    expect(closed.items.map((t: { id: string }) => t.id)).not.toContain(openOne.id);
    expect(closed.items.every((t: { status: string }) => t.status === 'CLOSED')).toBe(true);
    expect(closed.items.find((t: { id: string }) => t.id === closed1.id).assignee.firstName).toBe('Case');

    // Search: subject matches one; customer name/email match all of that customer's tickets.
    expect((await get('?status=CLOSED&search=Password').expect(200)).body.total).toBe(1);
    expect((await get('?status=CLOSED&search=Profile').expect(200)).body.total).toBe(1);
    expect((await get('?status=CLOSED&search=hist-c@support.test').expect(200)).body.total).toBe(3);
    expect((await get(`?status=CLOSED&ticketNumber=${closed2.ticketNumber}`).expect(200)).body.total).toBe(1);

    // Date range on closedAt.
    const inRange = (await get('?status=CLOSED&closedFrom=2026-10-01&closedTo=2026-10-07').expect(200)).body;
    expect(inRange.total).toBe(2);
    expect(inRange.items.map((t: { id: string }) => t.id)).not.toContain(oldClosed.id);

    // Combined search + date range.
    const combined = (await get('?status=CLOSED&search=Profile&closedFrom=2026-10-01&closedTo=2026-10-07').expect(200)).body;
    expect(combined.total).toBe(1);
    expect(combined.items[0].id).toBe(closed2.id);

    // Pagination contract.
    const page1 = (await get('?status=CLOSED&page=1&limit=2').expect(200)).body;
    expect(page1).toMatchObject({ total: 3, page: 1, limit: 2, totalPages: 2 });
    expect(page1.items).toHaveLength(2);
    const page2 = (await get('?status=CLOSED&page=2&limit=2').expect(200)).body;
    expect(page2.items).toHaveLength(1);
    expect(page2.totalPages).toBe(2);
  });

  it('a customer message on a CLOSED ticket reopens it and resurfaces it in the active inbox', async () => {
    const customerToken = await loginAs('re-c@support.test');
    const staffToken = await loginAs('re-s@support.test', true);

    const ticket = (
      await request(app.getHttpServer())
        .post('/api/support/tickets')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(VALID_BODY)
        .expect(201)
    ).body;
    // Read the opening message before closing so the follow-up is the only unread one.
    await request(app.getHttpServer())
      .post(`/api/admin/support/tickets/${ticket.id}/read`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);
    await prismaTestClient.supportTicket.update({
      where: { id: ticket.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    await request(app.getHttpServer())
      .post(`/api/support/tickets/${ticket.id}/messages`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ body: 'The problem came back.' })
      .expect(201);

    const reopened = await prismaTestClient.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(reopened.status).toBe('OPEN');
    expect(reopened.closedAt).toBeNull();

    // Visible in the active inbox (not just History) with exactly 1 unread message.
    const unread = await request(app.getHttpServer())
      .get('/api/admin/support/tickets?unreadOnly=true')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(unread.body.items.map((t: { id: string }) => t.id)).toContain(ticket.id);
    expect(unread.body.items[0].unreadCount).toBe(1);

    // Reopen is audited with the customer as actor.
    const audit = await prismaTestClient.auditLog.findFirstOrThrow({ where: { action: 'TICKET_REOPENED' } });
    expect(audit.actorType).toBe('User');
    expect(audit.metadata).toEqual({ ticketNumber: ticket.ticketNumber, previousStatus: 'CLOSED', newStatus: 'OPEN' });

    // Conversation history is preserved (opening message + follow-up).
    const conversation = await request(app.getHttpServer())
      .get(`/api/admin/support/tickets/${ticket.id}/messages`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(conversation.body.messages).toHaveLength(2);
  });
});
