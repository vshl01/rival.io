import type { Prisma } from '@prisma/client';
import type { Actor } from '@/access/actor';
import { prisma } from '@/lib/prisma';
import { emitToUser } from '@/lib/socket';
import { AppError } from '@/utils/AppError';

/**
 * Notifications.
 *
 * Reads are scoped to the caller by `userId` on every query — a notification is
 * addressed to one person and there is no case where anyone else may read it,
 * not even a platform admin.
 *
 * Live socket push still belongs to build step 6 (docs/architecture.md §8); the
 * drawer polls the unread count until then.
 */

/** Stable notification type strings. Kept in one place so the UI can switch on them. */
export const NotificationType = {
  JoinRequestReceived: 'join_request.received',
  JoinRequestAccepted: 'join_request.accepted',
  JoinRequestRejected: 'join_request.rejected',
  MemberRoleChanged: 'member.role_changed',
  MemberRemoved: 'member.removed',
} as const;

export type NotificationTypeValue = (typeof NotificationType)[keyof typeof NotificationType];

interface NotifyInput {
  /** Recipient. */
  userId: string;
  type: NotificationTypeValue;
  /** Everything the drawer needs to render a line without extra fetches. */
  payload?: Prisma.InputJsonValue;
}

/**
 * Create one notification.
 *
 * Accepts an optional transaction client so a notification can be written in the
 * same transaction as the change that caused it — a decision that is recorded
 * but never announced is worse than no decision at all.
 */
export function notify(input: NotifyInput, tx: Prisma.TransactionClient = prisma) {
  return tx.notification.create({
    data: { userId: input.userId, type: input.type, payload: input.payload },
  });
}

/** Fan a single notification out to many recipients (e.g. every assigner in an org). */
export function notifyMany(
  userIds: string[],
  input: Omit<NotifyInput, 'userId'>,
  tx: Prisma.TransactionClient = prisma,
) {
  if (userIds.length === 0) return Promise.resolve({ count: 0 });
  return tx.notification.createMany({
    data: userIds.map((userId) => ({ userId, type: input.type, payload: input.payload })),
  });
}

/**
 * Tell recipients a notification is waiting.
 *
 * Call this AFTER the transaction that wrote the rows has committed — emitting
 * inside it would announce a decision that could still roll back, and the client
 * would refetch to find nothing there.
 *
 * Deliberately payload-free: the client refetches, so this one event covers every
 * notification kind and the socket contract never has to track their shapes.
 */
export function emitNotificationCreated(userIds: string[]) {
  for (const userId of new Set(userIds)) {
    emitToUser(userId, 'notification:created', null);
  }
}

const notificationSelect = {
  id: true,
  type: true,
  payload: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export const notificationsService = {
  /** The caller's notifications, newest first. */
  async list(actor: Actor, query: { unreadOnly: boolean; page: number; pageSize: number }) {
    const where: Prisma.NotificationWhereInput = {
      userId: actor.id,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: notificationSelect,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: actor.id, readAt: null } }),
    ]);

    return { items, total, unread };
  },

  /** Unread badge count — served by `@@index([userId, readAt])`. */
  async unreadCount(actor: Actor) {
    const unread = await prisma.notification.count({ where: { userId: actor.id, readAt: null } });
    return { unread };
  },

  /**
   * Mark one as read. Scoped by userId in the same query as the id, so another
   * person's notification cannot be touched even with a valid id.
   */
  async markRead(actor: Actor, id: string) {
    const { count } = await prisma.notification.updateMany({
      where: { id, userId: actor.id },
      data: { readAt: new Date() },
    });
    if (count === 0) throw AppError.notFound('Notification not found');
    return { id, readAt: new Date() };
  },

  /** Mark everything read — what the drawer does when it is opened and dismissed. */
  async markAllRead(actor: Actor) {
    const { count } = await prisma.notification.updateMany({
      where: { userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  },
};
