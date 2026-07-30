import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, auth, disconnect, makeUser, resetDb } from './helpers';

/**
 * Cycles (month blocks) and the sprints inside them.
 *
 * The two things most worth pinning down: cycles must appear WITHOUT anyone
 * creating them, and sprint numbers must be unique per cycle even when two
 * assigners create at the same instant.
 */

/** The current month as `YYYY-MM`, in the same zone the service uses. */
function currentCycleKey(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  return `${year}-${month}`;
}

/** An org plus its assigner, and a worker who belongs to it. */
async function makeOrgWithWorker() {
  const assigner = await makeUser();
  const created = await request(app).post('/api/orgs').set(auth(assigner.token)).send({ name: 'Acme Corp' });
  const slug = created.body.data.slug as string;

  const worker = await makeUser();
  const req = await request(app).post(`/api/orgs/${slug}/join-requests`).set(auth(worker.token)).send({});
  await request(app)
    .post(`/api/orgs/${slug}/join-requests/${req.body.data.id}/accept`)
    .set(auth(assigner.token));

  return { assigner, worker, slug };
}

const sprintBody = (name = 'Sprint one') => ({
  name,
  startsAt: '2026-07-01T09:00:00.000Z',
  deadline: '2026-07-14T17:00:00.000Z',
});

beforeEach(resetDb);
afterAll(disconnect);

