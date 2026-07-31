'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';

/* ── Query keys ─────────────────────────────────────────────── */
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unreadOnly: boolean) => [...notificationKeys.all, 'list', unreadOnly] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
};

/**
 * Unread badge count.
 *
 * Pushed, not polled: the server emits `notification:created` and
 * SocketProvider invalidates this query, so the badge updates immediately.
 *
 * The interval is a FALLBACK for when that push cannot arrive, and it is disabled
 * whenever the socket is connected. It matters because the socket really does
 * drop: `reconnectionAttempts: 5` then gives up for good, the handshake fails
 * once the 15-minute access token expires, and `transports: ['websocket']` has no
 * long-polling fallback if a proxy blocks WS. Without this, a user whose socket
 * died would silently stop seeing notifications until they reloaded.
 *
 * @param socketConnected pass `useRealtime().connected`. Taken as an argument
 * rather than read here, because this module is imported BY SocketProvider —
 * importing it back would be a cycle.
 */
export function useUnreadCount(socketConnected = false) {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: api.notifications.unreadCount,
    enabled: isAuthenticated,
    refetchInterval: socketConnected ? false : 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useNotifications(unreadOnly: boolean, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list(unreadOnly),
    queryFn: () => api.notifications.list({ unreadOnly }),
    // Only fetches once the drawer is actually open.
    enabled,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.notifications.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
