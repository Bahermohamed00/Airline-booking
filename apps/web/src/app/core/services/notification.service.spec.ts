import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import {
  NotificationService,
  bookingLinkFor,
  type CustomerNotification,
} from './notification.service';
import { API_CONFIG } from '../config/api-config';
import { AuthService } from './auth.service';
import type { User } from '../models/domain.model';

@Component({ template: '' })
class DummyComponent {}

const customerA: User = {
  id: 'user-a',
  email: 'a@example.com',
  firstName: 'Ann',
  lastName: 'A',
  emailVerified: true,
  mfaEnabled: false,
  status: 'ACTIVE',
  roles: ['Customer'],
  permissions: [],
};
const customerB: User = { ...customerA, id: 'user-b', email: 'b@example.com' };

const notification = (overrides: Partial<CustomerNotification> = {}): CustomerNotification => ({
  id: 'n1',
  type: 'BOOKING_CONFIRMED',
  title: 'Booking confirmed',
  content: 'Your booking NVAB12 is confirmed.',
  bookingId: 'booking-1',
  readAt: null,
  createdAt: '2026-10-13T10:00:00.000Z',
  ...overrides,
});

describe('NotificationService', () => {
  let service: NotificationService;
  let http: HttpTestingController;
  let userSignal: ReturnType<typeof signal<User | null>>;

  beforeEach(() => {
    userSignal = signal<User | null>(null);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: DummyComponent }]),
        {
          provide: API_CONFIG,
          useValue: { baseUrl: '/api', useRealApi: true, paymentProvider: 'mock' },
        },
        { provide: AuthService, useValue: { user: userSignal.asReadonly() } },
      ],
    });
    service = TestBed.inject(NotificationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  describe('list', () => {
    it('requests the notifications endpoint with default pagination', () => {
      service.list().subscribe();
      const req = http.expectOne((r) => r.url === '/api/notifications');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('limit')).toBe('20');
      expect(req.request.params.has('status')).toBe(false);
      req.flush({ data: [], page: 1, limit: 20, total: 0, totalPages: 0 });
    });

    it('passes the read/unread filter and caps the page size at 100', () => {
      service.list({ page: 3, limit: 500, status: 'unread' }).subscribe();
      const req = http.expectOne((r) => r.url === '/api/notifications');
      expect(req.request.params.get('page')).toBe('3');
      expect(req.request.params.get('limit')).toBe('100');
      expect(req.request.params.get('status')).toBe('unread');
      req.flush({ data: [], page: 3, limit: 100, total: 0, totalPages: 0 });
    });

    it('propagates HTTP errors to the caller (no fake success)', () => {
      let failed = false;
      service.list().subscribe({ error: () => (failed = true) });
      http.expectOne((r) => r.url === '/api/notifications').flush('boom', {
        status: 500,
        statusText: 'Server Error',
      });
      expect(failed).toBe(true);
    });
  });

  describe('unread count and session isolation', () => {
    it('loads the count when a user signs in', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 7 });
      expect(service.unreadCount()).toBe(7);
    });

    it('clears the count on sign-out', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 4 });
      expect(service.unreadCount()).toBe(4);

      userSignal.set(null);
      TestBed.tick();
      expect(service.unreadCount()).toBe(0);
      http.expectNone('/api/notifications/unread-count');
    });

    it('never shows the previous user’s count or stale responses after an account switch', () => {
      userSignal.set(customerA);
      TestBed.tick();
      const reqA = http.expectOne('/api/notifications/unread-count');
      reqA.flush({ count: 9 });
      expect(service.unreadCount()).toBe(9);

      // Switch accounts: count resets immediately, a new request starts.
      userSignal.set(customerB);
      TestBed.tick();
      expect(service.unreadCount()).toBe(0);
      const reqB = http.expectOne('/api/notifications/unread-count');
      reqB.flush({ count: 2 });
      expect(service.unreadCount()).toBe(2);
    });

    it('discards a late unread-count response from a previous session', () => {
      userSignal.set(customerA);
      TestBed.tick();
      const reqA = http.expectOne('/api/notifications/unread-count');

      userSignal.set(customerB);
      TestBed.tick();
      const reqB = http.expectOne('/api/notifications/unread-count');

      // A's slow response arrives after the switch — must be discarded.
      reqA.flush({ count: 9 });
      expect(service.unreadCount()).toBe(0);
      reqB.flush({ count: 3 });
      expect(service.unreadCount()).toBe(3);
    });

    it('caps the badge at 99+', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 140 });
      expect(service.unreadBadge()).toBe('99+');
    });

    it('refreshes the count on in-app navigation (no polling)', async () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 5 });
      expect(service.unreadCount()).toBe(5);

      const router = TestBed.inject(Router);
      const navigation = router.navigate(['/booking/confirmation']);
      TestBed.tick();
      await navigation;

      http.expectOne('/api/notifications/unread-count').flush({ count: 6 });
      expect(service.unreadCount()).toBe(6);
    });

    it('does not request the count on navigation while signed out', async () => {
      const router = TestBed.inject(Router);
      const navigation = router.navigate(['/search']);
      TestBed.tick();
      await navigation;

      http.expectNone('/api/notifications/unread-count');
      expect(service.unreadCount()).toBe(0);
    });

    it('flags an error when the count request fails, and clears it on the next success', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush('boom', {
        status: 500,
        statusText: 'Server Error',
      });
      expect(service.unreadError()).toBe(true);
      // A failed load is never presented as a legitimate "0 unread".
      expect(service.unreadCount()).toBe(0);

      service.refreshUnreadCount();
      http.expectOne('/api/notifications/unread-count').flush({ count: 2 });
      expect(service.unreadError()).toBe(false);
      expect(service.unreadCount()).toBe(2);
    });

    it('clears the error state on sign-out and account switch', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush('boom', {
        status: 500,
        statusText: 'Server Error',
      });
      expect(service.unreadError()).toBe(true);

      userSignal.set(customerB);
      TestBed.tick();
      expect(service.unreadError()).toBe(false);
      http.expectOne('/api/notifications/unread-count').flush({ count: 1 });
    });
  });

  describe('mutations', () => {
    it('markRead PATCHes the item endpoint and decrements the count', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 3 });

      service.markRead('n1').subscribe();
      const req = http.expectOne('/api/notifications/n1/read');
      expect(req.request.method).toBe('PATCH');
      req.flush(notification({ readAt: '2026-10-13T11:00:00.000Z' }));
      expect(service.unreadCount()).toBe(2);
    });

    it('markRead never drives the count below zero', () => {
      service.markRead('n1').subscribe();
      http.expectOne('/api/notifications/n1/read').flush(notification());
      expect(service.unreadCount()).toBe(0);
    });

    it('markAllRead PATCHes read-all and resets the count', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 12 });

      service.markAllRead().subscribe();
      const req = http.expectOne('/api/notifications/read-all');
      expect(req.request.method).toBe('PATCH');
      req.flush({ updated: 12 });
      expect(service.unreadCount()).toBe(0);
    });

    it('failed markRead leaves the count unchanged and propagates the error', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 3 });

      let failed = false;
      service.markRead('n1').subscribe({ error: () => (failed = true) });
      http.expectOne('/api/notifications/n1/read').flush('boom', {
        status: 500,
        statusText: 'Server Error',
      });
      expect(failed).toBe(true);
      expect(service.unreadCount()).toBe(3);
    });
  });

  describe('bookingLinkFor (navigation allowlist)', () => {
    it('links every booking-related customer type to the booking route', () => {
      for (const type of [
        'BOOKING_CONFIRMED',
        'PAYMENT_SUCCEEDED',
        'PAYMENT_FAILED',
        'CANCELLATION_APPROVED',
        'CANCELLATION_REJECTED',
        'REFUND_PROCESSED',
      ]) {
        expect(bookingLinkFor(notification({ type }))).toEqual([
          '/bookings',
          'booking-1',
        ]);
      }
    });

    it('refuses staff-only types, unknown types, null types, and missing booking ids', () => {
      expect(bookingLinkFor(notification({ type: 'REFUND_REVIEW_REQUIRED' }))).toBeNull();
      expect(bookingLinkFor(notification({ type: 'OFFER_PUBLISHED' }))).toBeNull();
      expect(bookingLinkFor(notification({ type: null }))).toBeNull();
      expect(bookingLinkFor(notification({ bookingId: null }))).toBeNull();
      expect(bookingLinkFor(notification({ bookingId: '' }))).toBeNull();
    });
  });

  describe('mutation counter (cross-view reconciliation)', () => {
    it('markRead bumps the mutation counter so other open views resync', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 1 });
      expect(service.mutations()).toBe(0);

      service.markRead('n1').subscribe();
      http.expectOne('/api/notifications/n1/read').flush(notification({ readAt: '2026-10-14T10:00:00Z' }));
      expect(service.mutations()).toBe(1);
    });

    it('markAllRead bumps the mutation counter and zeroes the count', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 3 });

      service.markAllRead().subscribe();
      http.expectOne('/api/notifications/read-all').flush({ updated: 3 });
      expect(service.mutations()).toBe(1);
      expect(service.unreadCount()).toBe(0);
    });

    it('a failed markRead does not bump the counter or touch the count', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 2 });

      service.markRead('n1').subscribe({ error: () => {} });
      http.expectOne('/api/notifications/n1/read').flush('down', { status: 500, statusText: 'err' });
      expect(service.mutations()).toBe(0);
      expect(service.unreadCount()).toBe(2);
    });
  });

  describe('polling', () => {
    let intervalCb: (() => void) | null;
    let clearedIds: unknown[];

    beforeEach(() => {
      intervalCb = null;
      clearedIds = [];
      vi.spyOn(globalThis, 'setInterval').mockImplementation(((cb: () => void) => {
        intervalCb = cb;
        return 4242;
      }) as never);
      vi.spyOn(globalThis, 'clearInterval').mockImplementation(((id: unknown) => {
        clearedIds.push(id);
      }) as never);
    });

    afterEach(() => vi.restoreAllMocks());

    it('polls the unread count on the interval while signed in', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 1 });
      expect(intervalCb).not.toBeNull();

      intervalCb!();
      http.expectOne('/api/notifications/unread-count').flush({ count: 5 });
      expect(service.unreadCount()).toBe(5);

      intervalCb!();
      http.expectOne('/api/notifications/unread-count').flush({ count: 2 });
      expect(service.unreadCount()).toBe(2);
    });

    it('skips the poll while the tab is hidden', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 1 });

      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      intervalCb!();
      http.expectNone('/api/notifications/unread-count');
    });

    it('never overlaps poll requests (single-flight)', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 1 });

      intervalCb!();
      intervalCb!(); // second tick while the first poll is still in flight
      const pending = http.match('/api/notifications/unread-count');
      expect(pending).toHaveLength(1);
      pending[0]!.flush({ count: 4 });
      expect(service.unreadCount()).toBe(4);
    });

    it('stops polling on sign-out and never polls while signed out', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 1 });

      userSignal.set(null);
      TestBed.tick();
      expect(clearedIds).toContain(4242);
      intervalCb!();
      http.expectNone('/api/notifications/unread-count');
    });

    it('a failed poll flags the badge error without clearing a good count', () => {
      userSignal.set(customerA);
      TestBed.tick();
      http.expectOne('/api/notifications/unread-count').flush({ count: 6 });

      intervalCb!();
      http.expectOne('/api/notifications/unread-count').flush('down', { status: 503, statusText: 'err' });
      expect(service.unreadError()).toBe(true);
      expect(service.unreadCount()).toBe(6); // last good value kept
    });
  });
});
