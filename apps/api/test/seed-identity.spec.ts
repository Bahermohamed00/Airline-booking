import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AIRCRAFT_DEFS,
  AIRLINE_CODE,
  AIRPORTS,
  generateLoyaltyMemberNumber,
  seededFlightNumbers,
} from '../../prisma/seed';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const seedSource = readFileSync(join(repoRoot, 'prisma', 'seed.ts'), 'utf8');

// Phase 1 (NovaAir foundation): the seed must produce only fictional NovaAir
// operational identifiers — no Lufthansa flight numbers, registrations, or
// loyalty identifiers — while preserving the locked 10 airports, 4 aircraft,
// 8 routes and the existing flight-seeding structure.
describe('seed identity cleanup (Phase 1)', () => {
  it('uses the NovaAir airline code', () => {
    expect(AIRLINE_CODE).toBe('NV');
  });

  it('keeps exactly the 10 locked airports', () => {
    expect(AIRPORTS).toHaveLength(10);
    expect(AIRPORTS.map((a) => a.iataCode)).toEqual([
      'FRA', 'MUC', 'HAM', 'LHR', 'JFK', 'LAX', 'CDG', 'AMS', 'SIN', 'DXB',
    ]);
  });

  it('keeps exactly 4 aircraft with NovaAir registrations and unchanged models/capacities', () => {
    expect(AIRCRAFT_DEFS).toEqual([
      { registration: 'NV-320A', model: 'Airbus A320-200', capacity: 180 },
      { registration: 'NV-321B', model: 'Airbus A321-200', capacity: 220 },
      { registration: 'NV-748X', model: 'Boeing 747-8', capacity: 364 },
      { registration: 'NV-359Y', model: 'Airbus A350-900', capacity: 319 },
    ]);
  });

  it('seeds only NovaAir flight numbers NV100..NV107 across the 8 routes', () => {
    expect(seededFlightNumbers(8)).toEqual([
      'NV100', 'NV101', 'NV102', 'NV103', 'NV104', 'NV105', 'NV106', 'NV107',
    ]);
    expect(seededFlightNumbers(8).every((n) => n.startsWith(AIRLINE_CODE))).toBe(true);
  });

  it('generates NovaAir loyalty member numbers (code + 8 digits)', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateLoyaltyMemberNumber()).toMatch(/^NV\d{8}$/);
    }
  });

  it('contains no Lufthansa operational identifiers in the seed source', () => {
    expect(seedSource).not.toMatch(/D-AIRA|D-AIRB|D-ABYA|D-AIXA/);
    expect(seedSource).not.toMatch(/`LH\$\{|LH\d{3}/);
    expect(seedSource).not.toContain('Lufthansa');
  });

  it('ships an idempotent migration normalizing already-persisted rows', () => {
    const migrationsDir = join(repoRoot, 'prisma', 'migrations');
    const folder = readdirSync(migrationsDir).find((f) => f.endsWith('_novaair_identity_cleanup'));
    expect(folder).toBeDefined();
    const sql = readFileSync(join(migrationsDir, folder as string, 'migration.sql'), 'utf8');
    const expected: Array<[string, string]> = [
      ['D-AIRA', 'NV-320A'],
      ['D-AIRB', 'NV-321B'],
      ['D-ABYA', 'NV-748X'],
      ['D-AIXA', 'NV-359Y'],
    ];
    for (const [oldReg, newReg] of expected) {
      expect(sql).toContain(`'${newReg}' WHERE "registration" = '${oldReg}'`);
    }
    expect(sql).toMatch(/UPDATE "flights"[\s\S]*'NV'/);
    expect(sql).toMatch(/UPDATE "loyalty_accounts"[\s\S]*'NV'/);
  });
});
