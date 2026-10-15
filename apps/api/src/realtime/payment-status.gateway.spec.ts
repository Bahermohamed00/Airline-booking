import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Server, Socket } from 'socket.io';
import { PaymentStatusGateway } from './payment-status.gateway';
import { RealtimeEventsService } from './realtime-events.service';
import type { AuthUser } from '../auth/decorators/current-user.decorator';

const BOOKING = 'b1c2d3e4-1111-4222-8333-944455556666';

const authUser: AuthUser = {
  userId: 'user-1',
  email: 'customer@example.com',
  firstName: 'Aya',
  lastName: 'Mansour',
  dateOfBirth: null,
  emailVerified: true,
  mfaEnabled: false,
  roles: ['Customer'],
  permissions: [],
  sessionId: 'session-1',
};

interface FakeSocket {
  id: string;
  handshake: { auth: Record<string, unknown>; headers: Record<string, string> };
  data: Record<string, unknown>;
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

const fakeSocket = (
  overrides: { token?: string; header?: string; user?: AuthUser } = {},
): FakeSocket => ({
  id: 'socket-1',
  handshake: {
    auth: overrides.token ? { token: overrides.token } : {},
    headers: overrides.header ? { authorization: overrides.header } : {},
  },
  data: overrides.user ? { user: overrides.user } : {},
  join: vi.fn().mockResolvedValue(undefined),
  leave: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
});

describe('PaymentStatusGateway', () => {
  let gateway: PaymentStatusGateway;
  let jwt: { verifyAsync: ReturnType<typeof vi.fn> };
  let jwtStrategy: { validate: ReturnType<typeof vi.fn> };
  let prisma: { booking: { findFirst: ReturnType<typeof vi.fn> } };
  let events: RealtimeEventsService;

  beforeEach(() => {
    jwt = { verifyAsync: vi.fn() };
    jwtStrategy = { validate: vi.fn() };
    prisma = { booking: { findFirst: vi.fn() } };
    events = new RealtimeEventsService();
    gateway = new PaymentStatusGateway(
      jwt as never,
      jwtStrategy as never,
      prisma as never,
      events,
    );
  });

  describe('connection authentication', () => {
    it('disconnects clients without a token', async () => {
      const socket = fakeSocket();
      await gateway.handleConnection(socket as unknown as Socket);
      expect(jwt.verifyAsync).not.toHaveBeenCalled();
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.data['user']).toBeUndefined();
    });

    it('disconnects clients whose token fails verification', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
      const socket = fakeSocket({ token: 'bad-token' });
      await gateway.handleConnection(socket as unknown as Socket);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.data['user']).toBeUndefined();
    });

    it('disconnects when the session is revoked or the user inactive (JwtStrategy rules)', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', sid: 'session-1', type: 'access' });
      jwtStrategy.validate.mockRejectedValue(new Error('Session expired or revoked'));
      const socket = fakeSocket({ token: 'valid-jwt' });
      await gateway.handleConnection(socket as unknown as Socket);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.data['user']).toBeUndefined();
    });

    it('attaches the authenticated user for a valid access token', async () => {
      const payload = { sub: 'user-1', sid: 'session-1', type: 'access' };
      jwt.verifyAsync.mockResolvedValue(payload);
      jwtStrategy.validate.mockResolvedValue(authUser);
      const socket = fakeSocket({ token: 'valid-jwt' });
      await gateway.handleConnection(socket as unknown as Socket);
      expect(jwtStrategy.validate).toHaveBeenCalledWith(payload);
      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.data['user']).toEqual(authUser);
    });

    it('accepts a Bearer token via the Authorization header as a fallback', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', sid: 's', type: 'access' });
      jwtStrategy.validate.mockResolvedValue(authUser);
      const socket = fakeSocket({ header: 'Bearer header-token' });
      await gateway.handleConnection(socket as unknown as Socket);
      expect(jwt.verifyAsync).toHaveBeenCalledWith('header-token');
      expect(socket.data['user']).toEqual(authUser);
    });
  });

  describe('subscription authorization', () => {
    it('refuses unauthenticated sockets', async () => {
      const socket = fakeSocket();
      const ack = await gateway.handleSubscribe(socket as unknown as Socket, {
        bookingId: BOOKING,
      });
      expect(ack).toEqual({ ok: false });
      expect(prisma.booking.findFirst).not.toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('refuses malformed booking ids without querying', async () => {
      const socket = fakeSocket({ user: authUser });
      const ack = await gateway.handleSubscribe(socket as unknown as Socket, {
        bookingId: 'not-a-uuid',
      });
      expect(ack).toEqual({ ok: false });
      expect(prisma.booking.findFirst).not.toHaveBeenCalled();
    });

    it("refuses bookings the customer does not own — no existence leak, no room join", async () => {
      prisma.booking.findFirst.mockResolvedValue(null); // foreign or unknown id
      const socket = fakeSocket({ user: authUser });
      const ack = await gateway.handleSubscribe(socket as unknown as Socket, {
        bookingId: BOOKING,
      });
      expect(prisma.booking.findFirst).toHaveBeenCalledWith({
        where: { id: BOOKING, userId: 'user-1' },
        select: { id: true },
      });
      expect(ack).toEqual({ ok: false });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('joins the booking room only after ownership is confirmed', async () => {
      prisma.booking.findFirst.mockResolvedValue({ id: BOOKING });
      const socket = fakeSocket({ user: authUser });
      const ack = await gateway.handleSubscribe(socket as unknown as Socket, {
        bookingId: BOOKING,
      });
      expect(ack).toEqual({ ok: true });
      expect(socket.join).toHaveBeenCalledWith(`booking:${BOOKING}`);
    });

    it('unsubscribe leaves the room', async () => {
      const socket = fakeSocket({ user: authUser });
      await gateway.handleUnsubscribe(socket as unknown as Socket, { bookingId: BOOKING });
      expect(socket.leave).toHaveBeenCalledWith(`booking:${BOOKING}`);
    });
  });

  describe('event emission', () => {
    it('publishes a minimal payload to the booking room only — never broadcast', () => {
      const emit = vi.fn();
      const to = vi.fn().mockReturnValue({ emit });
      const server = { to } as unknown as Server;
      gateway.afterInit(server);

      events.emitPaymentStatus({
        bookingId: BOOKING,
        paymentId: 'pay-1',
        status: 'SUCCESS',
      });

      expect(to).toHaveBeenCalledWith(`booking:${BOOKING}`);
      expect(emit).toHaveBeenCalledWith('payment.status', {
        bookingId: BOOKING,
        paymentId: 'pay-1',
        status: 'SUCCESS',
      });
    });

    it('is a safe no-op before the server is attached', () => {
      expect(() =>
        events.emitPaymentStatus({
          bookingId: BOOKING,
          paymentId: 'pay-1',
          status: 'FAILED',
        }),
      ).not.toThrow();
    });
  });
});
