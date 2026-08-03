import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer, type Socket } from 'socket.io';
import { corsOptions } from '@/config/cors';
import { verifyAccessToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

/**
 * Realtime layer.
 *
 * Two kinds of room, because a ticket has an audience rather than an owner:
 *
 *   `user:<id>`    everything addressed to one person — notifications, and their
 *                  own personal tasks. Joined automatically at connection.
 *   `sprint:<id>`  one sprint's board. Joined ON REQUEST, and only after the
 *                  server has verified the socket's owner belongs to that
 *                  sprint's organisation — a room name is a client-supplied
 *                  string, so it can never be trusted on its own.
 *
 * Admins additionally join `admins` to observe global activity.
 */
let io: SocketServer | null = null;

export type TaskEvent =
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'activity:created'
  | 'comment:created'
  | 'comment:deleted'
  /**
   * A notification row was written for this user. Carries no payload — the
   * client refetches, so one event type covers every notification kind and the
   * socket never has to stay in sync with their shapes.
   */
  | 'notification:created';

/** Room name for one sprint's board. */
const sprintRoom = (sprintId: string) => `sprint:${sprintId}`;

/**
 * May this user watch this sprint's board?
 *
 * One query: the sprint carries a denormalised `orgId`, so membership is checked
 * without loading the cycle. A platform admin is allowed, matching the REST rule
 * that reading any org is a support function.
 */
async function canWatchSprint(userId: string, role: string, sprintId: string): Promise<boolean> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { orgId: true },
  });
  if (!sprint) return false;
  if (role === 'ADMIN') return true;

  const membership = await prisma.orgMembership.findUnique({
    where: { orgId_userId: { orgId: sprint.orgId, userId } },
    select: { id: true },
  });
  return membership !== null;
}

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, { cors: corsOptions });

  // Authenticate the handshake using the same access token as the REST API.
  io.use((socket: Socket, nextFn) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      socket.handshake.headers.authorization?.replace('Bearer ', '');
    if (!token) return nextFn(new Error('unauthorized'));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      nextFn();
    } catch {
      nextFn(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, role } = socket.data as { userId: string; role: string };
    socket.join(`user:${userId}`);
    if (role === 'ADMIN') socket.join('admins');

    /**
     * Watch a sprint's board. Sent when a board mounts, and again after a
     * reconnect — Socket.IO does not restore rooms for a new session id.
     *
     * Silently ignored when the caller has no access. There is nothing for the
     * client to do about it, and answering "that sprint exists but is not yours"
     * over a socket adds a way to probe for ids that the REST API does not.
     */
    socket.on('sprint:watch', async (sprintId: unknown) => {
      if (typeof sprintId !== 'string' || sprintId.length === 0) return;
      if (await canWatchSprint(userId, role, sprintId)) socket.join(sprintRoom(sprintId));
    });

    socket.on('sprint:unwatch', (sprintId: unknown) => {
      if (typeof sprintId === 'string' && sprintId.length > 0) socket.leave(sprintRoom(sprintId));
    });
  });

  return io;
}

/** Emit an event to a specific user's room (all of their connected tabs). */
export function emitToUser(userId: string, event: TaskEvent, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
  // Mirror everything to admins so the admin console reflects live activity.
  io?.to('admins').emit(event, payload);
}

/**
 * Emit to everyone watching a sprint's board.
 *
 * This is what makes a dragged card move on a colleague's screen. It is separate
 * from `emitToUser` because the audience is defined by what people are LOOKING at,
 * not by what they own — the same event still goes to the creator and assignees,
 * who care whether or not they have the board open.
 */
export function emitToSprint(sprintId: string, event: TaskEvent, payload: unknown) {
  io?.to(sprintRoom(sprintId)).emit(event, payload);
}

export function getIo(): SocketServer | null {
  return io;
}
