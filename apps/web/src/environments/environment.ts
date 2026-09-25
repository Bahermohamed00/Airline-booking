export const environment = {
  production: false,
  /** When true, AuthService calls the real NestJS API (cookie refresh flow); when false, mock data is used. */
  useRealApi: true,
  apiBaseUrl: 'http://localhost:3000/api',
  /** Seat-hold window used by checkout (BR-13), in minutes. */
  seatHoldMinutes: 15,
  /** Brand/display constants. */
  brand: 'NovaAir',
  defaultCurrency: 'EUR',
  defaultLocale: 'en-GB',
};
