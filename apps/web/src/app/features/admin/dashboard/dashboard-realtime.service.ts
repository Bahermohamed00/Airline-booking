import { Injectable, inject } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Real-time dashboard invalidation channel (Socket.IO, /dashboard namespace).
 *
 * Events are pure change notifications — never statistics. Consumers re-fetch
 * authoritative numbers via the REST dashboard API, which stays the source of
 * truth. Reconnection uses socket.io's built-in bounded backoff; on every
 * reconnect a single `sync` emission lets consumers resynchronize once.
 * The dashboard works without this service (REST-only) if the socket never
 * connects.
 */
@Injectable({ providedIn: 'root' })
export class DashboardRealtimeService {
  private readonly config: ApiConfig = inject(API_CONFIG);
  private readonly auth = inject(AuthService);

  private socket?: Socket;
  private everConnected = false;
  private readonly invalidateSubject = new Subject<string>();

  /** Emits the domain event type (e.g. 'flight.created'), or 'sync' on reconnect. */
  readonly invalidate$: Observable<string> = this.invalidateSubject.asObservable();

  connect(): void {
    if (this.socket) return;
    const origin = new URL(this.config.baseUrl).origin;
    this.socket = io(`${origin}/dashboard`, {
      auth: { token: this.auth.accessToken() ?? '' },
      // Bounded backoff — never an aggressive reconnect loop.
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
    });
    this.socket.on('dashboard.invalidate', (payload: { type?: string }) => {
      this.invalidateSubject.next(payload?.type ?? 'unknown');
    });
    this.socket.on('connect', () => {
      if (this.everConnected) {
        // Reconnected after a drop: events may have been missed — resync once.
        this.invalidateSubject.next('sync');
      }
      this.everConnected = true;
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
    this.everConnected = false;
  }
}
