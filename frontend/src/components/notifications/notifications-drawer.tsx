'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BellOff, CheckCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/use-notifications';
import { formatRelative } from '@/lib/format';
import { ease } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { describeNotification } from './notification-line';

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-over notification panel.
 *
 * Portalled and fixed rather than nested in the header, so it can span the full
 * viewport height without the sticky nav's backdrop-blur creating a new stacking
 * context around it.
 */
export function NotificationsDrawer({ open, onClose }: NotificationsDrawerProps) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  // Only queries once opened — see `enabled` in useNotifications.
  const { data, isLoading } = useNotifications(unreadOnly, open);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Close on Escape and lock body scroll, matching Modal's behaviour.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  const items = data?.items ?? [];
  const unread = data?.meta?.unread ?? 0;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Notifications">
          <motion.div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.aside
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-lift"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease }}
          >
            <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-2xl leading-none text-ink">Notifications</h2>
                {unread > 0 && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                    {unread} new
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Close notifications"
                className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-elevated hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-2.5">
              <div className="flex gap-1">
                {([false, true] as const).map((only) => (
                  <button
                    key={String(only)}
                    onClick={() => setUnreadOnly(only)}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-xs transition-colors',
                      unreadOnly === only
                        ? 'bg-elevated font-medium text-ink'
                        : 'text-ink-soft hover:text-ink',
                    )}
                  >
                    {only ? 'Unread' : 'All'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => markAllRead.mutate()}
                disabled={unread === 0 || markAllRead.isPending}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={<BellOff className="h-6 w-6" />}
                  title={unreadOnly ? 'Nothing unread' : 'No notifications'}
                  description={
                    unreadOnly
                      ? 'You’re all caught up.'
                      : 'Join requests and role changes will show up here.'
                  }
                />
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((notification) => {
                    const { icon: Icon, tone, title, detail, href } =
                      describeNotification(notification);
                    const isUnread = notification.readAt === null;

                    const body = (
                      <>
                        <span
                          className={cn(
                            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-elevated',
                            tone,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-ink">{title}</span>
                          {detail && (
                            <span className="mt-0.5 block truncate text-xs text-ink-soft">
                              {detail}
                            </span>
                          )}
                          <span className="mt-1 block text-[11px] text-ink-faint">
                            {formatRelative(notification.createdAt)}
                          </span>
                        </span>
                        {isUnread && (
                          <span
                            aria-label="Unread"
                            className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                          />
                        )}
                      </>
                    );

                    const className = cn(
                      'flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-elevated/60',
                      isUnread && 'bg-accent/[0.03]',
                    );

                    // Reading is a side effect of engaging with it, whether that
                    // means following the link or just acknowledging it.
                    const acknowledge = () => {
                      if (isUnread) markRead.mutate(notification.id);
                    };

                    return (
                      <li key={notification.id}>
                        {href ? (
                          <Link
                            href={href}
                            className={className}
                            onClick={() => {
                              acknowledge();
                              onClose();
                            }}
                          >
                            {body}
                          </Link>
                        ) : (
                          <button type="button" className={className} onClick={acknowledge}>
                            {body}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
