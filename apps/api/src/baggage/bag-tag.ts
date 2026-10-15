import { randomInt } from 'node:crypto';

/**
 * Baggage tag issuance. Tags are `NV` + 8 cryptographically random digits
 * (crypto.randomInt — never sequential, never derived from booking or
 * passenger data). The `baggage.tag_number` unique constraint remains the
 * authoritative collision guard; issuers retry only recognized P2002 tag
 * collisions (see BaggageService.issueCheckedBags).
 */
export const BAG_TAG_PATTERN = /^NV\d{8}$/;

export const BAG_TAG_SPACE = 100_000_000;

export function generateBagTag(): string {
  return `NV${String(randomInt(0, BAG_TAG_SPACE)).padStart(8, '0')}`;
}

/** True when a P2002 came from the tag_number unique constraint specifically. */
export function isTagCollision(error: unknown): boolean {
  if (
    !(error instanceof Error) ||
    (error as { code?: string }).code !== 'P2002'
  ) {
    return false;
  }
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target) && target.includes('tag_number');
}

/** Bounded retry budget for tag collisions — exhaustion fails the operation safely. */
export const MAX_TAG_ATTEMPTS = 5;
