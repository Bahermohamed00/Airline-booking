import { PrismaClient } from '@prisma/client';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { expect, vi } from 'vitest';

/** Extracts the `refresh_token=...` cookie pair from a response's set-cookie headers. */
export function refreshCookieOf(res: request.Response): string {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cookies?.find((c) => c.startsWith('refresh_token='));
  expect(cookie, 'expected a refresh_token set-cookie header').toBeDefined();
  return cookie!.split(';')[0]!;
}

/** Extracts the raw token value from a `refresh_token=...` cookie pair. */
export function rawTokenOf(cookie: string): string {
  return cookie.slice('refresh_token='.length);
}

/** Decodes a JWT payload without verifying the signature (test inspection only). */
export function decodePayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1]!;
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

/** Captures stdout/stderr/console output produced while `fn` runs. */
export async function captureLogs<T>(fn: () => Promise<T>): Promise<{ result: T; output: string }> {
  const captured: string[] = [];
  const sink = (chunk: unknown): boolean => {
    captured.push(String(chunk));
    return true;
  };
  const spies = [
    vi.spyOn(process.stdout, 'write').mockImplementation(sink as unknown as typeof process.stdout.write),
    vi.spyOn(process.stderr, 'write').mockImplementation(sink as unknown as typeof process.stderr.write),
    vi.spyOn(console, 'log').mockImplementation(() => undefined),
    vi.spyOn(console, 'warn').mockImplementation(() => undefined),
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
    vi.spyOn(console, 'info').mockImplementation(() => undefined),
    vi.spyOn(console, 'debug').mockImplementation(() => undefined),
  ];

  let result: T | undefined;
  try {
    result = await fn();
  } finally {
    const consoleBlob = spies
      .slice(2)
      .flatMap((s) => s.mock.calls.flat().map(String))
      .join('\n');
    captured.push(consoleBlob);
    spies.forEach((s) => s.mockRestore());
  }
  return { result: result as T, output: captured.join('') };
}

export const prismaTestClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env['DATABASE_URL'] ?? 'postgresql://airline:airline@localhost:5432/airline_booking_test?schema=public',
    },
  },
});

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = [
    'audit_logs',
    'refresh_tokens',
    'sessions',
    'email_verification_tokens',
    'password_reset_tokens',
    'system_settings',
    'offers',
    'loyalty_transactions',
    'loyalty_accounts',
    'notifications',
    'notification_templates',
    'booking_extras',
    'extra_services',
    'boarding_passes',
    'check_ins',
    'baggage_events',
    'baggage',
    'booking_seats',
    'payments',
    'refunds',
    'booking_passengers',
    'passengers',
    'bookings',
    'fares',
    'flight_segments',
    'seat_holds',
    'flights',
    'routes',
    'seats',
    'aircraft',
    'airports',
    'role_permissions',
    'user_roles',
    'permissions',
    'roles',
    'users',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch {
      // ignore missing tables
    }
  }
}

/**
 * Registers a user through the real HTTP endpoint, then marks the account
 * verified/active directly in the database (fixture setup for specs that are
 * not about the verification flow itself).
 */
export async function registerVerifiedUser(
  app: INestApplication<App>,
  user: { email: string; password: string; firstName: string; lastName: string },
): Promise<void> {
  await request(app.getHttpServer()).post('/api/auth/register').send(user);
  await prismaTestClient.user.update({
    where: { email: user.email },
    data: { status: 'ACTIVE', emailVerified: true },
  });
}
