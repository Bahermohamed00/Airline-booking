/**
 * Per-endpoint IP rate limits for abuse-sensitive auth endpoints.
 * Applied via @Throttle({ default: ... }) on the controller methods; each
 * route gets its own counter (class+handler+ip, verified in throttler.guard).
 * Keep deliberately small — these are brute-force/flood barriers, while the
 * global 'default' throttler (100/min) covers everything else.
 */
export const AUTH_THROTTLE = {
  /** Credential brute force. */
  login: { limit: 5, ttl: 60_000 },
  /** Reset-email flooding / address probing. */
  passwordResetRequest: { limit: 5, ttl: 60_000 },
  /** Reset-token abuse. */
  passwordReset: { limit: 10, ttl: 60_000 },
  /** Verification-email flooding. */
  emailVerificationRequest: { limit: 5, ttl: 60_000 },
  /** Verification-token abuse (same class as password reset). */
  emailVerification: { limit: 10, ttl: 60_000 },
  /** Online password guessing on the authenticated account. */
  changePassword: { limit: 5, ttl: 60_000 },
} as const;
