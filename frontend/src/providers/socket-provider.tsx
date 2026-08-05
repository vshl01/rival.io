'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import { notificationKeys } from '@/hooks/use-notifications';
import { orgKeys } from '@/hooks/use-orgs';
import { taskKeys, ticketKeys } from '@/lib/query-keys';
import type { Task } from '@/lib/types';
import { useAuth } from '@/store/auth';

interface SocketCtx {
  connected: boolean;
  /** Null until the connection is established, and again after a logout. */
  socket: Socket | null;
}
const Ctx = createContext<SocketCtx>({ connected: false, socket: null });
export const useRealtime = () => useContext(Ctx);

/**
 * Watch one sprint's board for as long as this component is mounted.
 *
 * Boards are shared, so the server keys their events by sprint rather than by
 * person — but a socket only receives them after asking to, and the server checks
 * org membership before letting it in. Re-runs on `connected` because a reconnect
 * is a NEW socket session: rooms are not restored, and without this a board would
 * quietly stop updating after a network blip.
 */
export function useWatchSprint(sprintId: string | null | undefined) {
  const { socket, connected } = useRealtime();

  useEffect(() => {
    if (!socket || !connected || !sprintId) return;
    socket.emit('sprint:watch', sprintId);
    return () => {
      socket.emit('sprint:unwatch', sprintId);
    };
  }, [socket, connected, sprintId]);
}

/**
 * Maintains a single authenticated Socket.IO connection while logged in and
 * invalidates the relevant React Query caches when the server pushes a task
 * mutation — so every open tab stays live without polling.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const accessToken = useAuth((s) => s.accessToken);
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  // State, not a ref: consumers subscribe to the instance, so they have to
  // re-render when it is replaced.
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const socket = io(API_URL, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
    };

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('task:created', invalidate);
    socket.on('task:deleted', invalidate);
    socket.on('task:updated', (task: { id: string }) => {
      invalidate();
      if (task?.id) {
        queryClient.invalidateQueries({ queryKey: taskKeys.detail(task.id) });
        queryClient.invalidateQueries({ queryKey: taskKeys.activity(task.id) });
      }
    });
    const onComment = (payload: { taskId: string }) => {
      if (payload?.taskId) {
        queryClient.invalidateQueries({ queryKey: taskKeys.comments(payload.taskId) });
        queryClient.invalidateQueries({ queryKey: taskKeys.detail(payload.taskId) });
      }
      invalidate();
    };
    socket.on('comment:created', onComment);
    socket.on('comment:deleted', onComment);

    /**
     * A notification was written for this user.
     *
     * The event carries no payload on purpose — we refetch instead, so one
     * handler covers every notification kind. Besides the bell, this refreshes
     * the org's own "Join requests" section: that list is what an assigner is
     * actually looking at when someone asks to join, and polling it would either
     * lag or hammer the API.
     */
    socket.on('notification:created', () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      queryClient.invalidateQueries({ queryKey: [...orgKeys.all, 'join-requests'] });
      // Being accepted, promoted or removed all change these.
      queryClient.invalidateQueries({ queryKey: orgKeys.mine() });
      queryClient.invalidateQueries({ queryKey: orgKeys.myJoinRequests() });
    });

    return () => {
      socket.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [isAuthenticated, accessToken, queryClient]);

  return <Ctx.Provider value={{ connected, socket }}>{children}</Ctx.Provider>;
}
