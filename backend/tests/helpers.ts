import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export const app: Express = createApp();

let counter = 0;

/** Wipe all data between tests so suites are independent. */
export async function resetDb() {
  // Order respects FK constraints (children first); CASCADE covers the rest.
  await prisma.$transaction([
    prisma.activity.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.task.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function disconnect() {
  await prisma.$disconnect();
}

/** Register a fresh user and return its access token + identity. */
export async function makeUser(overrides: Partial<{ email: string; password: string; name: string }> = {}) {
  counter += 1;
  const email = overrides.email ?? `user${counter}.${Date.now()}@test.dev`;
  const password = overrides.password ?? 'Password123';
  const name = overrides.name ?? `User ${counter}`;

  const res = await request(app).post('/api/auth/signup').send({ email, password, name });
  if (res.status !== 201) {
    throw new Error(`signup failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return {
    token: res.body.data.accessToken as string,
    user: res.body.data.user as { id: string; email: string; role: string },
    email,
    password,
  };
}

/** Promote a user to ADMIN directly in the DB (no public endpoint for this). */
export async function promoteToAdmin(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
