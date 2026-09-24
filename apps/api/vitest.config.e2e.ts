import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    // SWC emitDecoratorMetadata so class-validator DTOs validate in tests.
    swc.vite({ module: { type: 'es6' } }),
    tsconfigPaths(),
  ],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup.ts'],
    // E2E specs share one test database — never run files in parallel.
    fileParallelism: false,
  },
});
