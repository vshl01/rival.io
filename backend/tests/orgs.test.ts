import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { app, auth, disconnect, makeUser, promoteToAdmin, resetDb } from './helpers';

/**
 * Organisations, membership and join requests.
 *
 * The cross-org denial cases here are the important ones. The old model scoped
 * tasks with `where.ownerId = actor.id`, which failed safe — forget it and you
 * saw nothing. Membership scoping fails *open*: forget a check and every org's
 * data is exposed. These tests are what stop a future refactor doing that.
 */

/** Create an org and return { token, user, slug } for its assigner. */
async function makeOrg(name = 'Acme Corp') {
  const owner = await makeUser();
  const res = await request(app).post('/api/orgs').set(auth(owner.token)).send({ name });
  expect(res.status).toBe(201);
  return { ...owner, slug: res.body.data.slug as string, org: res.body.data };
}

beforeEach(resetDb);
afterAll(disconnect);

describe('POST /api/orgs', () => {
  it('creates an org and makes the creator its ASSIGNER', async () => {
    const owner = await makeUser();

    const res = await request(app).post('/api/orgs').set(auth(owner.token)).send({ name: 'Acme Corp' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Acme Corp', slug: 'acme-corp', key: 'ACME' });

    const mine = await request(app).get('/api/orgs').set(auth(owner.token));
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].myRole).toBe('ASSIGNER');
  });

  it('derives a unique slug and key when the name collides', async () => {
    const first = await makeOrg('Acme Corp');
    const second = await makeUser();

    const res = await request(app).post('/api/orgs').set(auth(second.token)).send({ name: 'Acme Corp' });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).not.toBe(first.slug);
    expect(res.body.data.slug).toBe('acme-corp-2');
    expect(res.body.data.key).toBe('ACME2');
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/orgs').send({ name: 'Acme Corp' });
    expect(res.status).toBe(401);
  });

  it('rejects a name that is too short', async () => {
    const owner = await makeUser();
    const res = await request(app).post('/api/orgs').set(auth(owner.token)).send({ name: 'A' });
    expect(res.status).toBe(400);
  });
});

describe('org access is walled off from non-members', () => {
  it('denies reading, renaming and the roster', async () => {
    const { slug } = await makeOrg();
    const outsider = await makeUser();

    expect((await request(app).get(`/api/orgs/${slug}`).set(auth(outsider.token))).status).toBe(403);
    expect((await request(app).get(`/api/orgs/${slug}/members`).set(auth(outsider.token))).status).toBe(403);
    expect(
      (await request(app).get(`/api/orgs/${slug}/join-requests`).set(auth(outsider.token))).status,
    ).toBe(403);
    expect(
      (await request(app).patch(`/api/orgs/${slug}`).set(auth(outsider.token)).send({ name: 'Hijacked' }))
        .status,
    ).toBe(403);
  });

  it('leaves the org unmodified after a rejected rename', async () => {
    const { slug } = await makeOrg('Acme Corp');
    const outsider = await makeUser();

    await request(app).patch(`/api/orgs/${slug}`).set(auth(outsider.token)).send({ name: 'Hijacked' });

    const org = await prisma.organization.findUnique({ where: { slug }, select: { name: true } });
    expect(org?.name).toBe('Acme Corp');
  });

  it('404s an unknown slug', async () => {
    const outsider = await makeUser();
    const res = await request(app).get('/api/orgs/does-not-exist').set(auth(outsider.token));
    expect(res.status).toBe(404);
  });

  it('lets a platform ADMIN read any org, but never write to it', async () => {
    const { slug } = await makeOrg();
    const admin = await makeUser();
    await promoteToAdmin(admin.user.id);
    // Re-login so the access token carries the new platform role.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.email, password: admin.password });
    const adminToken = login.body.data.accessToken as string;

    const read = await request(app).get(`/api/orgs/${slug}`).set(auth(adminToken));
    expect(read.status).toBe(200);
    // `null` marks "admin looking in", not a real member — writes must still fail.
    expect(read.body.data.myRole).toBeNull();

    const write = await request(app)
      .patch(`/api/orgs/${slug}`)
      .set(auth(adminToken))
      .send({ name: 'Hijacked' });
    expect(write.status).toBe(403);
  });
});

describe('GET /api/orgs/directory', () => {
  it('lists orgs you are not in and hides the ones you are', async () => {
    const { slug, token: ownerToken } = await makeOrg('Acme Corp');
    const outsider = await makeUser();

    const forOutsider = await request(app).get('/api/orgs/directory').set(auth(outsider.token));
    expect(forOutsider.body.data.map((o: { slug: string }) => o.slug)).toContain(slug);

    const forOwner = await request(app).get('/api/orgs/directory').set(auth(ownerToken));
    expect(forOwner.body.data.map((o: { slug: string }) => o.slug)).not.toContain(slug);
  });

  it('surfaces the caller’s own pending request so the UI can show "Requested"', async () => {
    const { slug } = await makeOrg();
    const outsider = await makeUser();

    await request(app).post(`/api/orgs/${slug}/join-requests`).set(auth(outsider.token)).send({});

    const dir = await request(app).get('/api/orgs/directory').set(auth(outsider.token));
    const row = dir.body.data.find((o: { slug: string }) => o.slug === slug);
    expect(row.pendingRequest).not.toBeNull();
  });
});

