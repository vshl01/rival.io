import type { Prisma, Role, Task } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { emitToUser } from '@/lib/socket';
import { AppError } from '@/utils/AppError';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from './tasks.schemas';

interface Actor {
  id: string;
  role: Role;
}

const taskInclude = {
  attachments: { orderBy: { createdAt: 'desc' } },
  _count: { select: { attachments: true, activities: true, comments: true } },
} satisfies Prisma.TaskInclude;

/** Record an audit entry and notify the owner's room. Best-effort, never blocks. */
async function logActivity(
  task: Pick<Task, 'id' | 'ownerId'>,
  actorId: string,
  action: string,
  metadata?: Prisma.InputJsonValue,
) {
  const activity = await prisma.activity.create({
    data: { taskId: task.id, actorId, action, metadata },
  });
  emitToUser(task.ownerId, 'activity:created', activity);
}

/** Compute a field-level diff for the activity log. */
function diffChanges(before: Task, input: UpdateTaskInput) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(input) as (keyof UpdateTaskInput)[]) {
    const next = input[key];
    const prev = before[key as keyof Task];
    const prevComparable = prev instanceof Date ? prev.toISOString() : prev;
    const nextComparable = next instanceof Date ? next.toISOString() : next;
    if (prevComparable !== nextComparable) {
      changes[key] = { from: prevComparable ?? null, to: nextComparable ?? null };
    }
  }
  return changes;
}

export const tasksService = {
  async create(actor: Actor, input: CreateTaskInput) {
    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate ?? null,
        completedAt: input.status === 'DONE' ? new Date() : null,
        ownerId: actor.id,
      },
      include: taskInclude,
    });

    await logActivity(task, actor.id, 'task.created');
    emitToUser(actor.id, 'task:created', task);
    return task;
  },

  async list(actor: Actor, query: ListTasksQuery) {
    const where: Prisma.TaskWhereInput = {};

    // Ownership scoping: regular users are hard-locked to their own tasks.
    // Admins may pass `ownerId` to inspect one user, or omit it to see all.
    if (actor.role === 'ADMIN') {
      if (query.ownerId) where.ownerId = query.ownerId;
    } else {
      where.ownerId = actor.id;
    }

    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    // Native Postgres enum ordering matches our declared order
    // (LOW < MEDIUM < HIGH < URGENT), so `priority desc` = most urgent first.
    const orderBy: Prisma.TaskOrderByWithRelationInput = { [query.sortBy]: query.sortOrder };

    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await prisma.$transaction([
      prisma.task.findMany({
        where,
        orderBy,
        skip,
        take: query.pageSize,
        include: taskInclude,
      }),
      prisma.task.count({ where }),
    ]);

    return { items, total };
  },

  /** Fetch a task the actor is allowed to see, else 404 (avoids leaking existence). */
  async getOwnedOrThrow(actor: Actor, id: string) {
    const task = await prisma.task.findUnique({ where: { id }, include: taskInclude });
    if (!task) throw AppError.notFound('Task not found');
    if (actor.role !== 'ADMIN' && task.ownerId !== actor.id) {
      throw AppError.notFound('Task not found');
    }
    return task;
  },

  async getById(actor: Actor, id: string) {
    return this.getOwnedOrThrow(actor, id);
  },

  async update(actor: Actor, id: string, input: UpdateTaskInput) {
    const before = await this.getOwnedOrThrow(actor, id);
    const changes = diffChanges(before, input);

    const data: Prisma.TaskUpdateInput = { ...input };
    // Keep completedAt consistent with status transitions.
    if (input.status && input.status !== before.status) {
      data.completedAt = input.status === 'DONE' ? new Date() : null;
    }

    const task = await prisma.task.update({ where: { id }, data, include: taskInclude });

    if (Object.keys(changes).length > 0) {
      const statusChanged = 'status' in changes;
      await logActivity(
        task,
        actor.id,
        statusChanged && task.status === 'DONE' ? 'task.completed' : 'task.updated',
        { changes } as Prisma.InputJsonValue,
      );
    }
    emitToUser(task.ownerId, 'task:updated', task);
    return task;
  },

  async remove(actor: Actor, id: string) {
    const task = await this.getOwnedOrThrow(actor, id);
    await prisma.task.delete({ where: { id } });
    emitToUser(task.ownerId, 'task:deleted', { id });
    return { id };
  },

  async listActivity(actor: Actor, taskId: string) {
    await this.getOwnedOrThrow(actor, taskId);
    return prisma.activity.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
  },

  async addAttachment(
    actor: Actor,
    taskId: string,
    file: { filename: string; originalName: string; mimeType: string; size: number; url: string },
  ) {
    const task = await this.getOwnedOrThrow(actor, taskId);
    const attachment = await prisma.attachment.create({ data: { ...file, taskId } });
    await logActivity(task, actor.id, 'attachment.added', { name: file.originalName });
    emitToUser(task.ownerId, 'task:updated', await this.getOwnedOrThrow(actor, taskId));
    return attachment;
  },

  async removeAttachment(actor: Actor, taskId: string, attachmentId: string) {
    const task = await this.getOwnedOrThrow(actor, taskId);
    const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, taskId } });
    if (!attachment) throw AppError.notFound('Attachment not found');
    await prisma.attachment.delete({ where: { id: attachmentId } });
    await logActivity(task, actor.id, 'attachment.removed', { name: attachment.originalName });
    emitToUser(task.ownerId, 'task:updated', await this.getOwnedOrThrow(actor, taskId));
    return { id: attachmentId, filename: attachment.filename };
  },

  // ── Comments / discussion ─────────────────────────────────────
  async listComments(actor: Actor, taskId: string) {
    await this.getOwnedOrThrow(actor, taskId);
    return prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, email: true, role: true } } },
    });
  },

  async addComment(actor: Actor, taskId: string, body: string) {
    const task = await this.getOwnedOrThrow(actor, taskId);
    const comment = await prisma.comment.create({
      data: { body, taskId, authorId: actor.id },
      include: { author: { select: { id: true, name: true, email: true, role: true } } },
    });
    await logActivity(task, actor.id, 'comment.added');
    // Notify the task owner's room (and admins) so the thread updates live.
    emitToUser(task.ownerId, 'comment:created', { taskId, comment });
    return comment;
  },

  async removeComment(actor: Actor, taskId: string, commentId: string) {
    const task = await this.getOwnedOrThrow(actor, taskId);
    const comment = await prisma.comment.findFirst({ where: { id: commentId, taskId } });
    if (!comment) throw AppError.notFound('Comment not found');
    // Authors may delete their own comments; admins may delete any.
    if (actor.role !== 'ADMIN' && comment.authorId !== actor.id) {
      throw AppError.forbidden('You can only delete your own comments');
    }
    await prisma.comment.delete({ where: { id: commentId } });
    emitToUser(task.ownerId, 'comment:deleted', { taskId, commentId });
    return { id: commentId };
  },
};
