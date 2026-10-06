import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type { SystemSetting } from '../../../core/models/domain.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  listSettings(): Observable<SystemSetting[]> {
    return this.http.get<SystemSetting[]>(`${this.config.baseUrl}/settings`);
  }

  updateSetting(key: string, value: string): Observable<SystemSetting> {
    return this.http.patch<SystemSetting>(
      `${this.config.baseUrl}/settings/${encodeURIComponent(key)}`,
      { value },
    );
  }
}