describe('join requests', () => {
  it('accepts a request, adds the member as WORKER and notifies both sides', async () => {
    const { slug, token: ownerToken, user: owner } = await makeOrg();
    const applicant = await makeUser();

    const created = await request(app)
      .post(`/api/orgs/${slug}/join-requests`)
      .set(auth(applicant.token))
      .send({ message: 'let me in' });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('PENDING');

    // Every assigner is told about it.
    const received = await prisma.notification.findFirst({
      where: { userId: owner.id, type: 'join_request.received' },
    });
    expect(received).not.toBeNull();

    const pending = await request(app).get(`/api/orgs/${slug}/join-requests`).set(auth(ownerToken));
    expect(pending.body.data).toHaveLength(1);

    const accepted = await request(app)
      .post(`/api/orgs/${slug}/join-requests/${created.body.data.id}/accept`)
      .set(auth(ownerToken));
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe('ACCEPTED');

    const roster = await request(app).get(`/api/orgs/${slug}/members`).set(auth(ownerToken));
    expect(roster.body.data).toHaveLength(2);
    expect(
      roster.body.data.find((m: { user: { id: string } }) => m.user.id === applicant.user.id).role,
    ).toBe('WORKER');

    // And the org is now visible to them.
    const visible = await request(app).get(`/api/orgs/${slug}`).set(auth(applicant.token));
    expect(visible.status).toBe(200);
    expect(visible.body.data.myRole).toBe('WORKER');

    const told = await prisma.notification.findFirst({
      where: { userId: applicant.user.id, type: 'join_request.accepted' },
    });
    expect(told).not.toBeNull();
  });

  it('rejects a request without adding a membership', async () => {
    const { slug, token: ownerToken } = await makeOrg();
    const applicant = await makeUser();

    const created = await request(app)
      .post(`/api/orgs/${slug}/join-requests`)
      .set(auth(applicant.token))
      .send({});
    const rejected = await request(app)
      .post(`/api/orgs/${slug}/join-requests/${created.body.data.id}/reject`)
      .set(auth(ownerToken));

    expect(rejected.body.data.status).toBe('REJECTED');
    const roster = await request(app).get(`/api/orgs/${slug}/members`).set(auth(ownerToken));
    expect(roster.body.data).toHaveLength(1);
    expect((await request(app).get(`/api/orgs/${slug}`).set(auth(applicant.token))).status).toBe(403);
  });

  it('allows only one pending request per person', async () => {
    const { slug } = await makeOrg();
    const applicant = await makeUser();

    await request(app).post(`/api/orgs/${slug}/join-requests`).set(auth(applicant.token)).send({});
    const duplicate = await request(app)
      .post(`/api/orgs/${slug}/join-requests`)
      .set(auth(applicant.token))
      .send({});

    expect(duplicate.status).toBe(409);
  });

  it('lets a rejected applicant apply again', async () => {
    const { slug, token: ownerToken } = await makeOrg();
    const applicant = await makeUser();

    const first = await request(app)
      .post(`/api/orgs/${slug}/join-requests`)
      .set(auth(applicant.token))
      .send({});
    await request(app)
      .post(`/api/orgs/${slug}/join-requests/${first.body.data.id}/reject`)
      .set(auth(ownerToken));

    const second = await request(app)
      .post(`/api/orgs/${slug}/join-requests`)
      .set(auth(applicant.token))
      .send({});
    expect(second.status).toBe(201);
  });

  it('refuses a second decision on the same request', async () => {
    const { slug, token: ownerToken } = await makeOrg();
    const applicant = await makeUser();

    const created = await request(app)
      .post(`/api/orgs/${slug}/join-requests`)
      .set(auth(applicant.token))
      .send({});
    const url = `/api/orgs/${slug}/join-requests/${created.body.data.id}/accept`;

    expect((await request(app).post(url).set(auth(ownerToken))).status).toBe(200);
    expect((await request(app).post(url).set(auth(ownerToken))).status).toBe(409);
  });

  it('refuses a request from someone already in the org', async () => {
    const { slug, token: ownerToken } = await makeOrg();
    const res = await request(app).post(`/api/orgs/${slug}/join-requests`).set(auth(ownerToken)).send({});
    expect(res.status).toBe(409);
  });

  it('will not decide a request belonging to a different org', async () => {
    const orgA = await makeOrg('Acme Corp');
    const orgB = await makeOrg('Beta Corp');
    const applicant = await makeUser();

    const toA = await request(app)
      .post(`/api/orgs/${orgA.slug}/join-requests`)
      .set(auth(applicant.token))
      .send({});

    // orgB's assigner must not be able to accept a request made to orgA.
    const res = await request(app)
      .post(`/api/orgs/${orgB.slug}/join-requests/${toA.body.data.id}/accept`)
      .set(auth(orgB.token));
    expect(res.status).toBe(404);
  });

  it('exposes the caller’s own requests across orgs', async () => {
    const { slug } = await makeOrg();
    const applicant = await makeUser();

    await request(app).post(`/api/orgs/${slug}/join-requests`).set(auth(applicant.token)).send({});

    const mine = await request(app).get('/api/users/me/join-requests').set(auth(applicant.token));
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].org.slug).toBe(slug);
  });
});

