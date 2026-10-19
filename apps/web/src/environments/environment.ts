export const environment = {
  production: false,
  /** When true, AuthService calls the real NestJS API (cookie refresh flow); when false, mock data is used. */
  useRealApi: true,
  apiBaseUrl: 'http://localhost:3000/api',
  /** Seat-hold window used by checkout (BR-13), in minutes. */
  seatHoldMinutes: 15,
  /** Mirrors the API's PAYMENT_PROVIDER ('stripe' here; both sides must match). */
  paymentProvider: 'stripe' as 'stripe' | 'mock',
  /** Stripe publishable key (pk_test_… TEST mode). Publishable keys are public by design; secret keys must NEVER appear here. */
  stripePublishableKey: "pk_test_51UNTkwRplmQkGUx5aW2Q3IrrQYSL5YpzieTY2z0lRER7ACEFr3FjMwZYVPS707iqxrCcoxHaAxT4evzIjR1v67wb00TkQ0TcRL",
  /** Brand/display constants. */
  brand: 'NovaAir',
  defaultCurrency: 'EUR',
  defaultLocale: 'en-GB',
  /** Seeded demo bag tag for the local tracking page (never shipped to prod). */
  demoBaggageTag: 'NV00000001' as string | null,
};
