export const environment = {
  production: false,
  /** When enabled, services use the API; auth keeps refresh credentials in httpOnly cookies. */
  useRealApi: true,
  apiBaseUrl: 'http://localhost:3000/api',
  /** Seat-hold window used by checkout (BR-13), in minutes. */
  seatHoldMinutes: 15,
  /** Brand/display constants. */
  brand: 'NovaAir',
  defaultCurrency: 'EUR',
  defaultLocale: 'en-GB',
};
