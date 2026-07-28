'use client';

import { Bell, Command, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { NotificationsDrawer } from '@/components/notifications/notifications-drawer';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useUnreadCount } from '@/hooks/use-notifications';
import { useRealtime } from '@/providers/socket-provider';
import { useAuth } from '@/store/auth';
import { useUi } from '@/store/ui';
import { cn } from '@/lib/utils';
import { UserMenu } from './user-menu';

export function AppNav() {
  const pathname = usePathname();
  const role = useAuth((s) => s.user?.role);
  const setCommandOpen = useUi((s) => s.setCommandOpen);
  const { connected } = useRealtime();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  // Socket push keeps this current; the hook only polls if the socket is down.
  const { data: unread = 0 } = useUnreadCount(connected);

  const links = [
    { href: '/dashboard', label: 'Tasks' },
    { href: '/dashboard/organizations', label: 'Organisations' },
    ...(role === 'ADMIN' ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Logo href="/dashboard" />
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((l) => {
              // Org workspaces live at /dashboard/<slug>, so anything below
              // /dashboard belongs to the Organisations section — while
              // /dashboard itself stays the personal Tasks view.
              const active =
                l.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === l.href || pathname.startsWith(`${l.href}/`) ||
                    (l.href === '/dashboard/organizations' && pathname.startsWith('/dashboard/'));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm transition-colors',
                    active ? 'bg-elevated font-medium text-ink' : 'text-ink-soft hover:text-ink',
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Realtime status */}
          <span
            title={connected ? 'Live — real-time connected' : 'Reconnecting…'}
            className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-faint sm:flex"
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-accent' : 'bg-ink-faint')} />
            {connected ? 'Live' : 'Offline'}
          </span>

          {/* ⌘K trigger */}
          <button
            onClick={() => setCommandOpen(true)}
            className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-ink-faint transition-colors hover:text-ink"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">Quick actions</span>
            <kbd className="hidden items-center gap-0.5 rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-[10px] md:inline-flex">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          {/* Notifications */}
          <button
            onClick={() => setNotificationsOpen(true)}
            aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-elevated hover:text-ink"
          >
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-ink">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          <ThemeToggle />
          <UserMenu />
        </div>
      </div>

      <NotificationsDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </header>
  );
}
