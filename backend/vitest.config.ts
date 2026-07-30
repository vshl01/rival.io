import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    fileParallelism: false, // share one database; run test files sequentially
    hookTimeout: 30_000,
    testTimeout: 30_000,
    // Ensures `src/config/env.ts` loads `.env.test.local` then `.env.test`.
    env: { NODE_ENV: 'test' },
    // Aborts the run if DATABASE_URL is not a test database — the suite
    // truncates tables, so this must be checked before anything executes.
    setupFiles: ['./tests/db-guard.ts'],
  },
});
