import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, disconnect, makeUser, promoteToAdmin, resetDb } from './helpers';

const create = (token: string, body: Record<string, unknown>) =>
  request(app).post('/api/tasks').set(auth(token)).send(body);

describe('Filtering, search and sort (working together)', () => {
  beforeEach(resetDb);
  afterAll(disconnect);

  it('combines status filter + title search + priority sort', async () => {
    const u = await makeUser();
    await create(u.token, { title: 'Alpha report', status: 'TODO', priority: 'LOW' });
    await create(u.token, { title: 'Beta report', status: 'TODO', priority: 'URGENT' });
    await create(u.token, { title: 'Gamma report', status: 'DONE', priority: 'HIGH' });
    await create(u.token, { title: 'Unrelated note', status: 'TODO', priority: 'HIGH' });

    const res = await request(app)
      .get('/api/tasks?status=TODO&search=report&sortBy=priority&sortOrder=desc')
      .set(auth(u.token));

    expect(res.status).toBe(200);
    const titles = res.body.data.map((t: { title: string }) => t.title);
    // Only TODO + matching "report", excludes DONE "Gamma" and non-matching "Unrelated".
    expect(titles).toEqual(['Beta report', 'Alpha report']);
  });

  it('search is case-insensitive and matches partials', async () => {
    const u = await makeUser();
    await create(u.token, { title: 'Quarterly Planning' });
    await create(u.token, { title: 'Daily standup' });

    const res = await request(app).get('/api/tasks?search=plan').set(auth(u.token));
    expect(res.body.data.map((t: { title: string }) => t.title)).toEqual(['Quarterly Planning']);
  });

  it('sorts by due date ascending', async () => {
    const u = await makeUser();
    await create(u.token, { title: 'Later', dueDate: '2026-12-01' });
    await create(u.token, { title: 'Sooner', dueDate: '2026-06-01' });

    const res = await request(app).get('/api/tasks?sortBy=dueDate&sortOrder=asc').set(auth(u.token));
    expect(res.body.data.map((t: { title: string }) => t.title)).toEqual(['Sooner', 'Later']);
  });

  it('lets an admin view another user\'s tasks via ownerId, but a normal user cannot', async () => {
    const admin = await makeUser();
    await promoteToAdmin(admin.user.id);
    // Re-login to get a token carrying the ADMIN role.
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: admin.password });
    const adminToken = adminLogin.body.data.accessToken;

    const target = await makeUser();
    await create(target.token, { title: 'Target task' });

    const adminView = await request(app)
      .get(`/api/tasks?ownerId=${target.user.id}`)
      .set(auth(adminToken));
    expect(adminView.body.data.map((t: { title: string }) => t.title)).toContain('Target task');

    // A normal third-party user passing ownerId is ignored — still scoped to self.
    const third = await makeUser();
    const thirdView = await request(app)
      .get(`/api/tasks?ownerId=${target.user.id}`)
      .set(auth(third.token));
    expect(thirdView.body.data).toHaveLength(0);
  });
});
