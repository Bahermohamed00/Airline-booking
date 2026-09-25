import type { User } from '@prisma/client';

/** User fields that must never leave the API (password hashes, MFA secrets). */
export const SAFE_USER_OMIT = { passwordHash: true, mfaSecret: true, mfaBackupCodes: true } as const;

/** User record as exposed through the API (secrets omitted at the query level). */
export type SafeUser = Omit<User, 'passwordHash' | 'mfaSecret' | 'mfaBackupCodes'>;
