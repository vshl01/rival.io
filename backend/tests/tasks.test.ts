import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, disconnect, makeUser, resetDb } from './helpers';

describe('Tasks CRUD + authorization', () => {
  beforeEach(resetDb);
  afterAll(disconnect);

  it('requires authentication for all task routes (401)', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('creates, reads, updates and deletes a task for its owner', async () => {
    const u = await makeUser();

    // Create
    const created = await request(app)
      .post('/api/tasks')
      .set(auth(u.token))
      .send({ title: 'Write tests', priority: 'HIGH', dueDate: '2026-07-01' });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect(created.body.data).toMatchObject({ title: 'Write tests', status: 'TODO', priority: 'HIGH' });

    // Read one
    const fetched = await request(app).get(`/api/tasks/${id}`).set(auth(u.token));
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.id).toBe(id);

    // Update -> completing sets completedAt
    const updated = await request(app)
      .patch(`/api/tasks/${id}`)
      .set(auth(u.token))
      .send({ status: 'DONE' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.status).toBe('DONE');
    expect(updated.body.data.completedAt).toBeTruthy();

    // Activity log captured the change
    const activity = await request(app).get(`/api/tasks/${id}/activity`).set(auth(u.token));
    expect(activity.status).toBe(200);
    const actions = activity.body.data.map((a: { action: string }) => a.action);
    expect(actions).toContain('task.created');
    expect(actions).toContain('task.completed');

    // Delete
    const removed = await request(app).delete(`/api/tasks/${id}`).set(auth(u.token));
    expect(removed.status).toBe(200);
    const gone = await request(app).get(`/api/tasks/${id}`).set(auth(u.token));
    expect(gone.status).toBe(404);
  });

  it('validates the create payload (400 with field errors)', async () => {
    const u = await makeUser();
    const res = await request(app)
      .post('/api/tasks')
      .set(auth(u.token))
      .send({ title: '', priority: 'NOPE' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fieldErrors).toHaveProperty('title');
    expect(res.body.error.details.fieldErrors).toHaveProperty('priority');
  });

  it("isolates tasks between users — a user cannot read or modify another's task", async () => {
    const alice = await makeUser();
    const bob = await makeUser();

    const aliceTask = await request(app)
      .post('/api/tasks')
      .set(auth(alice.token))
      .send({ title: "Alice's secret plan" });
    const id = aliceTask.body.data.id;

    // Bob cannot see it (404, not 403 — we don't leak existence)
    expect((await request(app).get(`/api/tasks/${id}`).set(auth(bob.token))).status).toBe(404);
    // Bob cannot update it
    expect(
      (await request(app).patch(`/api/tasks/${id}`).set(auth(bob.token)).send({ title: 'hacked' })).status,
    ).toBe(404);
    // Bob cannot delete it
    expect((await request(app).delete(`/api/tasks/${id}`).set(auth(bob.token))).status).toBe(404);

    // Bob's list does not include Alice's task
    const bobList = await request(app).get('/api/tasks').set(auth(bob.token));
    expect(bobList.body.data).toHaveLength(0);
  });

  it('paginates the task list with correct meta', async () => {
    const u = await makeUser();
    for (let i = 0; i < 12; i++) {
      await request(app).post('/api/tasks').set(auth(u.token)).send({ title: `Task ${i}` });
    }

    const page1 = await request(app).get('/api/tasks?page=1&pageSize=5').set(auth(u.token));
    expect(page1.body.data).toHaveLength(5);
    expect(page1.body.meta).toMatchObject({ page: 1, pageSize: 5, total: 12, totalPages: 3, hasNextPage: true, hasPrevPage: false });

    const page3 = await request(app).get('/api/tasks?page=3&pageSize=5').set(auth(u.token));
    expect(page3.body.data).toHaveLength(2);
    expect(page3.body.meta).toMatchObject({ hasNextPage: false, hasPrevPage: true });
  });
});
