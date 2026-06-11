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
    // Ensures `src/config/env.ts` loads `.env.test` (the dedicated test DB).
    env: { NODE_ENV: 'test' },
  },
});
