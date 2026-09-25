import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import { ROLES } from '../mock/mock-data';
import type { Role } from '../models/domain.model';

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  /** Role catalog with resolved permissions. Mock branch is development-only demo data. */
  listRoles(): Observable<Role[]> {
    if (!this.config.useRealApi) {
      return of(ROLES).pipe(delay(300));
    }
    return this.http.get<Role[]>(`${this.config.baseUrl}/roles`);
  }
}
