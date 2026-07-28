'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/api';
import { notificationKeys } from '@/hooks/use-notifications';
import { orgKeys } from '@/hooks/use-orgs';
import { taskKeys } from '@/hooks/use-tasks';
import { useAuth } from '@/store/auth';

interface SocketCtx {
  connected: boolean;
}
const Ctx = createContext<SocketCtx>({ connected: false });
export const useRealtime = () => useContext(Ctx);

/**
 * Maintains a single authenticated Socket.IO connection while logged in and
 * invalidates the relevant React Query caches when the server pushes a task
 * mutation — so every open tab stays live without polling.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const accessToken = useAuth((s) => s.accessToken);
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
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
      socketRef.current = null;
      setConnected(false);
    };
  }, [isAuthenticated, accessToken, queryClient]);

  return <Ctx.Provider value={{ connected }}>{children}</Ctx.Provider>;
}
