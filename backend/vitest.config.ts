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
    /**
     * Generous because the suite may run against a REMOTE database.
     *
     * Fixtures build state through the real API (signup, org, join request,
     * accept, sprint), so one test can be a dozen sequential round trips. Against
     * Neon that approaches 30s and tests fail as timeouts rather than assertions —
     * which reads as a broken feature when nothing is wrong.
     *
     * Pointing `.env.test.local` at a local Postgres makes the suite roughly an
     * order of magnitude faster, and these limits then never come close.
     */
    hookTimeout: 90_000,
    testTimeout: 90_000,
    // Ensures `src/config/env.ts` loads `.env.test.local` then `.env.test`.
    env: { NODE_ENV: 'test' },
    // Aborts the run if DATABASE_URL is not a test database — the suite
    // truncates tables, so this must be checked before anything executes.
    setupFiles: ['./tests/db-guard.ts'],
    /**
     * Refuses to start while another run holds the database.
     *
     * Separate from `setupFiles` because it must run ONCE per invocation, not once
     * per test file — "one run at a time" is the thing being enforced.
     */
    globalSetup: ['./tests/global-setup.ts'],
  },
});
