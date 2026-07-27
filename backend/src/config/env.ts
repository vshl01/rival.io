import dotenv from 'dotenv';
import { z } from 'zod';

const nodeEnv = process.env.NODE_ENV ?? 'development';

/**
 * Environment files, highest precedence first. `dotenv` never overwrites a key
 * that is already set, so the first file to define a key wins — and real
 * platform variables (Render, CI) beat every file.
 *
 * Split by purpose:
 *   `.env.development` / `.env.production` — committed, NON-SECRET per-env
 *      settings: which frontend origin CORS allows, cookie flags.
 *   `.env`  — gitignored; secrets and machine-local values (DB URL, JWT keys).
 *   `*.local` — gitignored personal overrides, for when you need to deviate.
 *
 * Tests stay deliberately isolated: they load ONLY `.env.test`, so a stray
 * DATABASE_URL in `.env` can never point the suite (which truncates tables) at
 * a real database.
 */
const envFiles =
  nodeEnv === 'test'
    ? ['.env.test.local', '.env.test']
    : [`.env.${nodeEnv}.local`, `.env.${nodeEnv}`, '.env'];

for (const path of envFiles) dotenv.config({ path });

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

const corsOrigins = raw.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const corsAllowAll = corsOrigins.includes('*');

// A wildcard origin plus `credentials: true` lets any site on the internet make
// authenticated calls to this API. Tolerable locally, never in production —
// fail at boot rather than silently shipping it.
if (raw.NODE_ENV === 'production' && corsAllowAll) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ CORS_ORIGINS="*" is not allowed when NODE_ENV=production.\n' +
      '   Set it to your frontend origin(s), e.g. CORS_ORIGINS="https://rival-io.vercel.app"',
  );
  process.exit(1);
}

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins,
  // Only ever true outside production (guarded above): reflects the request
  // origin so credentialed requests still work during local development.
  corsAllowAll,
};

export type Env = typeof env;
