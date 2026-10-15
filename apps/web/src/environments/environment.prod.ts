// Production builds always talk to the real API — mock auth branches must
// never leak into production (see environment.ts for the dev toggle).
export const environment = {
  production: true,
  useRealApi: true,
  // The production API base URL is deployment-specific and intentionally NOT
  // baked in: the deploy pipeline must serve config.json next to index.html
  // ({"apiBaseUrl": "https://<api-host>/api"}). RuntimeConfig refuses to start
  // a production build without it and never falls back to localhost.
  apiBaseUrl: '',
  /** Seat-hold window used by checkout (BR-13), in minutes. */
  seatHoldMinutes: 15,
  /** Production payments run through Stripe. Requires the publishable key below (set by the deploy pipeline). */
  paymentProvider: 'stripe' as 'stripe' | 'mock',
  // TODO(deploy): Stripe PUBLISHABLE key (pk_live_…) is UNKNOWN — set via the
  // deploy pipeline before shipping. Never a secret key; never whsec_/rk_live_.
  stripePublishableKey: '',
  /** Demo baggage tag hint — development data only, never shown in production. */
  demoBaggageTag: null as string | null,
  /** Brand/display constants. */
  brand: 'NovaAir',
  defaultCurrency: 'EUR',
  defaultLocale: 'en-GB',
};
