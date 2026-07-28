import type { Prisma, Ticket } from '@prisma/client';
import type { Actor } from '@/access/actor';
import { findMembership, requireMember, requireOrgMembership } from '@/access/policy';
import { prisma } from '@/lib/prisma';
import { emitToUser } from '@/lib/socket';
import { parseCycle } from '@/modules/cycles/cycles.schemas';
import { AppError } from '@/utils/AppError';
import type { CreateTicketInput, ListTicketsQuery, UpdateTicketInput } from './tickets.schemas';

/**
 * Tickets — one model, two governed kinds (docs/architecture.md §1):
 *
 *   sprintId == null  →  PERSONAL TASK. Scoped by `createdById`. Unchanged
 *                        behaviour from before organisations existed.
 *   sprintId != null  →  ORG TICKET. Scoped by membership, has a `key`.
 *                        Assigners and workers both create and update;
 *                        only assigners delete.
 *
 * Every read goes through `accessOrThrow`, the single place that decides which of
 * those rules applies. Nothing else may load a ticket.
 */

const ticketInclude = {
  attachments: { orderBy: { createdAt: 'desc' } },
  assignee: { select: { id: true, name: true, email: true } },
  sprint: {
    select: { id: true, number: true, name: true, cycle: { select: { year: true, month: true } } },
  },
  _count: { select: { attachments: true, activities: true, comments: true } },
} satisfies Prisma.TicketInclude;

const personSelect = { id: true, name: true, email: true } satisfies Prisma.UserSelect;

type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

/** Record an audit entry and notify. Best-effort, never blocks. */
async function logActivity(
  ticket: Pick<Ticket, 'id' | 'createdById'>,
  actorId: string,
  action: string,
  metadata?: Prisma.InputJsonValue,
) {
  const activity = await prisma.activity.create({
    data: { ticketId: ticket.id, actorId, action, metadata },
  });
  emitToUser(ticket.createdById, 'activity:created', activity);
}

/**
 * Push a change to the people who care about this ticket.
 *
 * Interim: a ticket now has an audience rather than an owner, but rooms are still
 * keyed per user. Build step 5 replaces this with `sprint:<id>` / `org:<id>`
 * rooms; until then creator and assignee are notified directly, which covers the
 * common case without pretending to be complete.
 */
function emitTicket(
  ticket: Pick<Ticket, 'createdById' | 'assigneeId'>,
  event: Parameters<typeof emitToUser>[1],
  payload: unknown,
) {
  emitToUser(ticket.createdById, event, payload);
  if (ticket.assigneeId && ticket.assigneeId !== ticket.createdById) {
    emitToUser(ticket.assigneeId, event, payload);
  }
}

/** Field-level diff for the activity log. */
function diffChanges(before: Ticket, input: UpdateTicketInput) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(input) as (keyof UpdateTicketInput)[]) {
    const next = input[key];
    const prev = before[key as keyof Ticket];
    const prevComparable = prev instanceof Date ? prev.toISOString() : prev;
    const nextComparable = next instanceof Date ? next.toISOString() : next;
    if (prevComparable !== nextComparable) {
      changes[key] = { from: prevComparable ?? null, to: nextComparable ?? null };
    }
  }
  return changes;
}

interface AccessResult {
  ticket: TicketWithRelations;
  /** null for a personal task, or a platform admin who is not really a member. */
  role: 'ASSIGNER' | 'WORKER' | null;
}

/**
 * Load a ticket the actor may READ, or throw.
 *
 * Personal tasks 404 rather than 403 for outsiders — the original behaviour,
 * which avoids confirming someone else's task exists. Org tickets defer to
 * `requireMember`, whose 403 is right because org membership is not a secret.
 */
async function accessOrThrow(actor: Actor, id: string): Promise<AccessResult> {
  const ticket = await prisma.ticket.findUnique({ where: { id }, include: ticketInclude });
  if (!ticket) throw AppError.notFound('Ticket not found');

  if (ticket.sprintId === null || ticket.orgId === null) {
    if (actor.role !== 'ADMIN' && ticket.createdById !== actor.id) {
      throw AppError.notFound('Ticket not found');
    }
    return { ticket, role: null };
  }

  const membership = await requireMember(actor, ticket.orgId);
  return { ticket, role: membership?.role ?? null };
}

