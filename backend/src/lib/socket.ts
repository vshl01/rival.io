import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer, type Socket } from 'socket.io';
import { env } from '@/config/env';
import { verifyAccessToken } from '@/lib/jwt';

/**
 * Realtime layer. Each authenticated socket joins a private room keyed by user
 * id (`user:<id>`). Task mutations emit into the owner's room so every open tab
 * stays in sync without polling. Admins additionally join `admins` to observe
 * global activity.
 */
let io: SocketServer | null = null;

export type TaskEvent =
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'activity:created'
  | 'comment:created'
  | 'comment:deleted';

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: env.corsAllowAll ? true : env.corsOrigins, credentials: true },
  });

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
  });

  return io;
}

/** Emit an event to a specific user's room (all of their connected tabs). */
export function emitToUser(userId: string, event: TaskEvent, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
  // Mirror everything to admins so the admin console reflects live activity.
  io?.to('admins').emit(event, payload);
}

export function getIo(): SocketServer | null {
  return io;
}
