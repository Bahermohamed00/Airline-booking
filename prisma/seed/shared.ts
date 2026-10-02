import { PrismaClient } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';

/**
 * Shared seed context: the single Prisma client plus small cross-domain
 * helpers. Domain seeds import `prisma` from here so the whole run shares one
 * connection (disconnected once by the root orchestrator).
 */
export const prisma = new PrismaClient();

/** Fictional airline identity for all seeded operational identifiers. */
export const AIRLINE_CODE = 'NV';

/** One daily flight number per seeded route: NV100..NV1xx in route order. */
export function seededFlightNumbers(routeCount: number): string[] {
  return Array.from({ length: routeCount }, (_, i) => `${AIRLINE_CODE}${100 + i}`);
}

/** Fictional NovaAir loyalty member number: airline code + 8 digits. */
export function generateLoyaltyMemberNumber(): string {
  return `${AIRLINE_CODE}${Math.floor(10000000 + Math.random() * 90000000)}`;
}

export async function hash(password: string): Promise<string> {
  // @node-rs/argon2 defaults to Argon2id (its Algorithm const enum breaks isolatedModules)
  return argonHash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export const isoLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
