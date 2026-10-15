import { provideAppInitializer } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Runtime API configuration. The API base URL is deployment-specific, so a
 * production build must NOT bake in a fake or local address: the deploy
 * pipeline drops a `config.json` next to index.html (e.g. via ConfigMap,
 * environment-specific asset, or CDN rewrite) and the app loads it before
 * bootstrap completes.
 *
 * Failure policy: production without a valid, non-local config.json fails
 * bootstrap loudly — it never silently falls back to localhost. Development
 * keeps working with the environment.ts value when no config.json exists.
 */
export interface RuntimeConfig {
  apiBaseUrl: string;
}

export class RuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeConfigError';
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Validates a candidate API base URL. Production requires HTTPS and rejects
 * local hosts; the path must end in the API's global prefix (`/api`, see
 * apps/api/src/main.ts setGlobalPrefix) so endpoint joins stay well-formed.
 */
export function validateApiBaseUrl(value: unknown, production: boolean): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RuntimeConfigError(
      'API base URL is missing. Deploy a config.json containing {"apiBaseUrl": "https://<api-host>/api"} next to index.html.',
    );
  }
  const trimmed = value.trim().replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new RuntimeConfigError('API base URL is not a valid absolute URL (expected e.g. https://api.example.com/api).');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new RuntimeConfigError(`API base URL must use http(s) — got protocol "${url.protocol}".`);
  }
  if (production && url.protocol !== 'https:') {
    throw new RuntimeConfigError('Production API base URL must use HTTPS — plain HTTP would expose session cookies and tokens.');
  }
  if (production && LOCAL_HOSTS.has(url.hostname)) {
    throw new RuntimeConfigError(
      'Production API base URL points at a local host — the deployed config.json was not replaced. Refusing to start with a development address.',
    );
  }
  if (!url.pathname.endsWith('/api')) {
    throw new RuntimeConfigError(
      `API base URL must end with the API's global prefix "/api" (got path "${url.pathname || '/'}") — otherwise endpoint URLs would miss the prefix.`,
    );
  }
  return trimmed;
}

/** Mutable holder filled by the app initializer before any service injects API_CONFIG. */
const state: { config: RuntimeConfig | null } = { config: null };

export function runtimeConfig(): RuntimeConfig | null {
  return state.config;
}

/** Test hook: inject a config without running the app initializer. */
export function setRuntimeConfigForTests(config: RuntimeConfig | null): void {
  state.config = config;
}

async function fetchRuntimeConfig(fetchImpl: typeof fetch): Promise<unknown> {
  // no-store: a stale config.json after a deployment would silently point the
  // app at the wrong API. Deployments should ALSO serve config.json with
  // `Cache-Control: no-store` (or a short max-age) — never immutable caching.
  const res = await fetchImpl('config.json', { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

/** The initializer body, injectable-fetchable for tests. Throws RuntimeConfigError on invalid/missing production config. */
export async function initRuntimeConfig(
  fetchImpl: typeof fetch = fetch,
  production: boolean = environment.production,
): Promise<RuntimeConfig> {
  let fromFile: unknown = null;
  try {
    fromFile = await fetchRuntimeConfig(fetchImpl);
  } catch {
    // Treated as absent; the environment rules below decide whether that is fatal.
  }
  const candidate = (fromFile as { apiBaseUrl?: unknown } | null)?.apiBaseUrl;
  if (candidate !== undefined && candidate !== null && candidate !== '') {
    state.config = { apiBaseUrl: validateApiBaseUrl(candidate, production) };
    return state.config;
  }
  if (production) {
    throw new RuntimeConfigError(
      'Production API configuration is missing: no config.json with a non-local "apiBaseUrl" was served. Deployment must provide it — there is no fallback.',
    );
  }
  state.config = { apiBaseUrl: validateApiBaseUrl(environment.apiBaseUrl, false) };
  return state.config;
}

export function provideRuntimeConfig() {
  return provideAppInitializer(() => initRuntimeConfig());
}
