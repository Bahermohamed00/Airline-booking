import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { UsersService, type CreateStaffPayload } from './users.service';
import { API_CONFIG } from '../../../core/config/api-config';

describe('UsersService', () => {
  let service: UsersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { baseUrl: 'http://api.test/api', useRealApi: true } },
      ],
    });
    service = TestBed.inject(UsersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('createStaff POSTs the payload to /users with the role UUID', () => {
    const payload: CreateStaffPayload = {
      email: 'new@staff.test',
      password: 'StaffPassword123!',
      firstName: 'New',
      lastName: 'Staff',
      roleIds: ['9b1d4c2e-0000-4000-8000-000000000001'],
    };
    let response: unknown;
    service.createStaff(payload).subscribe((r) => (response = r));

    const req = http.expectOne('http://api.test/api/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(JSON.stringify(req.request.body)).not.toContain('Support Staff');

    req.flush({ id: 'u1' });
    expect(response).toEqual({ id: 'u1' });
  });

  it('listUsers GETs /users', () => {
    let result: unknown;
    service.listUsers().subscribe((r) => (result = r));

    const req = http.expectOne('http://api.test/api/users');
    expect(req.request.method).toBe('GET');
    req.flush([]);
    expect(result).toEqual([]);
  });
});