describe('GET /api/orgs/:slug/cycles', () => {
  it('creates the rolling window on read, without anybody creating cycles', async () => {
    const { assigner, slug } = await makeOrgWithWorker();

    // Nothing exists until the window is read for the first time.
    expect(await prisma.cycle.count()).toBe(0);

    const res = await request(app).get(`/api/orgs/${slug}/cycles`).set(auth(assigner.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3); // current month + next two
    expect(res.body.data[0].cycle).toBe(currentCycleKey());
    expect(await prisma.cycle.count()).toBe(3);
  });

  it('is idempotent — reading twice does not duplicate months', async () => {
    const { assigner, slug } = await makeOrgWithWorker();

    await request(app).get(`/api/orgs/${slug}/cycles`).set(auth(assigner.token));
    await request(app).get(`/api/orgs/${slug}/cycles`).set(auth(assigner.token));

    expect(await prisma.cycle.count()).toBe(3);
  });

  it('returns consecutive months that roll over the year correctly', async () => {
    const { assigner, slug } = await makeOrgWithWorker();

    const res = await request(app).get(`/api/orgs/${slug}/cycles?months=12`).set(auth(assigner.token));

    const keys = res.body.data.map((c: { cycle: string }) => c.cycle);
    expect(keys).toHaveLength(12);
    // Every key is a valid YYYY-MM and strictly increasing.
    expect(keys.every((k: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(k))).toBe(true);
    expect([...keys].sort()).toEqual(keys);
    expect(new Set(keys).size).toBe(12);
  });

  it('caps how many months may be requested', async () => {
    const { assigner, slug } = await makeOrgWithWorker();
    const res = await request(app).get(`/api/orgs/${slug}/cycles?months=999`).set(auth(assigner.token));
    expect(res.status).toBe(400);
  });

  it('lets a worker read the window', async () => {
    const { worker, slug } = await makeOrgWithWorker();
    expect((await request(app).get(`/api/orgs/${slug}/cycles`).set(auth(worker.token))).status).toBe(200);
  });

  it('denies a non-member', async () => {
    const { slug } = await makeOrgWithWorker();
    const outsider = await makeUser();
    expect((await request(app).get(`/api/orgs/${slug}/cycles`).set(auth(outsider.token))).status).toBe(403);
  });

  it('404s a month that has never been opened, rather than creating it', async () => {
    const { assigner, slug } = await makeOrgWithWorker();

    const res = await request(app).get(`/api/orgs/${slug}/cycles/2026-01`).set(auth(assigner.token));

    expect(res.status).toBe(404);
    expect(await prisma.cycle.count()).toBe(0);
  });

  it('rejects a malformed cycle key', async () => {
    const { assigner, slug } = await makeOrgWithWorker();
    for (const bad of ['2026-13', '26-07', 'july', '2026-7']) {
      const res = await request(app).get(`/api/orgs/${slug}/cycles/${bad}`).set(auth(assigner.token));
      expect(res.status, bad).toBe(400);
    }
  });
});

describe('POST .../cycles/:cycle/sprints', () => {
  it('creates a sprint, numbers it 1, and makes the creator its assigner', async () => {
    const { assigner, slug } = await makeOrgWithWorker();
    const cycle = currentCycleKey();

    const res = await request(app)
      .post(`/api/orgs/${slug}/cycles/${cycle}/sprints`)
      .set(auth(assigner.token))
      .send(sprintBody());

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ number: 1, name: 'Sprint one', cycle });
    expect(res.body.data.assigner.id).toBe(assigner.user.id);
  });

  it('opens the month on demand if it does not exist yet', async () => {
    const { assigner, slug } = await makeOrgWithWorker();
    expect(await prisma.cycle.count()).toBe(0);

    const res = await request(app)
      .post(`/api/orgs/${slug}/cycles/${currentCycleKey()}/sprints`)
      .set(auth(assigner.token))
      .send(sprintBody());

    expect(res.status).toBe(201);
    expect(await prisma.cycle.count()).toBe(1);
  });

  it('numbers sprints sequentially within a cycle', async () => {
    const { assigner, slug } = await makeOrgWithWorker();
    const cycle = currentCycleKey();

    for (const expected of [1, 2, 3]) {
      const res = await request(app)
        .post(`/api/orgs/${slug}/cycles/${cycle}/sprints`)
        .set(auth(assigner.token))
        .send(sprintBody(`Sprint ${expected}`));
      expect(res.body.data.number).toBe(expected);
    }
  });

  /**
   * The number comes from an atomic `{ increment: 1 }`, so simultaneous creates
   * must not collide on `@@unique([cycleId, number])` or reuse a number.
   */
  it('assigns unique numbers under concurrent creation', async () => {
    const { assigner, slug } = await makeOrgWithWorker();
    const cycle = currentCycleKey();

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post(`/api/orgs/${slug}/cycles/${cycle}/sprints`)
          .set(auth(assigner.token))
          .send(sprintBody(`Concurrent ${i}`)),
      ),
    );

    expect(responses.every((r) => r.status === 201)).toBe(true);
    const numbers = responses.map((r) => r.body.data.number).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  });

  it('restarts numbering in each cycle', async () => {
    const { assigner, slug } = await makeOrgWithWorker();
    const [thisMonth, nextMonth] = (
      await request(app).get(`/api/orgs/${slug}/cycles`).set(auth(assigner.token))
    ).body.data.map((c: { cycle: string }) => c.cycle);

    const a = await request(app)
      .post(`/api/orgs/${slug}/cycles/${thisMonth}/sprints`)
      .set(auth(assigner.token))
      .send(sprintBody('Alpha'));
    const b = await request(app)
      .post(`/api/orgs/${slug}/cycles/${nextMonth}/sprints`)
      .set(auth(assigner.token))
      .send(sprintBody('Beta'));

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.data.number).toBe(1);
    expect(b.body.data.number).toBe(1);
  });

  it('refuses a worker', async () => {
    const { worker, slug } = await makeOrgWithWorker();
    const res = await request(app)
      .post(`/api/orgs/${slug}/cycles/${currentCycleKey()}/sprints`)
      .set(auth(worker.token))
      .send(sprintBody());
    expect(res.status).toBe(403);
  });

  it('refuses a non-member', async () => {
    const { slug } = await makeOrgWithWorker();
    const outsider = await makeUser();
    const res = await request(app)
      .post(`/api/orgs/${slug}/cycles/${currentCycleKey()}/sprints`)
      .set(auth(outsider.token))
      .send(sprintBody());
    expect(res.status).toBe(403);
  });

  it('requires the deadline to be after the start', async () => {
    const { assigner, slug } = await makeOrgWithWorker();
    const res = await request(app)
      .post(`/api/orgs/${slug}/cycles/${currentCycleKey()}/sprints`)
      .set(auth(assigner.token))
      .send({
        name: 'Backwards',
        startsAt: '2026-07-14T09:00:00.000Z',
        deadline: '2026-07-01T09:00:00.000Z',
      });
    expect(res.status).toBe(400);
  });

  it('allows a deadline outside the cycle’s own month', async () => {
    const { assigner, slug } = await makeOrgWithWorker();
    // The cycle is an organisational bucket, not a date constraint (docs §2).
    const res = await request(app)
      .post(`/api/orgs/${slug}/cycles/${currentCycleKey()}/sprints`)
      .set(auth(assigner.token))
      .send({
        name: 'Spills over',
        startsAt: '2026-07-20T09:00:00.000Z',
        deadline: '2026-09-05T17:00:00.000Z',
      });
    expect(res.status).toBe(201);
  });

  it('refuses a month far outside the allowed range', async () => {
    const { assigner, slug } = await makeOrgWithWorker();
    const res = await request(app)
      .post(`/api/orgs/${slug}/cycles/2099-01/sprints`)
      .set(auth(assigner.token))
      .send(sprintBody());
    expect(res.status).toBe(400);
  });
});

