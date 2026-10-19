import { describe, it, expect } from 'vitest';
import { BAG_TAG_PATTERN, generateBagTag, isTagCollision } from './bag-tag';
import { Prisma } from '@prisma/client';

describe('generateBagTag', () => {
  it('produces NV + 8 digits, within the declared space', () => {
    for (let i = 0; i < 500; i++) {
      const tag = generateBagTag();
      expect(tag).toMatch(BAG_TAG_PATTERN);
      const numeric = Number(tag.slice(2));
      expect(Number.isInteger(numeric)).toBe(true);
      expect(numeric).toBeGreaterThanOrEqual(0);
      expect(numeric).toBeLessThan(100_000_000);
    }
  });

  it('is non-sequential and unpredictable across a batch', () => {
    const tags = new Set(Array.from({ length: 1000 }, () => generateBagTag()));
    // 1000 draws from a 1e8 space: a sequential or weak generator would collide
    // or produce adjacent values; random draws (almost) never collide here.
    expect(tags.size).toBe(1000);
    const sorted = [...tags].sort();
    const adjacentPairs = sorted.filter((t, i) => i > 0 && Number(t.slice(2)) - Number(sorted[i - 1]!.slice(2)) === 1);
    expect(adjacentPairs.length).toBeLessThan(5);
  });
});

describe('isTagCollision', () => {
  const tagP2002 = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`tag_number`)', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['tag_number'] },
    });

  it('recognizes only P2002 tag_number collisions', () => {
    expect(isTagCollision(tagP2002())).toBe(true);
    expect(
      isTagCollision(
        new Prisma.PrismaClientKnownRequestError('other unique index', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['booking_passenger_id'] },
        }),
      ),
    ).toBe(false);
    expect(isTagCollision(new Error('boom'))).toBe(false);
    expect(isTagCollision('P2002')).toBe(false);
    expect(isTagCollision(null)).toBe(false);
  });
});
