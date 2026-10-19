import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';
import { runtimeConfig, validateApiBaseUrl } from './runtime-config';

export interface ApiConfig {
  baseUrl: string;
  useRealApi: boolean;
  /** Mirrors the API's PAYMENT_PROVIDER: 'stripe' uses Stripe.js; 'mock' keeps the dev token flow. */
  paymentProvider: 'stripe' | 'mock';
  /** Stripe publishable key (pk_test_…/pk_live_…). Secret keys must never appear in the frontend. */
  stripePublishableKey: string;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root',
  factory: (): ApiConfig => ({
    // The runtime config.json wins; without it the initializer's rules apply
    // (development falls back to environment.ts, production fails clearly —
    // environment.prod.ts deliberately carries no usable URL).
    baseUrl: runtimeConfig()?.apiBaseUrl ?? validateApiBaseUrl(environment.apiBaseUrl, environment.production),
    useRealApi: environment.useRealApi,
    paymentProvider: environment.paymentProvider,
    stripePublishableKey: environment.stripePublishableKey,
  }),
});
