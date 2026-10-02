// Production builds always talk to the real API — mock auth branches must
// never leak into production (see environment.ts for the dev toggle).
export const environment = {
  production: true,
  useRealApi: true,
  // TODO(deploy): Production API URL is UNKNOWN — no deployment target exists
  // yet. This is a deliberate placeholder, NOT a real endpoint. Set the real
  // API base URL here (or via your deploy pipeline) before shipping. Do not
  // replace it with a guessed/fake URL.
  apiBaseUrl: 'http://localhost:3000/api',
  /** Seat-hold window used by checkout (BR-13), in minutes. */
  seatHoldMinutes: 15,
  /** Brand/display constants. */
  brand: 'NovaAir',
  defaultCurrency: 'EUR',
  defaultLocale: 'en-GB',
};
