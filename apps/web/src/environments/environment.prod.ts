// Production builds always talk to the real API — mock auth branches must
// never leak into production (see environment.ts for the dev toggle).
export const environment = {
  production: true,
  useRealApi: true,
  apiBaseUrl: '/api',
  /** Seat-hold window used by checkout (BR-13), in minutes. */
  seatHoldMinutes: 15,
  /** Brand/display constants. */
  brand: 'NovaAir',
  defaultCurrency: 'EUR',
  defaultLocale: 'en-GB',
};
