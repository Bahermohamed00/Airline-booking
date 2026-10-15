import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AdminSupportService } from './admin-support.service';
import { API_CONFIG } from '../../../core/config/api-config';

describe('AdminSupportService', () => {
  let service: AdminSupportService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AdminSupportService,
        { provide: API_CONFIG, useValue: { baseUrl: 'http://api.test/api' } },
      ],
    });
    service = TestBed.inject(AdminSupportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('overview GETs /admin/support/overview', () => {
    service.overview().subscribe();
    const req = http.expectOne('http://api.test/api/admin/support/overview');
    expect(req.request.method).toBe('GET');
    req.flush({ total: 0, open: 0, unreadMessages: 0, inProgress: 0, resolved: 0, closed: 0 });
  });

  it('conversation GETs /admin/support/tickets/:id/messages', () => {
    service.conversation('t-1').subscribe();
    const req = http.expectOne('http://api.test/api/admin/support/tickets/t-1/messages');
    expect(req.request.method).toBe('GET');
    req.flush({ ticket: {}, messages: [] });
  });

  it('markRead POSTs to /admin/support/tickets/:id/read', () => {
    service.markRead('t-1').subscribe();
    const req = http.expectOne('http://api.test/api/admin/support/tickets/t-1/read');
    expect(req.request.method).toBe('POST');
    req.flush({ read: 2 });
  });

  it('reply POSTs the body to /admin/support/tickets/:id/replies', () => {
    service.reply('t-1', 'We reset your password.').subscribe();
    const req = http.expectOne('http://api.test/api/admin/support/tickets/t-1/replies');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ body: 'We reset your password.' });
    req.flush({ id: 'm-1' });
  });
});