describe('roles and the last-assigner invariant', () => {
  /** Org with a second member who is a WORKER. */
  async function makeOrgWithWorker() {
    const org = await makeOrg();
    const worker = await makeUser();
    const req = await request(app)
      .post(`/api/orgs/${org.slug}/join-requests`)
      .set(auth(worker.token))
      .send({});
    await request(app)
      .post(`/api/orgs/${org.slug}/join-requests/${req.body.data.id}/accept`)
      .set(auth(org.token));
    return { org, worker };
  }

  it('denies every assigner-only action to a worker', async () => {
    const { org, worker } = await makeOrgWithWorker();

    expect(
      (await request(app).patch(`/api/orgs/${org.slug}`).set(auth(worker.token)).send({ name: 'Nope' }))
        .status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/orgs/${org.slug}/members/${org.user.id}`)
          .set(auth(worker.token))
          .send({ role: 'WORKER' })
      ).status,
    ).toBe(403);
    expect(
      (await request(app).delete(`/api/orgs/${org.slug}/members/${org.user.id}`).set(auth(worker.token)))
        .status,
    ).toBe(403);
    expect(
      (await request(app).get(`/api/orgs/${org.slug}/join-requests`).set(auth(worker.token))).status,
    ).toBe(403);
  });

  it('refuses to demote or remove the only assigner', async () => {
    const { org } = await makeOrgWithWorker();

    const demote = await request(app)
      .patch(`/api/orgs/${org.slug}/members/${org.user.id}`)
      .set(auth(org.token))
      .send({ role: 'WORKER' });
    expect(demote.status).toBe(409);

    const remove = await request(app)
      .delete(`/api/orgs/${org.slug}/members/${org.user.id}`)
      .set(auth(org.token));
    expect(remove.status).toBe(409);
  });

  it('refuses to let the only assigner leave', async () => {
    const { org } = await makeOrgWithWorker();
    const res = await request(app).delete(`/api/orgs/${org.slug}/membership`).set(auth(org.token));
    expect(res.status).toBe(409);
  });

  it('allows leaving once another assigner exists', async () => {
    const { org, worker } = await makeOrgWithWorker();

    const promote = await request(app)
      .patch(`/api/orgs/${org.slug}/members/${worker.user.id}`)
      .set(auth(org.token))
      .send({ role: 'ASSIGNER' });
    expect(promote.status).toBe(200);

    expect((await request(app).delete(`/api/orgs/${org.slug}/membership`).set(auth(org.token))).status)
      .toBe(200);

    const roster = await request(app).get(`/api/orgs/${org.slug}/members`).set(auth(worker.token));
    expect(roster.body.data).toHaveLength(1);
  });

  it('notifies a member when their role changes', async () => {
    const { org, worker } = await makeOrgWithWorker();

    await request(app)
      .patch(`/api/orgs/${org.slug}/members/${worker.user.id}`)
      .set(auth(org.token))
      .send({ role: 'ASSIGNER' });

    const note = await prisma.notification.findFirst({
      where: { userId: worker.user.id, type: 'member.role_changed' },
    });
    expect(note).not.toBeNull();
  });

  it('404s a role change for someone who is not a member', async () => {
    const org = await makeOrg();
    const stranger = await makeUser();

    const res = await request(app)
      .patch(`/api/orgs/${org.slug}/members/${stranger.user.id}`)
      .set(auth(org.token))
      .send({ role: 'ASSIGNER' });
    expect(res.status).toBe(404);
  });

  it('removes a member and revokes their access', async () => {
    const { org, worker } = await makeOrgWithWorker();

    const res = await request(app)
      .delete(`/api/orgs/${org.slug}/members/${worker.user.id}`)
      .set(auth(org.token));
    expect(res.status).toBe(200);

    expect((await request(app).get(`/api/orgs/${org.slug}`).set(auth(worker.token))).status).toBe(403);
  });
});

describe('PATCH /api/orgs/:slug', () => {
  it('renames without changing the slug or key', async () => {
    const { slug, token, org } = await makeOrg('Acme Corp');

    const res = await request(app).patch(`/api/orgs/${slug}`).set(auth(token)).send({ name: 'Acme Ltd' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Acme Ltd');
    expect(res.body.data.slug).toBe(slug);
    expect(res.body.data.key).toBe(org.key);
  });
});
