import { env } from '../src/config/env';

/**
 * Fail fast unless the suite is pointed at a dedicated test database.
 *
 * Registered as a Vitest `setupFile`, so it runs before any test file — and
 * therefore before `resetDb()` can delete anything.
 *
 * This exists because tests truncate every table between cases. That is
 * harmless against `rival_test` and catastrophic against a real database, and
 * the only thing separating the two is a connection string in a file that is
 * easy to mistype, copy, or override from the shell.
 */

function databaseName(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}

const name = databaseName(env.DATABASE_URL);

if (env.NODE_ENV !== 'test') {
  throw new Error(
    `Refusing to run tests with NODE_ENV="${env.NODE_ENV}". Expected "test".`,
  );
}

if (!/test/i.test(name)) {
  throw new Error(
    [
      `Refusing to run tests against database "${name || '(unparseable)'}".`,
      '',
      'The suite truncates every table between tests, so it only runs against a',
      'database whose name contains "test". Check DATABASE_URL in .env.test.local',
      '(local override) or .env.test (committed default).',
    ].join('\n'),
  );
}
