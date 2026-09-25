import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';

export default defineConfig({
  // esbuild (vitest's default transform) does not emit decorator metadata, which
  // silently disables ValidationPipe/\@Transform in e2e while production (tsc)
  // validates. SWC emits legacy decorator metadata so e2e matches production.
  plugins: [
    tsconfigPaths(),
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2023',
      },
    }),
  ],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup.ts'],
    // E2E must never send real email regardless of the developer's local .env.
    // Adapter selection itself is unit-tested in src/mail/mail.module.spec.ts.
    env: {
      NOTIFICATION_PROVIDER: 'mock',
    },
    // All e2e suites share one test database and truncate it in beforeEach,
    // so files must run one at a time to avoid TRUNCATE lock contention.
    fileParallelism: false,
    // Real Argon2id hashing + real Postgres on a loaded dev machine need headroom.
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
