import fs from 'node:fs';
import path from 'node:path';

/**
 * Refuse to start if another copy of the suite is already running.
 *
 * Every test truncates every table (`resetDb`), and the test database is shared —
 * one machine, one Neon branch. Two concurrent runs therefore delete each other's
 * fixtures mid-test, and the symptoms look nothing like the cause: a `POST` that
 * returns 201 for a row that no longer exists, unique-constraint failures on
 * slugs nobody typed twice, and `deadlock detected` from two `deleteMany` batches
 * meeting in the middle. That is an hour of debugging the wrong thing, so it is
 * worth twenty lines to make it impossible.
 *
 * Runs once per vitest invocation (not per file), which is exactly the scope of
 * "one run".
 */
const LOCK = path.join(__dirname, '..', 'node_modules', '.cache', 'rival-test.lock');

/** Is a process with this pid still alive? Signal 0 checks without signalling. */
function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    // ESRCH — no such process. EPERM would mean it exists but is not ours, which
    // cannot happen for a suite we started, so treat anything else as stale.
    return false;
  }
}

/** The pid holding the lock, or 0 if there is no lock (the normal case). */
function readLock(): number {
  try {
    return Number(fs.readFileSync(LOCK, 'utf8').trim()) || 0;
  } catch {
    return 0;
  }
}

export function setup() {
  const existing = readLock();
  // Only a LIVE holder is a conflict — a killed run leaves its lock behind, and
  // refusing to start because of that would be worse than the race it prevents.
  if (existing && existing !== process.pid && isRunning(existing)) {
    throw new Error(
      [
        `Another test run (pid ${existing}) is already using the test database.`,
        '',
        'The suite truncates every table between tests, so two runs corrupt each',
        "other's fixtures. Wait for that run to finish, or kill it:",
        `  kill ${existing}`,
      ].join('\n'),
    );
  }
  writeLock();
}

function writeLock() {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  fs.writeFileSync(LOCK, String(process.pid), 'utf8');
}

export function teardown() {
  try {
    if (Number(fs.readFileSync(LOCK, 'utf8').trim()) === process.pid) fs.rmSync(LOCK);
  } catch {
    // Already gone, or never written. Nothing to clean up.
  }
}
