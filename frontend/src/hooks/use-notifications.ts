'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AppNotification, PageMeta } from '@/lib/types';
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

type NotificationList = { items: AppNotification[]; meta?: PageMeta & { unread: number } };

/** Snapshot every notification cache so a failed write can be undone whole. */
function snapshot(qc: ReturnType<typeof useQueryClient>) {
  return {
    lists: qc.getQueriesData<NotificationList>({ queryKey: notificationKeys.all }),
    unread: qc.getQueryData<number>(notificationKeys.unread()),
  };
}

function restore(qc: ReturnType<typeof useQueryClient>, snap: ReturnType<typeof snapshot>) {
  snap.lists.forEach(([key, data]) => qc.setQueryData(key, data));
  qc.setQueryData(notificationKeys.unread(), snap.unread);
}

/**
 * Mark one as read — greyed out and off the badge immediately.
 *
 * Marking read is the most-repeated action in the drawer and the least
 * interesting, so it must not cost a visible round trip. The count is decremented
 * locally rather than refetched for the same reason.
 */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notificationKeys.all });
      const snap = snapshot(qc);
      const now = new Date().toISOString();
      let wasUnread = false;

      qc.setQueriesData<NotificationList>({ queryKey: notificationKeys.all }, (old) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.map((n) => {
            if (n.id !== id || n.readAt) return n;
            wasUnread = true;
            return { ...n, readAt: now };
          }),
        };
      });
      if (wasUnread) {
        qc.setQueryData<number>(notificationKeys.unread(), (n) => Math.max(0, (n ?? 1) - 1));
      }

      return snap;
    },
    onError: (_err, _id, snap) => snap && restore(qc, snap),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.notifications.markAllRead,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.all });
      const snap = snapshot(qc);
      const now = new Date().toISOString();

      qc.setQueriesData<NotificationList>({ queryKey: notificationKeys.all }, (old) =>
        old?.items ? { ...old, items: old.items.map((n) => n.readAt ? n : { ...n, readAt: now }) } : old,
      );
      qc.setQueryData<number>(notificationKeys.unread(), 0);

      return snap;
    },
    onError: (_err, _vars, snap) => snap && restore(qc, snap),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
