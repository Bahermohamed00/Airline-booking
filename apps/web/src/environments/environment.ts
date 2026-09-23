export const environment = {
  production: false,
  /** When true, services call the real NestJS API instead of mock data. */
  useRealApi: false,
  apiBaseUrl: 'http://localhost:3000/api',
  /** Seat-hold window used by checkout (BR-13), in minutes. */
  seatHoldMinutes: 15,
  /** Brand/display constants. */
  brand: 'NovaAir',
  defaultCurrency: 'EUR',
  defaultLocale: 'en-GB',
};
