import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminNotificationsService } from './admin-notifications.service';
import { API_CONFIG } from '../../../core/config/api-config';

const pageFixture = {
  data: [
    {
      id: 'n1',
      type: 'BOOKING_CONFIRMED',
      channel: 'EMAIL',
      status: 'SENT',
      title: 'Booking confirmed',
      content: 'Your booking NVAB12 is confirmed.',
      userId: 'user-1',
      bookingId: 'booking-1',
      readAt: null,
      attempts: 1,
      error: null,
      sentAt: '2026-10-13T10:00:00.000Z',
      createdAt: '2026-10-13T10:00:00.000Z',
    },
  ],
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
};

describe('AdminNotificationsService', () => {
  let service: AdminNotificationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: '/api', useRealApi: true } },
      ],
    });
    service = TestBed.inject(AdminNotificationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('requests the admin endpoint with default pagination', () => {
    service.list().subscribe((res) => {
      expect(res.total).toBe(1);
      expect(res.data[0]!.title).toBe('Booking confirmed');
    });

    const req = http.expectOne((r) => r.url === '/api/admin/notifications');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.has('channel')).toBe(false);
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('read')).toBe(false);
    req.flush(pageFixture);
  });

  it('passes channel, status, read, and pagination parameters', () => {
    service
      .list({ page: 3, limit: 50, channel: 'EMAIL', status: 'FAILED', read: 'unread' })
      .subscribe();

    const req = http.expectOne((r) => r.url === '/api/admin/notifications');
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.params.get('channel')).toBe('EMAIL');
    expect(req.request.params.get('status')).toBe('FAILED');
    expect(req.request.params.get('read')).toBe('unread');
    req.flush({ data: [], page: 3, limit: 50, total: 0, totalPages: 0 });
  });

  it('propagates errors to the caller (no fake success)', () => {
    let status = 0;
    service.list().subscribe({ error: (err) => (status = err.status) });
    http.expectOne((r) => r.url === '/api/admin/notifications').flush('nope', {
      status: 403,
      statusText: 'Forbidden',
    });
    expect(status).toBe(403);
  });
});