describe('reading, updating and deleting a sprint', () => {
  /** Org with one sprint already created in the current cycle. */
  async function makeSprint() {
    const ctx = await makeOrgWithWorker();
    const cycle = currentCycleKey();
    const res = await request(app)
      .post(`/api/orgs/${ctx.slug}/cycles/${cycle}/sprints`)
      .set(auth(ctx.assigner.token))
      .send(sprintBody());
    return { ...ctx, cycle, sprint: res.body.data };
  }

  it('reads a sprint by its cycle and number', async () => {
    const { assigner, slug, cycle } = await makeSprint();
    const res = await request(app)
      .get(`/api/orgs/${slug}/cycles/${cycle}/sprints/1`)
      .set(auth(assigner.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ number: 1, name: 'Sprint one', cycle });
  });

  it('lists sprints in a cycle for any member', async () => {
    const { worker, slug, cycle } = await makeSprint();
    const res = await request(app)
      .get(`/api/orgs/${slug}/cycles/${cycle}/sprints`)
      .set(auth(worker.token));
    expect(res.body.data).toHaveLength(1);
  });

  it('404s a number that exists in a different cycle', async () => {
    const { assigner, slug } = await makeSprint();
    const nextMonth = (
      await request(app).get(`/api/orgs/${slug}/cycles`).set(auth(assigner.token))
    ).body.data[1].cycle as string;

    // Sprint 1 exists — but in the current month, not this one.
    const res = await request(app)
      .get(`/api/orgs/${slug}/cycles/${nextMonth}/sprints/1`)
      .set(auth(assigner.token));
    expect(res.status).toBe(404);
  });

  it('never resolves a sprint from another organisation', async () => {
    const first = await makeSprint();
    const other = await makeOrgWithWorker();

    const res = await request(app)
      .get(`/api/orgs/${other.slug}/cycles/${first.cycle}/sprints/1`)
      .set(auth(other.assigner.token));
    expect(res.status).toBe(404);
  });

  it('lets an assigner rename it', async () => {
    const { assigner, slug, cycle } = await makeSprint();
    const res = await request(app)
      .patch(`/api/orgs/${slug}/cycles/${cycle}/sprints/1`)
      .set(auth(assigner.token))
      .send({ name: 'Renamed sprint' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed sprint');
  });

  it('validates a single date change against the stored counterpart', async () => {
    const { assigner, slug, cycle } = await makeSprint();

    // Only the deadline is sent, and it lands before the stored startsAt.
    const res = await request(app)
      .patch(`/api/orgs/${slug}/cycles/${cycle}/sprints/1`)
      .set(auth(assigner.token))
      .send({ deadline: '2026-06-01T09:00:00.000Z' });

    expect(res.status).toBe(400);
  });

  it('refuses an empty update', async () => {
    const { assigner, slug, cycle } = await makeSprint();
    const res = await request(app)
      .patch(`/api/orgs/${slug}/cycles/${cycle}/sprints/1`)
      .set(auth(assigner.token))
      .send({});
    expect(res.status).toBe(400);
  });

  it('refuses a worker updating or deleting', async () => {
    const { worker, slug, cycle } = await makeSprint();

    expect(
      (
        await request(app)
          .patch(`/api/orgs/${slug}/cycles/${cycle}/sprints/1`)
          .set(auth(worker.token))
          .send({ name: 'Nope' })
      ).status,
    ).toBe(403);
    expect(
      (await request(app).delete(`/api/orgs/${slug}/cycles/${cycle}/sprints/1`).set(auth(worker.token)))
        .status,
    ).toBe(403);
  });

  it('lets an assigner delete it, and does not reuse the number', async () => {
    const { assigner, slug, cycle } = await makeSprint();

    expect(
      (await request(app).delete(`/api/orgs/${slug}/cycles/${cycle}/sprints/1`).set(auth(assigner.token)))
        .status,
    ).toBe(200);
    expect(
      (await request(app).get(`/api/orgs/${slug}/cycles/${cycle}/sprints/1`).set(auth(assigner.token)))
        .status,
    ).toBe(404);

    // The counter only moves forward, so the next sprint is 2 — a deleted
    // sprint's identity is never inherited by a new one.
    const next = await request(app)
      .post(`/api/orgs/${slug}/cycles/${cycle}/sprints`)
      .set(auth(assigner.token))
      .send(sprintBody('After delete'));
    expect(next.body.data.number).toBe(2);
  });

  it('deletes an org’s sprints and cycles with it', async () => {
    const { slug } = await makeSprint();
    const org = await prisma.organization.findUniqueOrThrow({ where: { slug } });

    await prisma.organization.delete({ where: { id: org.id } });

    expect(await prisma.sprint.count()).toBe(0);
    expect(await prisma.cycle.count()).toBe(0);
  });
});
