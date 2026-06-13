'use client';

import { Command, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
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

  const links = [
    { href: '/dashboard', label: 'Tasks' },
    ...(role === 'ADMIN' ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Logo href="/dashboard" />
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((l) => {
              const active = pathname === l.href;
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

          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
