import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type { UserStatus } from '../../../core/models/domain.model';

/** Role summary embedded in user payloads from /api/users. */
export interface ApiUserRole {
  role: {
    id: string;
    name: string;
    isSuperAdmin: boolean;
    rolePermissions?: { permission: { resource: string; action: string } }[];
  };
}

/** User shape returned by /api/users. Never contains passwordHash, tokens, or MFA secrets. */
export interface ApiUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  status: UserStatus;
  userRoles: ApiUserRole[];
}

export interface CreateStaffPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleIds: string[];
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  /**
   * Creates a real staff account (Super Admin only; the backend is the final
   * authority on who may call this and which roles may be assigned).
   */
  createStaff(payload: CreateStaffPayload): Observable<ApiUser> {
    return this.http.post<ApiUser>(`${this.config.baseUrl}/users`, payload);
  }

  listUsers(): Observable<ApiUser[]> {
    return this.http.get<ApiUser[]>(`${this.config.baseUrl}/users`);
  }
  updateUser(id: string, payload: { status: UserStatus }): Observable<ApiUser> {
    return this.http.patch<ApiUser>(`${this.config.baseUrl}/users/${id}`, payload);
  }
}
