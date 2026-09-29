import { createHash, randomBytes } from 'crypto';

/** Opaque one-time credential: 256 bits of entropy, base64url-encoded. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/** High-entropy tokens are stored as SHA-256 digests (ADR-0002). */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Parses '90s' / '15m' / '24h' / '7d' style durations, falling back when malformed. */
export function parseDurationMs(value: string, fallbackMs: number): number {
  const match = /^(\d+)([smhd])?$/.exec(value);
  if (!match) {
    return fallbackMs;
  }
  const amount = parseInt(match[1]!, 10);
  const multiplier = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] ?? 's'] ?? 1_000;
  return amount * multiplier;
}
