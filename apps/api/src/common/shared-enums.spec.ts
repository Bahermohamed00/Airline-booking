import { describe, it, expect } from 'vitest';
import * as shared from '@airline/shared';
import * as prismaClient from '@prisma/client';

// Keeps @airline/shared enums in sync with the Prisma schema enums, in BOTH
// directions: values must match per enum, and the SET of enum names must match
// so adding a Prisma enum without updating shared fails this test.
//
// Intentional exceptions (with reason) — currently none:
const PRISMA_ENUMS_NOT_IN_SHARED: string[] = [];
const SHARED_ENUMS_NOT_IN_PRISMA: string[] = [];

function enumObjects(ns: Record<string, unknown>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [name, value] of Object.entries(ns)) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue;
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) continue;
    // Prisma/shared enums are plain objects whose keys equal their values.
    if (entries.every(([k, v]) => k === v && typeof v === 'string')) {
      out[name] = entries.map(([, v]) => v as string).sort();
    }
  }
  return out;
}

const sharedEnums = enumObjects(shared);
const prismaEnums = enumObjects(prismaClient);

describe('@airline/shared enums mirror the Prisma schema', () => {
  it('every mirrored enum has exactly the same values', () => {
    const mirrored = Object.keys(sharedEnums).filter((n) => n in prismaEnums);
    expect(mirrored.length).toBeGreaterThan(0);
    for (const name of mirrored) {
      expect(sharedEnums[name], `enum ${name}`).toEqual(prismaEnums[name]);
    }
  });

  it('every Prisma enum has a counterpart in shared', () => {
    const missing = Object.keys(prismaEnums).filter(
      (n) => !(n in sharedEnums) && !PRISMA_ENUMS_NOT_IN_SHARED.includes(n),
    );
    expect(missing).toEqual([]);
  });

  it('every shared enum has a counterpart in Prisma', () => {
    const extra = Object.keys(sharedEnums).filter(
      (n) => !(n in prismaEnums) && !SHARED_ENUMS_NOT_IN_PRISMA.includes(n),
    );
    expect(extra).toEqual([]);
  });
});
