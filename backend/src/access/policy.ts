import type { Organization, OrgMembership } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/AppError';
import type { Actor } from './actor';

/**
 * The single place that answers "may this actor do this in this organisation?".
 *
 * Why it is centralised: the previous model was one line — `where.ownerId =
 * actor.id` — and it was self-enforcing. Forget it and you got an empty list.
 * Membership scoping is the opposite: forget it and you expose every org's data.
 * Route handlers therefore call these helpers instead of reimplementing checks.
 *
 * Every lookup is a single index hit on `@@unique([orgId, userId])`, so there is
 * deliberately no cache. If profiling ever demands one, memoise per request —
 * never a TTL cache, because a stale role is a security bug.
 */

/**
 * Resolve an organisation from its URL slug.
 *
 * A missing slug is a 404 and a non-member is a 403 (below) rather than both
 * being 404: organisations are intentionally discoverable through the directory
 * so people can request to join, so their existence is not a secret worth
 * hiding behind ambiguous status codes.
 */
export async function getOrgBySlugOrThrow(slug: string): Promise<Organization> {
  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) throw AppError.notFound('Organisation not found');
  return org;
}

/** Membership row for this user in this org, or `null` if they are not a member. */
export function findMembership(userId: string, orgId: string) {
  return prisma.orgMembership.findUnique({ where: { orgId_userId: { orgId, userId } } });
}

/**
 * Require the actor to belong to the organisation.
 *
 * Returns the membership, or `null` for a platform ADMIN who is not actually a
 * member — they are let through so the admin console can inspect any org. The
 * `null` is the signal: callers that mutate must use `requireAssigner`, which
 * grants no such bypass.
 */
export async function requireMember(actor: Actor, orgId: string): Promise<OrgMembership | null> {
  const membership = await findMembership(actor.id, orgId);
  if (membership) return membership;
  if (actor.role === 'ADMIN') return null;
  throw AppError.forbidden('You are not a member of this organisation');
}

/**
 * Require the actor to be an ASSIGNER of the organisation.
 *
 * Being a platform ADMIN is deliberately NOT a substitute: reading any org is a
 * support function, writing to one is not.
 */
export async function requireAssigner(actor: Actor, orgId: string): Promise<OrgMembership> {
  const membership = await findMembership(actor.id, orgId);
  if (!membership) throw AppError.forbidden('You are not a member of this organisation');
  if (membership.role !== 'ASSIGNER') {
    throw AppError.forbidden('Only an assigner can do this');
  }
  return membership;
}

/** Resolve an org by slug and assert membership in one step — the common case. */
export async function requireOrgMembership(actor: Actor, slug: string) {
  const org = await getOrgBySlugOrThrow(slug);
  const membership = await requireMember(actor, org.id);
  return { org, membership };
}

/** Resolve an org by slug and assert ASSIGNER — the common case for mutations. */
export async function requireOrgAssigner(actor: Actor, slug: string) {
  const org = await getOrgBySlugOrThrow(slug);
  const membership = await requireAssigner(actor, org.id);
  return { org, membership };
}
