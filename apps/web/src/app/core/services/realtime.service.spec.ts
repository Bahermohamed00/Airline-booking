import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RealtimeService, type BookingRealtimeEvent } from './realtime.service';
import { AuthService } from './auth.service';
import { API_CONFIG } from '../config/api-config';

type Handler = (...args: unknown[]) => void;

/** Minimal in-memory Socket.IO client double — event registry + emit log. */
class FakeSocket {
  readonly handlers = new Map<string, Set<Handler>>();
  readonly emitted: { event: string; payload: unknown }[] = [];
  connected = false;
  connectCalls = 0;
  disconnectCalls = 0;

  on(event: string, cb: Handler): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(cb);
  }

  off(event: string, cb: Handler): void {
    this.handlers.get(event)?.delete(cb);
  }

  emit(event: string, payload: unknown): void {
    this.emitted.push({ event, payload });
  }

  connect(): void {
    this.connectCalls += 1;
    this.connected = true;
    this.fire('connect');
  }

  disconnect(): void {
    this.disconnectCalls += 1;
    this.connected = false;
  }

  fire(event: string, ...args: unknown[]): void {
    for (const cb of [...(this.handlers.get(event) ?? [])]) {
      cb(...args);
    }
  }
}

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
import { io } from 'socket.io-client';

const ioMock = vi.mocked(io);

const BOOKING = 'b1c2d3e4-1111-4222-8333-944455556666';
const OTHER_BOOKING = 'c2d3e4f5-2222-4333-9444-555566667777';

