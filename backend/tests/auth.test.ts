import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, disconnect, makeUser, resetDb } from './helpers';

describe('Auth', () => {
  beforeEach(resetDb);
  afterAll(disconnect);

  it('signs up a new user and returns an access token (201)', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Grace', email: 'grace@test.dev', password: 'Password123' });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.user).toMatchObject({ email: 'grace@test.dev', role: 'USER' });
    // Password hash must never be exposed.
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('rejects a weak password with field-level errors (400)', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Weak', email: 'weak@test.dev', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.details.fieldErrors.password).toBeTruthy();
  });

  it('prevents duplicate signups (409)', async () => {
    const u = await makeUser();
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Dupe', email: u.email, password: 'Password123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('logs in with valid credentials and rejects bad ones (401)', async () => {
    const u = await makeUser();

    const good = await request(app)
      .post('/api/auth/login')
      .send({ email: u.email, password: u.password });
    expect(good.status).toBe(200);
    expect(good.body.data.accessToken).toBeTypeOf('string');

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: u.email, password: 'WrongPassword1' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('UNAUTHORIZED');
  });

  it('protects /me — rejects without a token, succeeds with one', async () => {
    const u = await makeUser();

    const noToken = await request(app).get('/api/auth/me');
    expect(noToken.status).toBe(401);

    const withToken = await request(app).get('/api/auth/me').set(auth(u.token));
    expect(withToken.status).toBe(200);
    expect(withToken.body.data.user.id).toBe(u.user.id);
  });
});
