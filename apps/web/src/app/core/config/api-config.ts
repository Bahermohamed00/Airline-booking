import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface ApiConfig {
  baseUrl: string;
  useRealApi: boolean;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root',
  factory: (): ApiConfig => ({ baseUrl: environment.apiBaseUrl, useRealApi: environment.useRealApi }),
});
