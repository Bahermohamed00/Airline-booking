import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './auth.guard.js';
import { AuditThrottlerGuard } from './audit-throttler.guard.js';
import { IS_PUBLIC_KEY } from './decorators/public.decorator.js';

/**
 * Regression tests for the WebSocket guard pipeline. NestJS applies global
 * APP_GUARDs to @SubscribeMessage handlers, where switchToHttp().getRequest()
 * returns the Socket (args[0]) — not an HTTP request. Guards must never treat
 * the socket/payload as HTTP objects, and must still enforce that the
 * connection-level authentication attached a user.
 */

/** A WS-shaped ExecutionContext: HTTP accessors throw if a guard touches them. */
function wsContext(client: unknown): ExecutionContext {
  return {
    getType: () => 'ws',
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToWs: () => ({ getClient: () => client }),
    switchToHttp: () => ({
      getRequest: () => {
        throw new Error('getRequest must not be used in a WS context');
      },
      getResponse: () => {
        throw new Error('getResponse must not be used in a WS context');
      },
    }),
  } as unknown as ExecutionContext;
}

function httpContext(): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        ip: '127.0.0.1',
        headers: {},
        method: 'POST',
        path: '/x',
      }),
      getResponse: () => ({ header: vi.fn() }),
    }),
  } as unknown as ExecutionContext;
}

function reflectorReturning(key: string, value: unknown): Reflector {
  const r = new Reflector();
  vi.spyOn(r, 'getAllAndOverride').mockImplementation((metadataKey: unknown) =>
    metadataKey === key ? value : undefined,
  );
  return r;
}

describe('JwtAuthGuard — WebSocket contexts', () => {
  it('allows a socket that completed connection-level authentication', () => {
    const guard = new JwtAuthGuard(reflectorReturning(IS_PUBLIC_KEY, undefined));
    const socket = { data: { user: { userId: 'user-1' } } };
    expect(guard.canActivate(wsContext(socket))).toBe(true);
  });

  it('rejects a socket without an authenticated user — no silent bypass', () => {
    const guard = new JwtAuthGuard(reflectorReturning(IS_PUBLIC_KEY, undefined));
    expect(guard.canActivate(wsContext({ data: {} }))).toBe(false);
    expect(guard.canActivate(wsContext({ data: undefined }))).toBe(false);
    expect(guard.canActivate(wsContext(null))).toBe(false);
  });

  it('still honors @Public() in WS contexts', () => {
    const guard = new JwtAuthGuard(reflectorReturning(IS_PUBLIC_KEY, true));
    expect(guard.canActivate(wsContext(null))).toBe(true);
  });
});

describe('AuditThrottlerGuard — WebSocket contexts', () => {
  async function guardWith(storage: {
    increment: ReturnType<typeof vi.fn>;
  }): Promise<AuditThrottlerGuard> {
    const guard = new AuditThrottlerGuard(
      { throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }] } as never,
      storage as never,
      new Reflector(),
      { log: vi.fn().mockResolvedValue({}) } as never,
    );
    await guard.onModuleInit();
    return guard;
  }

  it('skips rate limiting for WS messages without touching HTTP request/response objects', async () => {
    const storage = { increment: vi.fn() };
    const guard = await guardWith(storage);
    await expect(guard.canActivate(wsContext({ data: {} }))).resolves.toBe(true);
    expect(storage.increment).not.toHaveBeenCalled();
  });

  it('still throttles HTTP requests (context-awareness does not weaken HTTP limits)', async () => {
    const storage = {
      increment: vi.fn().mockResolvedValue({
        totalHits: 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    };
    const guard = await guardWith(storage);
    await expect(guard.canActivate(httpContext())).resolves.toBe(true);
    expect(storage.increment).toHaveBeenCalledOnce();
  });
});
