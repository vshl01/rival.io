import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, auth, disconnect, makeUser, resetDb } from './helpers';

/**
 * Sprint tickets — the org-scoped half of the Ticket model.
 *
 * The rules being pinned down (docs/architecture.md §3):
 *   · both roles create and update; only assigners delete
 *   · keys are issued per organisation and never reused
 *   · a ticket is invisible outside its organisation
 *   · personal tasks never appear on a board, and vice versa
 */

function currentCycleKey(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}`;
}

/** An org with a sprint, its assigner, and a worker who belongs to it. */
async function makeSprintWorkspace() {
  const assigner = await makeUser();
  const org = (await request(app).post('/api/orgs').set(auth(assigner.token)).send({ name: 'Acme Corp' }))
    .body.data;

  const worker = await makeUser();
  const req = await request(app)
    .post(`/api/orgs/${org.slug}/join-requests`)
    .set(auth(worker.token))
    .send({});
  await request(app)
    .post(`/api/orgs/${org.slug}/join-requests/${req.body.data.id}/accept`)
    .set(auth(assigner.token));

  const cycle = currentCycleKey();
  // Dates are derived from the cycle: a sprint must start in the month it is
  // filed under, so a hardcoded July would fail from August onwards.
  const [year, month] = cycle.split('-').map(Number);
  const day = (n: number, hour = 9) => new Date(Date.UTC(year, month - 1, n, hour)).toISOString();
  await request(app)
    .post(`/api/orgs/${org.slug}/cycles/${cycle}/sprints`)
    .set(auth(assigner.token))
    .send({ name: 'Sprint one', startsAt: day(2), deadline: day(15, 17) });

  const board = `/api/orgs/${org.slug}/cycles/${cycle}/sprints/1/tickets`;
  return { assigner, worker, org, cycle, board };
}

beforeEach(resetDb);
afterAll(disconnect);

describe('creating tickets in a sprint', () => {
  it('issues a readable key from the org prefix', async () => {
    const { assigner, board, org } = await makeSprintWorkspace();

    const res = await request(app).post(board).set(auth(assigner.token)).send({ title: 'First ticket' });

    expect(res.status).toBe(201);
    expect(res.body.data.key).toBe(`${org.key}-1`);
    expect(res.body.data.sprint.number).toBe(1);
  });

  it('lets a WORKER create a ticket', async () => {
    const { worker, board } = await makeSprintWorkspace();
    const res = await request(app).post(board).set(auth(worker.token)).send({ title: 'Worker made this' });
    expect(res.status).toBe(201);
  });

  it('numbers keys sequentially and uniquely under concurrency', async () => {
    const { assigner, board, org } = await makeSprintWorkspace();

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        request(app).post(board).set(auth(assigner.token)).send({ title: `Concurrent ${i}` }),
      ),
    );

    expect(responses.every((r) => r.status === 201)).toBe(true);
    const keys = responses.map((r) => r.body.data.key).sort();
    expect(new Set(keys).size).toBe(5);
    expect(keys).toEqual([1, 2, 3, 4, 5].map((n) => `${org.key}-${n}`).sort());
  });

  it('accepts several assignees at creation', async () => {
    const { worker, assigner, board } = await makeSprintWorkspace();

    // A worker assigning to the assigner — allowed, per the permission matrix.
    const res = await request(app)
      .post(board)
      .set(auth(worker.token))
      .send({ title: 'Please look at this', assigneeIds: [assigner.user.id] });

    expect(res.status).toBe(201);
    expect(res.body.data.assignees.map((a: { id: string }) => a.id)).toEqual([assigner.user.id]);
  });

  it('refuses an assignee who is not in the organisation', async () => {
    const { assigner, board } = await makeSprintWorkspace();
    const outsider = await makeUser();

    const res = await request(app)
      .post(board)
      .set(auth(assigner.token))
      .send({ title: 'Nope', assigneeIds: [outsider.user.id] });

    expect(res.status).toBe(400);
  });

  it('refuses a non-member entirely', async () => {
    const { board } = await makeSprintWorkspace();
    const outsider = await makeUser();
    expect((await request(app).post(board).set(auth(outsider.token)).send({ title: 'x' })).status).toBe(
      403,
    );
    expect((await request(app).get(board).set(auth(outsider.token))).status).toBe(403);
  });

  it('404s a sprint that does not exist', async () => {
    const { assigner, org, cycle } = await makeSprintWorkspace();
    const res = await request(app)
      .post(`/api/orgs/${org.slug}/cycles/${cycle}/sprints/99/tickets`)
      .set(auth(assigner.token))
      .send({ title: 'Nowhere' });
    expect(res.status).toBe(404);
  });
});

describe('the two kinds stay separate', () => {
  it('keeps sprint tickets off the personal task list', async () => {
    const { assigner, board } = await makeSprintWorkspace();

    await request(app).post(board).set(auth(assigner.token)).send({ title: 'Org ticket' });
    await request(app).post('/api/tasks').set(auth(assigner.token)).send({ title: 'Personal task' });

    const personal = await request(app).get('/api/tasks').set(auth(assigner.token));
    expect(personal.body.data).toHaveLength(1);
    expect(personal.body.data[0].title).toBe('Personal task');
    expect(personal.body.data[0].key).toBeNull();
  });

  it('keeps personal tasks off the sprint board', async () => {
    const { assigner, board } = await makeSprintWorkspace();

    await request(app).post('/api/tasks').set(auth(assigner.token)).send({ title: 'Personal task' });
    await request(app).post(board).set(auth(assigner.token)).send({ title: 'Org ticket' });

    const boardRes = await request(app).get(board).set(auth(assigner.token));
    expect(boardRes.body.data).toHaveLength(1);
    expect(boardRes.body.data[0].title).toBe('Org ticket');
  });

  it('gives a personal task no key at all', async () => {
    const user = await makeUser();
    const res = await request(app).post('/api/tasks').set(auth(user.token)).send({ title: 'Mine' });
    expect(res.body.data.key).toBeNull();
    expect(res.body.data.sprint).toBeNull();
  });
});

describe('reading and updating a ticket', () => {
  /** Workspace plus one ticket created by the assigner. */
  async function withTicket() {
    const ctx = await makeSprintWorkspace();
    const ticket = (
      await request(app).post(ctx.board).set(auth(ctx.assigner.token)).send({ title: 'Shared work' })
    ).body.data;
    return { ...ctx, ticket };
  }

  it('is visible to every member, not just its creator', async () => {
    const { worker, ticket } = await withTicket();
    const res = await request(app).get(`/api/tasks/${ticket.id}`).set(auth(worker.token));
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Shared work');
  });

  it('is invisible outside the organisation', async () => {
    const { ticket } = await withTicket();
    const outsider = await makeUser();
    expect((await request(app).get(`/api/tasks/${ticket.id}`).set(auth(outsider.token))).status).toBe(403);
  });

  it('lets a WORKER update someone else’s ticket', async () => {
    const { worker, ticket } = await withTicket();

    const res = await request(app)
      .patch(`/api/tasks/${ticket.id}`)
      .set(auth(worker.token))
      .send({ status: 'IN_PROGRESS', title: 'Retitled by the worker' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Retitled by the worker');
  });

  it('records who changed what, with a field-level diff', async () => {
    const { worker, ticket } = await withTicket();

    await request(app)
      .patch(`/api/tasks/${ticket.id}`)
      .set(auth(worker.token))
      .send({ title: 'Renamed' });

    const activity = await request(app)
      .get(`/api/tasks/${ticket.id}/activity`)
      .set(auth(worker.token));

    const update = activity.body.data.find((a: { action: string }) => a.action === 'ticket.updated');
    expect(update.actor.id).toBe(worker.user.id);
    expect(update.actor.name).toBe(worker.user.name ?? update.actor.name);
    expect(update.metadata.changes.title).toEqual({ from: 'Shared work', to: 'Renamed' });
  });

  it('replaces the whole assignee set and logs who changed', async () => {
    const { worker, assigner, board } = await withTicket();

    // Starts on the worker…
    const created = (
      await request(app)
        .post(board)
        .set(auth(assigner.token))
        .send({ title: 'Hand-off', assigneeIds: [worker.user.id] })
    ).body.data;

    // …then the worker hands it to both of them.
    const res = await request(app)
      .patch(`/api/tasks/${created.id}`)
      .set(auth(worker.token))
      .send({ assigneeIds: [worker.user.id, assigner.user.id] });

    expect(res.status).toBe(200);
    expect(new Set(res.body.data.assignees.map((a: { id: string }) => a.id))).toEqual(
      new Set([worker.user.id, assigner.user.id]),
    );

    // …then off the worker entirely. PATCH replaces, it does not merge.
    const replaced = await request(app)
      .patch(`/api/tasks/${created.id}`)
      .set(auth(worker.token))
      .send({ assigneeIds: [assigner.user.id] });

    expect(replaced.body.data.assignees.map((a: { id: string }) => a.id)).toEqual([assigner.user.id]);

    // A relation change is invisible to the scalar diff, so it is logged by hand.
    const activity = await request(app)
      .get(`/api/tasks/${created.id}/activity`)
      .set(auth(worker.token));
    const entries = activity.body.data.filter(
      (a: { action: string }) => a.action === 'ticket.assignees_changed',
    );

    expect(entries).toHaveLength(2);
    // Newest first: the removal of the worker.
    expect(entries[0].metadata).toEqual({ added: [], removed: [worker.user.name] });
    expect(entries[1].metadata).toEqual({ added: [assigner.user.name], removed: [] });
  });

  it('refuses an assignee outside the org on update', async () => {
    const { worker, ticket } = await withTicket();
    const outsider = await makeUser();

    const res = await request(app)
      .patch(`/api/tasks/${ticket.id}`)
      .set(auth(worker.token))
      .send({ assigneeIds: [outsider.user.id] });

    expect(res.status).toBe(400);
  });

  it('refuses an update from a non-member', async () => {
    const { ticket } = await withTicket();
    const outsider = await makeUser();
    const res = await request(app)
      .patch(`/api/tasks/${ticket.id}`)
      .set(auth(outsider.token))
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(403);
  });
});

describe('deleting is assigner-only', () => {
  async function withWorkerTicket() {
    const ctx = await makeSprintWorkspace();
    // Created BY the worker, so this also proves creators do not get delete rights.
    const ticket = (
      await request(app).post(ctx.board).set(auth(ctx.worker.token)).send({ title: 'Worker’s own' })
    ).body.data;
    return { ...ctx, ticket };
  }

  it('refuses a worker deleting even their own ticket', async () => {
    const { worker, ticket } = await withWorkerTicket();

    const res = await request(app).delete(`/api/tasks/${ticket.id}`).set(auth(worker.token));

    expect(res.status).toBe(403);
    // And it really is still there.
    expect(await prisma.ticket.count({ where: { id: ticket.id } })).toBe(1);
  });

  it('lets an assigner delete a ticket they did not create', async () => {
    const { assigner, ticket } = await withWorkerTicket();

    const res = await request(app).delete(`/api/tasks/${ticket.id}`).set(auth(assigner.token));

    expect(res.status).toBe(200);
    expect(await prisma.ticket.count({ where: { id: ticket.id } })).toBe(0);
  });

  it('never reuses a key after a delete', async () => {
    const { assigner, board, org, ticket } = await withWorkerTicket();

    await request(app).delete(`/api/tasks/${ticket.id}`).set(auth(assigner.token));
    const next = await request(app).post(board).set(auth(assigner.token)).send({ title: 'After delete' });

    expect(next.body.data.key).toBe(`${org.key}-2`);
  });

  it('still lets someone delete their own personal task', async () => {
    const user = await makeUser();
    const task = (await request(app).post('/api/tasks').set(auth(user.token)).send({ title: 'Mine' }))
      .body.data;

    expect((await request(app).delete(`/api/tasks/${task.id}`).set(auth(user.token))).status).toBe(200);
  });

  it('deletes a sprint’s tickets with it', async () => {
    const { assigner, board, org, cycle } = await makeSprintWorkspace();
    await request(app).post(board).set(auth(assigner.token)).send({ title: 'Doomed' });

    await request(app)
      .delete(`/api/orgs/${org.slug}/cycles/${cycle}/sprints/1`)
      .set(auth(assigner.token));

    expect(await prisma.ticket.count()).toBe(0);
  });
});