/** An assignee must belong to the org, or a ticket could be pushed to someone with no access. */
async function assertAssignable(assigneeId: string, orgId: string) {
  const member = await findMembership(assigneeId, orgId);
  if (!member) throw AppError.badRequest('That person is not a member of this organisation');
}

/** Resolve a sprint from the URL triple, scoped to the org. */
async function findSprintOrThrow(orgId: string, cycleKey: string, number: number) {
  const { year, month } = parseCycle(cycleKey);
  const sprint = await prisma.sprint.findFirst({
    where: { orgId, number, cycle: { year, month } },
    select: { id: true },
  });
  if (!sprint) throw AppError.notFound(`Sprint ${number} does not exist in ${cycleKey}`);
  return sprint;
}

export const ticketsService = {
  /* ── Personal tasks (/api/tasks) ─────────────────────────────── */

  /** Create a personal task: no sprint, no key, scoped to its creator. */
  async create(actor: Actor, input: CreateTicketInput) {
    const ticket = await prisma.ticket.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate ?? null,
        completedAt: input.status === 'DONE' ? new Date() : null,
        createdById: actor.id,
      },
      include: ticketInclude,
    });

    await logActivity(ticket, actor.id, 'task.created');
    emitToUser(actor.id, 'task:created', ticket);
    return ticket;
  },

  /**
   * List personal tasks. Sprint tickets are excluded — they belong to an
   * organisation and are reached through its board.
   */
  async list(actor: Actor, query: ListTicketsQuery) {
    const where: Prisma.TicketWhereInput = { sprintId: null };

    // Regular users are hard-locked to their own. Admins may pass `ownerId` to
    // inspect one person, or omit it to see everyone's.
    if (actor.role === 'ADMIN') {
      if (query.ownerId) where.createdById = query.ownerId;
    } else {
      where.createdById = actor.id;
    }

    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

    // Native Postgres enum ordering matches our declared order
    // (LOW < MEDIUM < HIGH < URGENT), so `priority desc` = most urgent first.
    const orderBy: Prisma.TicketOrderByWithRelationInput = { [query.sortBy]: query.sortOrder };

    const [items, total] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: ticketInclude,
      }),
      prisma.ticket.count({ where }),
    ]);

    return { items, total };
  },

  /* ── Sprint tickets ──────────────────────────────────────────── */

  /** The board for one sprint. Any member may read. */
  async listBySprint(actor: Actor, slug: string, cycleKey: string, number: number) {
    const { org } = await requireOrgMembership(actor, slug);
    const sprint = await findSprintOrThrow(org.id, cycleKey, number);

    return prisma.ticket.findMany({
      where: { sprintId: sprint.id },
      // Board order: open work first, most urgent at the top of each group.
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'asc' }],
      include: ticketInclude,
    });
  },

  /**
   * Create a ticket in a sprint. BOTH roles may do this, and either may assign it
   * to any member.
   *
   * The key comes from an ATOMIC increment of `Organization.ticketSeq` — see
   * docs §4b for why this is deliberately not wrapped in a transaction.
   */
  async createInSprint(
    actor: Actor,
    slug: string,
    cycleKey: string,
    number: number,
    input: CreateTicketInput,
  ) {
    const { org } = await requireOrgMembership(actor, slug);
    const sprint = await findSprintOrThrow(org.id, cycleKey, number);

    if (input.assigneeId) await assertAssignable(input.assigneeId, org.id);

    const { ticketSeq } = await prisma.organization.update({
      where: { id: org.id },
      data: { ticketSeq: { increment: 1 } },
      select: { ticketSeq: true },
    });

    const ticket = await prisma.ticket.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate ?? null,
        completedAt: input.status === 'DONE' ? new Date() : null,
        createdById: actor.id,
        assigneeId: input.assigneeId ?? null,
        sprintId: sprint.id,
        // Denormalised alongside sprintId — written only here.
        orgId: org.id,
        key: `${org.key}-${ticketSeq}`,
      },
      include: ticketInclude,
    });

    await logActivity(ticket, actor.id, 'ticket.created', { key: ticket.key });
    emitTicket(ticket, 'task:created', ticket);
    return ticket;
  },

  /* ── Shared by both kinds ────────────────────────────────────── */

  async getById(actor: Actor, id: string) {
    const { ticket } = await accessOrThrow(actor, id);
    return ticket;
  },

  /** Update. Any member may update an org ticket, including reassigning it. */
  async update(actor: Actor, id: string, input: UpdateTicketInput) {
    const { ticket: before } = await accessOrThrow(actor, id);

    if (input.assigneeId && before.orgId) {
      await assertAssignable(input.assigneeId, before.orgId);
    }

    const changes = diffChanges(before, input);
    const data: Prisma.TicketUpdateInput = { ...input };
    // Keep completedAt consistent with status transitions.
    if (input.status && input.status !== before.status) {
      data.completedAt = input.status === 'DONE' ? new Date() : null;
    }

    const ticket = await prisma.ticket.update({ where: { id }, data, include: ticketInclude });

    if (Object.keys(changes).length > 0) {
      const statusChanged = 'status' in changes;
      // Log under the kind it actually is, so the timeline reads correctly.
      const kind = ticket.sprintId ? 'ticket' : 'task';
      await logActivity(
        ticket,
        actor.id,
        statusChanged && ticket.status === 'DONE' ? `${kind}.completed` : `${kind}.updated`,
        { changes } as Prisma.InputJsonValue,
      );
    }

    emitTicket(ticket, 'task:updated', ticket);
    return ticket;
  },

  /**
   * Delete.
   *
   * The one asymmetry in the model: a worker may create and update a ticket but
   * never delete one — not even a ticket they created (docs §3). Personal tasks
   * are unaffected; their creator deletes them.
   */
  async remove(actor: Actor, id: string) {
    const { ticket, role } = await accessOrThrow(actor, id);

    if (ticket.sprintId !== null && role !== 'ASSIGNER') {
      throw AppError.forbidden('Only an assigner can delete a ticket');
    }

    await prisma.ticket.delete({ where: { id } });
    emitTicket(ticket, 'task:deleted', { id });
    return { id };
  },

  async listActivity(actor: Actor, ticketId: string) {
    await accessOrThrow(actor, ticketId);
    return prisma.activity.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: personSelect } },
    });
  },

  async addAttachment(
    actor: Actor,
    ticketId: string,
    file: { filename: string; originalName: string; mimeType: string; size: number; url: string },
  ) {
    const { ticket } = await accessOrThrow(actor, ticketId);
    const attachment = await prisma.attachment.create({ data: { ...file, ticketId } });
    await logActivity(ticket, actor.id, 'attachment.added', { name: file.originalName });
    emitTicket(ticket, 'task:updated', await this.getById(actor, ticketId));
    return attachment;
  },

  async removeAttachment(actor: Actor, ticketId: string, attachmentId: string) {
    const { ticket } = await accessOrThrow(actor, ticketId);
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId },
    });
    if (!attachment) throw AppError.notFound('Attachment not found');

    await prisma.attachment.delete({ where: { id: attachmentId } });
    await logActivity(ticket, actor.id, 'attachment.removed', { name: attachment.originalName });
    emitTicket(ticket, 'task:updated', await this.getById(actor, ticketId));
    return { id: attachmentId, filename: attachment.filename };
  },

  /* ── Comments / discussion ───────────────────────────────────── */
  async listComments(actor: Actor, ticketId: string) {
    await accessOrThrow(actor, ticketId);
    return prisma.comment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { ...personSelect, role: true } } },
    });
  },

  async addComment(actor: Actor, ticketId: string, body: string) {
    const { ticket } = await accessOrThrow(actor, ticketId);
    const comment = await prisma.comment.create({
      data: { body, ticketId, authorId: actor.id },
      include: { author: { select: { ...personSelect, role: true } } },
    });
    await logActivity(ticket, actor.id, 'comment.added');
    // `taskId` in the payload keeps the existing socket contract stable.
    emitTicket(ticket, 'comment:created', { taskId: ticketId, comment });
    return comment;
  },

  async removeComment(actor: Actor, ticketId: string, commentId: string) {
    const { ticket } = await accessOrThrow(actor, ticketId);
    const comment = await prisma.comment.findFirst({ where: { id: commentId, ticketId } });
    if (!comment) throw AppError.notFound('Comment not found');

    // Authors may delete their own comments; admins may delete any.
    if (actor.role !== 'ADMIN' && comment.authorId !== actor.id) {
      throw AppError.forbidden('You can only delete your own comments');
    }

    await prisma.comment.delete({ where: { id: commentId } });
    emitTicket(ticket, 'comment:deleted', { taskId: ticketId, commentId });
    return { id: commentId };
  },
};
