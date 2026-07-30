import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app, auth, disconnect, makeUser, resetDb } from './helpers';

/**
 * Notifications are strictly personal — there is no cross-user read path, not
 * even for a platform admin. Every query filters on the caller's id, and these
 * tests pin that down alongside the query-parsing contract.
 */

/** An org whose assigner has one pending join request waiting. */
async function seedJoinRequest() {
  const assigner = await makeUser();
  const created = await request(app).post('/api/orgs').set(auth(assigner.token)).send({ name: 'Acme Corp' });
  const slug = created.body.data.slug as string;

  const applicant = await makeUser();
  const req = await request(app)
    .post(`/api/orgs/${slug}/join-requests`)
    .set(auth(applicant.token))
    .send({ message: 'let me in' });

  return { assigner, applicant, slug, requestId: req.body.data.id as string };
}

beforeEach(resetDb);
afterAll(disconnect);

describe('GET /api/notifications', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401);
  });

  /**
   * Regression: `validate()` rewrites `req.query` and the handler parses it
   * again, so a one-way string→boolean transform threw on the second pass and
   * every call 400ed. Each shape below must parse cleanly.
   */
  it('accepts the query in every shape the drawer sends', async () => {
    const user = await makeUser();

    for (const qs of ['', '?unreadOnly=true', '?unreadOnly=false', '?unreadOnly=true&page=1&pageSize=5']) {
      const res = await request(app).get(`/api/notifications${qs}`).set(auth(user.token));
      expect(res.status, `query "${qs}"`).toBe(200);
    }
  });

  it('rejects a non-boolean unreadOnly', async () => {
    const user = await makeUser();
    const res = await request(app).get('/api/notifications?unreadOnly=yes').set(auth(user.token));
    expect(res.status).toBe(400);
  });

  it('returns the unread count in meta so the badge needs no second call', async () => {
    const { assigner } = await seedJoinRequest();

    const res = await request(app).get('/api/notifications').set(auth(assigner.token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe('join_request.received');
    expect(res.body.meta.unread).toBe(1);
  });

  it('carries a payload rich enough to render without another fetch', async () => {
    const { assigner, applicant } = await seedJoinRequest();

    const res = await request(app).get('/api/notifications').set(auth(assigner.token));

    expect(res.body.data[0].payload).toMatchObject({
      orgName: 'Acme Corp',
      orgSlug: 'acme-corp',
      message: 'let me in',
      applicant: { id: applicant.user.id, name: applicant.user.name },
    });
  });

  it('filters to unread only', async () => {
    const { assigner } = await seedJoinRequest();

    await request(app).post('/api/notifications/read-all').set(auth(assigner.token));

    const unread = await request(app)
      .get('/api/notifications?unreadOnly=true')
      .set(auth(assigner.token));
    expect(unread.body.data).toHaveLength(0);

    const all = await request(app).get('/api/notifications').set(auth(assigner.token));
    expect(all.body.data).toHaveLength(1);
  });

  it('never leaks another user’s notifications', async () => {
    const { applicant } = await seedJoinRequest();

    // The request notification went to the assigner, not the applicant.
    const res = await request(app).get('/api/notifications').set(auth(applicant.token));
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.unread).toBe(0);
  });
});

describe('marking notifications read', () => {
  it('marks one read and decrements the unread count', async () => {
    const { assigner } = await seedJoinRequest();

    const before = await request(app)
      .get('/api/notifications/unread-count')
      .set(auth(assigner.token));
    expect(before.body.data.unread).toBe(1);

    const list = await request(app).get('/api/notifications').set(auth(assigner.token));
    const read = await request(app)
      .post(`/api/notifications/${list.body.data[0].id}/read`)
      .set(auth(assigner.token));
    expect(read.status).toBe(200);

    const after = await request(app).get('/api/notifications/unread-count').set(auth(assigner.token));
    expect(after.body.data.unread).toBe(0);
  });

  it('404s an unknown notification', async () => {
    const user = await makeUser();
    const res = await request(app).post('/api/notifications/nope/read').set(auth(user.token));
    expect(res.status).toBe(404);
  });

  it('404s someone else’s notification rather than marking it read', async () => {
    const { assigner, applicant } = await seedJoinRequest();

    const list = await request(app).get('/api/notifications').set(auth(assigner.token));
    const someoneElsesId = list.body.data[0].id as string;

    const res = await request(app)
      .post(`/api/notifications/${someoneElsesId}/read`)
      .set(auth(applicant.token));
    expect(res.status).toBe(404);

    // And it is genuinely untouched.
    const still = await request(app).get('/api/notifications/unread-count').set(auth(assigner.token));
    expect(still.body.data.unread).toBe(1);
  });

  it('marks everything read and reports how many changed', async () => {
    const { assigner } = await seedJoinRequest();

    const first = await request(app).post('/api/notifications/read-all').set(auth(assigner.token));
    expect(first.body.data.updated).toBe(1);

    // Idempotent: nothing left to update.
    const second = await request(app).post('/api/notifications/read-all').set(auth(assigner.token));
    expect(second.body.data.updated).toBe(0);
  });
});
