import type { User } from '@prisma/client';

/**
 * User fields that must never leave the API: password hashes and the national
 * ID (owner-only via GET /auth/me; no staff listing exposes it).
 */
export const SAFE_USER_OMIT = { passwordHash: true, nationalId: true } as const;

/** User record as exposed through the API (secrets omitted at the query level). */
export type SafeUser = Omit<User, 'passwordHash' | 'nationalId'>;

/**
 * Support Staff handle tickets with contact details only (email, phone, ticket
 * content) — personal profile data beyond that is stripped from their user
 * reads. Administrator/Super Admin workflows keep the full SafeUser shape.
 */
export const SUPPORT_RESTRICTED_USER_OMIT = {
  ...SAFE_USER_OMIT,
  streetAddress: true,
  dateOfBirth: true,
} as const;

/** User record as visible to Support Staff. */
export type SupportRestrictedUser = Omit<SafeUser, 'streetAddress' | 'dateOfBirth'>;