describe('RealtimeService', () => {
  let service: RealtimeService;
  let socket: FakeSocket;
  let accessToken: ReturnType<typeof vi.fn>;

  function setup(useRealApi = true): void {
    socket = new FakeSocket();
    ioMock.mockReset();
    ioMock.mockReturnValue(socket as never);
    accessToken = vi.fn().mockReturnValue('access-token-1');
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { accessToken } },
        {
          provide: API_CONFIG,
          useValue: {
            baseUrl: 'http://api.test/api',
            useRealApi,
            paymentProvider: 'stripe' as const,
            stripePublishableKey: 'pk_test_123',
          },
        },
      ],
    });
    service = TestBed.inject(RealtimeService);
  }

  beforeEach(() => setup());
  afterEach(() => TestBed.resetTestingModule());

  const statusEvent = (bookingId: string, status = 'SUCCESS') => ({
    bookingId,
    paymentId: 'pay-1',
    status,
  });

  it('connects lazily to the API origin with the socket path derived from baseUrl', () => {
    const sub = service.watchBooking(BOOKING).subscribe();
    expect(ioMock).toHaveBeenCalledOnce();
    const [url, options] = ioMock.mock.calls[0];
    expect(url).toBe('http://api.test');
    expect((options as { path: string }).path).toBe('/api/socket.io');
    sub.unsubscribe();
  });

  it('authenticates every (re)connect with the current in-memory access token', () => {
    const sub = service.watchBooking(BOOKING).subscribe();
    const options = ioMock.mock.calls[0][1] as {
      auth: (cb: (payload: { token: string }) => void) => void;
    };
    accessToken.mockReturnValue('fresh-token');
    let payload: { token: string } | undefined;
    options.auth((p) => (payload = p));
    expect(payload).toEqual({ token: 'fresh-token' });
    sub.unsubscribe();
  });

  it('subscribes to the booking room on connect and emits connected(reconnected: false) first', () => {
    const events: BookingRealtimeEvent[] = [];
    const sub = service.watchBooking(BOOKING).subscribe((e) => events.push(e));
    expect(socket.emitted).toContainEqual({
      event: 'booking.subscribe',
      payload: { bookingId: BOOKING },
    });
    expect(events).toEqual([{ kind: 'connected', reconnected: false }]);
    sub.unsubscribe();
  });

  it('flags reconnects and re-sends the subscription after a transport drop', () => {
    const events: BookingRealtimeEvent[] = [];
    const sub = service.watchBooking(BOOKING).subscribe((e) => events.push(e));
    socket.connected = false;
    socket.fire('connect'); // socket.io re-established the connection
    expect(socket.emitted.filter((e) => e.event === 'booking.subscribe')).toHaveLength(2);
    expect(events.at(-1)).toEqual({ kind: 'connected', reconnected: true });
    sub.unsubscribe();
  });

  it('forwards payment.status only for the watched booking and only known statuses', () => {
    const events: BookingRealtimeEvent[] = [];
    const sub = service.watchBooking(BOOKING).subscribe((e) => events.push(e));

    socket.fire('payment.status', statusEvent(OTHER_BOOKING));
    socket.fire('payment.status', { bookingId: BOOKING, paymentId: 'pay-1', status: 'charged' });
    socket.fire('payment.status', statusEvent(BOOKING, 'SUCCESS'));

    expect(events.filter((e) => e.kind === 'payment.status')).toEqual([
      { kind: 'payment.status', bookingId: BOOKING, paymentId: 'pay-1', status: 'SUCCESS' },
    ]);
    sub.unsubscribe();
  });

  it('shares one socket across watchers and disconnects when the last one goes away', () => {
    const first = service.watchBooking(BOOKING).subscribe();
    const second = service.watchBooking(OTHER_BOOKING).subscribe();
    expect(ioMock).toHaveBeenCalledOnce();

    first.unsubscribe();
    expect(socket.disconnectCalls).toBe(0);
    expect(socket.emitted).toContainEqual({
      event: 'booking.unsubscribe',
      payload: { bookingId: BOOKING },
    });

    second.unsubscribe();
    expect(socket.disconnectCalls).toBe(1);
  });

  it('stops delivering events to an unsubscribed watcher', () => {
    const events: BookingRealtimeEvent[] = [];
    const sub = service.watchBooking(BOOKING).subscribe((e) => events.push(e));
    sub.unsubscribe();
    socket.fire('payment.status', statusEvent(BOOKING));
    expect(events.filter((e) => e.kind === 'payment.status')).toHaveLength(0);
  });

  it('retries a server-side disconnect once a token is available again', () => {
    vi.useFakeTimers();
    const sub = service.watchBooking(BOOKING).subscribe();
    socket.connected = false;
    socket.fire('disconnect', 'io server disconnect');
    expect(socket.connectCalls).toBe(1); // the initial connect only

    vi.advanceTimersByTime(1000);
    expect(socket.connectCalls).toBe(2);

    // Transport drops are left to socket.io's own reconnection — no manual retry.
    socket.fire('disconnect', 'transport close');
    vi.advanceTimersByTime(5000);
    expect(socket.connectCalls).toBe(2);
    sub.unsubscribe();
    vi.useRealTimers();
  });

  it('does not retry a server-side disconnect without an access token', () => {
    vi.useFakeTimers();
    const sub = service.watchBooking(BOOKING).subscribe();
    socket.connected = false;
    accessToken.mockReturnValue(null);
    socket.fire('disconnect', 'io server disconnect');
    vi.advanceTimersByTime(5000);
    expect(socket.connectCalls).toBe(1);
    sub.unsubscribe();
    vi.useRealTimers();
  });

  it('surfaces server-side message rejections as observable warnings, not silent failures', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const sub = service.watchBooking(BOOKING).subscribe();

    socket.fire('exception', { status: 'error', message: 'Forbidden' });

    expect(warn).toHaveBeenCalledWith(
      '[realtime] server rejected a realtime message:',
      { status: 'error', message: 'Forbidden' },
    );
    warn.mockRestore();
    sub.unsubscribe();
  });

  it('never connects in mock-data mode (no realtime backend)', () => {
    TestBed.resetTestingModule();
    setup(false);
    const events: BookingRealtimeEvent[] = [];
    const sub = service.watchBooking(BOOKING).subscribe((e) => events.push(e));
    expect(ioMock).not.toHaveBeenCalled();
    expect(events).toEqual([]);
    sub.unsubscribe();
  });
});
