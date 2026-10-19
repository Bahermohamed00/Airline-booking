import { Service, inject, type OnDestroy } from '@angular/core';
import { io, type Socket } from 'socket.io-client';
import { NEVER, Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import { AuthService } from './auth.service';

/** Normalized customer-facing payment states pushed by the API gateway. */
export type PaymentStatusPush = 'PENDING' | 'SUCCESS' | 'FAILED';

/**
 * Minimal push payload (identifiers + normalized status only). Never proof of
 * payment on its own — consumers reconcile with the authoritative REST API.
 */
export interface PaymentStatusEvent {
  kind: 'payment.status';
  bookingId: string;
  paymentId: string;
  status: PaymentStatusPush;
}

/** The socket (re)connected — after a reconnect, events may have been missed. */
export interface RealtimeConnectedEvent {
  kind: 'connected';
  reconnected: boolean;
}

export type BookingRealtimeEvent = PaymentStatusEvent | RealtimeConnectedEvent;

/** Delay before retrying a server-side disconnect (e.g. token raced a refresh). */
const SERVER_DISCONNECT_RETRY_MS = 1000;

/**
 * Socket.IO client for customer booking/payment status push.
 *
 * - One lazily-created shared socket, reference-counted by watchers; the last
 *   unsubscribe disconnects it (no lingering connections on other pages).
 * - Auth uses the in-memory access token via socket.io's `auth` callback, so
 *   every (re)connect attempt sends the current token — tokens are never
 *   persisted here.
 * - The server authorizes each `booking.subscribe` against booking ownership;
 *   this client only ever requests the booking the page is showing.
 * - Push events are a prompt hint, never the source of truth: consumers must
 *   reconcile terminal states with the REST API (the service flags reconnects
 *   so missed events can be recovered).
 */
@Service()
export class RealtimeService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly config: ApiConfig = inject(API_CONFIG);

  private socket: Socket | null = null;
  private watchers = 0;
  private everConnected = false;

  /**
   * Watches one booking's payment status. Emits `connected` on every (re)
   * connect (with `reconnected: true` after the first) and `payment.status`
   * for server-pushed updates of this booking. Completing the subscription
   * leaves the room; the socket disconnects when the last watcher goes away.
   */
  watchBooking(bookingId: string): Observable<BookingRealtimeEvent> {
    // Mock-data mode has no realtime backend — the HTTP flows stay the only
    // source of truth there.
    if (!this.config.useRealApi) {
      return NEVER;
    }
    return new Observable<BookingRealtimeEvent>((subscriber) => {
      const socket = this.acquireSocket();
      const onStatus = (raw: unknown): void => {
        const event = raw as {
          bookingId?: unknown;
          paymentId?: unknown;
          status?: unknown;
        } | null;
        if (event?.bookingId !== bookingId || typeof event.paymentId !== 'string') {
          return;
        }
        if (
          event.status !== 'PENDING' &&
          event.status !== 'SUCCESS' &&
          event.status !== 'FAILED'
        ) {
          return;
        }
        subscriber.next({
          kind: 'payment.status',
          bookingId,
          paymentId: event.paymentId,
          status: event.status,
        });
      };
      const onConnect = (): void => {
        socket.emit('booking.subscribe', { bookingId });
        subscriber.next({ kind: 'connected', reconnected: this.everConnected });
        this.everConnected = true;
      };
      socket.on('payment.status', onStatus);
      socket.on('connect', onConnect);
      if (socket.connected) {
        onConnect();
      } else {
        socket.connect();
      }
      return () => {
        socket.off('payment.status', onStatus);
        socket.off('connect', onConnect);
        if (socket.connected) {
          socket.emit('booking.unsubscribe', { bookingId });
        }
        this.releaseSocket();
      };
    });
  }

  private acquireSocket(): Socket {
    this.watchers += 1;
    if (this.socket) {
      return this.socket;
    }
    const base = new URL(this.config.baseUrl);
    const socket = io(base.origin, {
      path: `${base.pathname.replace(/\/+$/, '')}/socket.io`,
      // Re-evaluated by socket.io on every connection attempt, so reconnects
      // always carry the freshest in-memory token.
      auth: (cb) => cb({ token: this.auth.accessToken() ?? '' }),
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });
    socket.on('disconnect', (reason: string) => {
      // socket.io does not auto-reconnect after a server-side disconnect
      // (e.g. the handshake raced an access-token refresh) — retry manually
      // once a token is available again, while watchers remain.
      if (reason === 'io server disconnect') {
        setTimeout(() => {
          if (this.watchers > 0 && this.auth.accessToken() && this.socket === socket) {
            socket.connect();
          }
        }, SERVER_DISCONNECT_RETRY_MS);
      }
    });
    // Server-side guard/handler rejections arrive as 'exception' events. Keep
    // them observable rather than silent (payloads are {status, message} —
    // they never carry tokens or payment details).
    socket.on('exception', (payload: unknown) => {
      console.warn('[realtime] server rejected a realtime message:', payload);
    });
    this.socket = socket;
    return socket;
  }

  private releaseSocket(): void {
    this.watchers = Math.max(0, this.watchers - 1);
    if (this.watchers === 0) {
      this.socket?.disconnect();
      this.socket = null;
      this.everConnected = false;
    }
  }

  ngOnDestroy(): void {
    this.watchers = 0;
    this.socket?.disconnect();
    this.socket = null;
  }
}
