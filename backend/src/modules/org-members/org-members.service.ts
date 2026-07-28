import type { Prisma } from '@prisma/client';
import type { Actor } from '@/access/actor';
import {
  findMembership,
  getOrgBySlugOrThrow,
  requireOrgAssigner,
  requireOrgMembership,
} from '@/access/policy';
import { prisma } from '@/lib/prisma';
import {
  emitNotificationCreated,
  NotificationType,
  notify,
  notifyMany,
} from '@/modules/notifications/notifications.service';
import { AppError } from '@/utils/AppError';
import type {
  CreateJoinRequestInput,
  ListJoinRequestsQuery,
  UpdateMemberRoleInput,
} from './org-members.schemas';

/** Public shape of a person — never expose passwordHash. */
const personSelect = { id: true, name: true, email: true } satisfies Prisma.UserSelect;

/**
 * How many assigners the org has left.
 *
 * Served by `@@index([orgId, role])`, so it never scans the roster. Used to keep
 * the "an org must always have at least one assigner" invariant: an org with
 * none can never approve members or create sprints again — it is bricked.
 */
function countAssigners(orgId: string, tx: Prisma.TransactionClient = prisma) {
  return tx.orgMembership.count({ where: { orgId, role: 'ASSIGNER' } });
}

/** Every assigner's user id — the recipients for "someone wants to join". */
async function assignerIds(orgId: string): Promise<string[]> {
  const rows = await prisma.orgMembership.findMany({
    where: { orgId, role: 'ASSIGNER' },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

export const orgMembersService = {
  /** The roster. Visible to every member. */
  async listMembers(actor: Actor, slug: string) {
    const { org } = await requireOrgMembership(actor, slug);

    return prisma.orgMembership.findMany({
      where: { orgId: org.id },
      // Assigners first, then longest-standing members.
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      select: { id: true, role: true, joinedAt: true, user: { select: personSelect } },
    });
  },

  /** Promote or demote a member. Assigner only. */
  async updateRole(actor: Actor, slug: string, userId: string, input: UpdateMemberRoleInput) {
    const { org } = await requireOrgAssigner(actor, slug);

    const target = await findMembership(userId, org.id);
    if (!target) throw AppError.notFound('That person is not a member of this organisation');
    if (target.role === input.role) {
      return { id: target.id, role: target.role, unchanged: true };
    }

    // Demoting the last assigner would leave nobody able to manage the org.
    if (target.role === 'ASSIGNER' && (await countAssigners(org.id)) === 1) {
      throw AppError.conflict(
        'This is the only assigner — promote someone else before changing this role',
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const membership = await tx.orgMembership.update({
        where: { id: target.id },
        data: { role: input.role },
        select: { id: true, role: true, user: { select: personSelect } },
      });

      await notify(
        {
          userId,
          type: NotificationType.MemberRoleChanged,
          payload: { orgSlug: org.slug, orgName: org.name, role: input.role },
        },
        tx,
      );

      return membership;
    });

    // After commit — see emitNotificationCreated.
    emitNotificationCreated([userId]);
    return { ...updated, unchanged: false };
  },

  /** Remove someone from the org. Assigner only. */
  async removeMember(actor: Actor, slug: string, userId: string) {
    const { org } = await requireOrgAssigner(actor, slug);

    const target = await findMembership(userId, org.id);
    if (!target) throw AppError.notFound('That person is not a member of this organisation');

    if (target.role === 'ASSIGNER' && (await countAssigners(org.id)) === 1) {
      throw AppError.conflict(
        'This is the only assigner — promote someone else before removing them',
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.orgMembership.delete({ where: { id: target.id } });
      await notify(
        {
          userId,
          type: NotificationType.MemberRemoved,
          payload: { orgSlug: org.slug, orgName: org.name },
        },
        tx,
      );
    });

    emitNotificationCreated([userId]);
    return { removed: true };
  },

  /**
   * Leave an organisation voluntarily.
   *
   * Separate from `removeMember` because it needs no assigner rights — but the
   * last-assigner invariant still applies, so the final assigner must hand over
   * first rather than orphaning the org.
   */
  async leave(actor: Actor, slug: string) {
    const org = await getOrgBySlugOrThrow(slug);

    const membership = await findMembership(actor.id, org.id);
    if (!membership) throw AppError.notFound('You are not a member of this organisation');

    if (membership.role === 'ASSIGNER' && (await countAssigners(org.id)) === 1) {
      throw AppError.conflict(
        'You are the only assigner — promote someone else before leaving',
      );
    }

    await prisma.orgMembership.delete({ where: { id: membership.id } });
    return { left: true };
  },

  /**
   * Ask to join an org. Open to any authenticated user — that is the whole point
   * of the directory. Every assigner is notified.
   */
  async requestToJoin(actor: Actor, slug: string, input: CreateJoinRequestInput) {
    const org = await getOrgBySlugOrThrow(slug);

    if (await findMembership(actor.id, org.id)) {
      throw AppError.conflict('You are already a member of this organisation');
    }

    // Guards the "one open request per person" rule. The durable guarantee is a
    // partial unique index (docs §8 "Known schema gap"); this check exists to
    // return a friendly message instead of a constraint error.
    const existing = await prisma.joinRequest.findFirst({
      where: { orgId: org.id, userId: actor.id, status: 'PENDING' },
      select: { id: true, createdAt: true },
    });
    if (existing) {
      throw AppError.conflict('You already have a pending request for this organisation');
    }

    const applicant = await prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: personSelect,
    });

    const recipients = await assignerIds(org.id);

    const created = await prisma.$transaction(async (tx) => {
      const request = await tx.joinRequest.create({
        data: {
          orgId: org.id,
          userId: actor.id,
          message: input.message ?? null,
        },
        select: { id: true, status: true, message: true, createdAt: true },
      });

      await notifyMany(
        recipients,
        {
          type: NotificationType.JoinRequestReceived,
          payload: {
            orgSlug: org.slug,
            orgName: org.name,
            requestId: request.id,
            applicant,
            message: request.message,
          },
        },
        tx,
      );

      return request;
    });

    // This is what makes an assigner's "Join requests" list update live.
    emitNotificationCreated(recipients);
    return created;
  },

  /** Requests for this org, newest first. Assigner only. */
  async listJoinRequests(actor: Actor, slug: string, query: ListJoinRequestsQuery) {
    const { org } = await requireOrgAssigner(actor, slug);

    return prisma.joinRequest.findMany({
      where: { orgId: org.id, status: query.status },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        decidedAt: true,
        user: { select: personSelect },
        decidedBy: { select: personSelect },
      },
    });
  },

  /**
   * Accept or reject a pending request. Assigner only.
   *
   * The decision, the resulting membership and the applicant's notification are
   * one transaction — a request marked ACCEPTED without a membership row would
   * leave someone permanently unable to join or re-request.
   */
  async decideJoinRequest(actor: Actor, slug: string, requestId: string, accept: boolean) {
    const { org } = await requireOrgAssigner(actor, slug);

    const request = await prisma.joinRequest.findUnique({
      where: { id: requestId },
      select: { id: true, orgId: true, userId: true, status: true },
    });

    // Scoped to this org so a request id from elsewhere cannot be decided here.
    if (!request || request.orgId !== org.id) throw AppError.notFound('Request not found');
    if (request.status !== 'PENDING') {
      throw AppError.conflict(`This request was already ${request.status.toLowerCase()}`);
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const decided = await tx.joinRequest.update({
        where: { id: request.id },
        data: {
          status: accept ? 'ACCEPTED' : 'REJECTED',
          decidedById: actor.id,
          decidedAt: new Date(),
        },
        select: {
          id: true,
          status: true,
          decidedAt: true,
          user: { select: personSelect },
        },
      });

      if (accept) {
        // They may have been added manually between request and decision, so
        // this must not fail on the composite unique.
        await tx.orgMembership.upsert({
          where: { orgId_userId: { orgId: org.id, userId: request.userId } },
          create: { orgId: org.id, userId: request.userId, role: 'WORKER' },
          update: {},
        });
      }

      await notify(
        {
          userId: request.userId,
          type: accept
            ? NotificationType.JoinRequestAccepted
            : NotificationType.JoinRequestRejected,
          payload: { orgSlug: org.slug, orgName: org.name },
        },
        tx,
      );

      return decided;
    });

    emitNotificationCreated([request.userId]);
    return outcome;
  },

  /** The actor's own requests across all orgs — "pending / accepted" on their side. */
  async listMyJoinRequests(actor: Actor) {
    return prisma.joinRequest.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        decidedAt: true,
        org: { select: { id: true, name: true, slug: true, key: true } },
      },
    });
  },
};
