import dotenv from 'dotenv';
import { z } from 'zod';

// Tests must never touch the development database (their setup wipes tables
// between runs). When NODE_ENV=test we load `.env.test`, which points at a
// dedicated test database. CI sets these vars directly, so a missing file is
// fine — `dotenv` won't override variables already present in the environment.
dotenv.config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

/**
 * Validate the process environment once at boot. If anything is missing or
 * malformed we crash immediately with a readable message rather than failing
 * mysteriously deep in a request handler.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5_242_880),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ Invalid environment variables:\n',
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  // CORS_ORIGINS="*" reflects any request origin (works with credentials,
  // unlike a literal "*" header). Use a fixed allow-list in real production.
  corsAllowAll: raw.CORS_ORIGINS.split(',').map((o) => o.trim()).includes('*'),
};

export type Env = typeof env;
