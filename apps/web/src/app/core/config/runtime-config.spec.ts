import { describe, it, expect, vi, afterEach } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  RuntimeConfigError,
  initRuntimeConfig,
  provideRuntimeConfig,
  runtimeConfig,
  setRuntimeConfigForTests,
  validateApiBaseUrl,
} from './runtime-config';
import { API_CONFIG } from './api-config';

@Component({ template: '' })
class ProbeComponent {}

describe('validateApiBaseUrl', () => {
  it('accepts absolute http(s) URLs and strips trailing slashes', () => {
    expect(validateApiBaseUrl('https://api.example.com/api/', false)).toBe('https://api.example.com/api');
    expect(validateApiBaseUrl(' http://localhost:3000/api ', false)).toBe('http://localhost:3000/api');
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
    ['not a URL', 'api.example.com'],
    ['not a string', 42],
    ['wrong protocol', 'ftp://api.example.com'],
  ])('rejects %s', (_label, value) => {
    expect(() => validateApiBaseUrl(value, false)).toThrow(RuntimeConfigError);
  });

  it.each(['https://localhost/api', 'https://127.0.0.1/api', 'https://[::1]/api'])(
    'rejects local host %s in production (even over HTTPS)',
    (value) => {
      expect(() => validateApiBaseUrl(value, true)).toThrow(/local host/);
    },
  );

  it('rejects plain HTTP in production even for remote hosts', () => {
    expect(() => validateApiBaseUrl('http://api.example.com/api', true)).toThrow(/HTTPS/);
  });

  it('requires the API global prefix /api so endpoint joins stay well-formed', () => {
    expect(() => validateApiBaseUrl('https://api.example.com', true)).toThrow(/\/api/);
    expect(() => validateApiBaseUrl('https://api.example.com/WrongPrefix', false)).toThrow(/\/api/);
    expect(() => validateApiBaseUrl('https://api.example.com/api/', true)).not.toThrow();
  });

  it('joins endpoints without duplicated slashes or missing prefix', () => {
    const base = validateApiBaseUrl('https://api.example.com/api/', true);
    const endpoint = `${base}/extras/catalog`;
    expect(endpoint).toBe('https://api.example.com/api/extras/catalog');
    expect(endpoint.replace('https://', '')).not.toContain('//');
  });

  it('allows local hosts in development only', () => {
    expect(validateApiBaseUrl('http://localhost:3000/api', false)).toBe('http://localhost:3000/api');
  });
});

describe('initRuntimeConfig', () => {
  afterEach(() => setRuntimeConfigForTests(null));

  const fetchWith = (body: unknown, ok = true): typeof fetch =>
    vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }) as unknown as typeof fetch;
  const fetchMissing = (): typeof fetch => vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

  it('loads and validates config.json when present', async () => {
    await initRuntimeConfig(fetchWith({ apiBaseUrl: 'https://api.example.com/api/' }), true);
    expect(runtimeConfig()?.apiBaseUrl).toBe('https://api.example.com/api');
  });

  it('production without config.json fails loudly — never falls back', async () => {
    await expect(initRuntimeConfig(fetchWith(null, false), true)).rejects.toThrow(/missing/);
    expect(runtimeConfig()).toBeNull();
    await expect(initRuntimeConfig(fetchMissing(), true)).rejects.toThrow(/missing/);
  });

  it('production with a localhost config.json fails loudly', async () => {
    await expect(initRuntimeConfig(fetchWith({ apiBaseUrl: 'https://localhost/api' }), true)).rejects.toThrow(
      /local host/,
    );
    // Plain HTTP is rejected too, regardless of host.
    await expect(initRuntimeConfig(fetchWith({ apiBaseUrl: 'http://localhost:3000/api' }), true)).rejects.toThrow(
      RuntimeConfigError,
    );
  });

  it('development without config.json uses the environment value', async () => {
    await initRuntimeConfig(fetchMissing(), false);
    expect(runtimeConfig()?.apiBaseUrl).toBe('http://localhost:3000/api');
  });

  it('an invalid config value fails validation in any mode', async () => {
    await expect(initRuntimeConfig(fetchWith({ apiBaseUrl: 'not-a-url' }), false)).rejects.toThrow(RuntimeConfigError);
  });

  it('empty apiBaseUrl in config.json counts as missing', async () => {
    await expect(initRuntimeConfig(fetchWith({ apiBaseUrl: '  ' }), true)).rejects.toThrow(/missing/);
  });
});

describe('bootstrap integration (TestBed)', () => {
  afterEach(() => {
    setRuntimeConfigForTests(null);
    TestBed.resetTestingModule();
  });

  it('API_CONFIG resolves the runtime config.json value after initialization, not the baked-in default', async () => {
    // Deliberately deferred: proves the initializer completes before the app
    // tree is usable (Angular awaits app initializers during bootstrap).
    let resolveFetch: ((r: unknown) => void) | undefined;
    const pending = new Promise((resolve) => (resolveFetch = resolve));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        pending.then(() => ({ ok: true, json: () => Promise.resolve({ apiBaseUrl: 'https://runtime.example.com/api' }) })),
      ),
    );

    TestBed.configureTestingModule({ providers: [provideRuntimeConfig()] });
    const fixture = TestBed.createComponent(ProbeComponent);
    // Resolve config.json AFTER component creation has begun.
    resolveFetch!(undefined);
    await fixture.whenStable();

    expect(TestBed.inject(API_CONFIG).baseUrl).toBe('https://runtime.example.com/api');
    vi.unstubAllGlobals();
  });
});
