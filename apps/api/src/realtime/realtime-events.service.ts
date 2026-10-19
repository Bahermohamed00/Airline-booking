import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

/** Socket.IO room for one booking's customer-facing status updates. */
export const bookingRoom = (bookingId: string): string => `booking:${bookingId}`;

/** Normalized customer-facing payment states — never raw provider statuses. */
export type PaymentStatusPush = 'PENDING' | 'SUCCESS' | 'FAILED';

/**
 * Minimal payment status event. Deliberately carries only identifiers and the
 * normalized status: clients fetch authorized details through the REST API.
 */
export interface PaymentStatusEvent {
  bookingId: string;
  paymentId: string;
  status: PaymentStatusPush;
}

/**
 * Server-side publisher for customer-facing realtime events. Emissions are
 * room-scoped (never broadcast) and best-effort: the authoritative state is
 * always the committed database row, and clients reconcile via the REST API.
 */
@Injectable()
export class RealtimeEventsService {
  private server: Server | null = null;

  /** Called by the gateway once Socket.IO is bound to the HTTP server. */
  attach(server: Server): void {
    this.server = server;
  }

  emitPaymentStatus(event: PaymentStatusEvent): void {
    if (!this.server) {
      return;
    }
    this.server
      .to(bookingRoom(event.bookingId))
      .emit('payment.status', { ...event });
  }
}
