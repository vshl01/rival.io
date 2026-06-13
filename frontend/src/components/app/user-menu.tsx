'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/utils';

export function UserMenu() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!user) return null;
  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface pl-1 pr-2.5 transition-colors hover:bg-elevated"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-ink">
          {initials}
        </span>
        <span className="hidden text-sm font-medium text-ink sm:block">{user.name.split(' ')[0]}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift"
          >
            <div className="border-b border-line px-4 py-3">
              <p className="truncate text-sm font-medium text-ink">{user.name}</p>
              <p className="truncate text-xs text-ink-faint">{user.email}</p>
              <span
                className={cn(
                  'mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  user.role === 'ADMIN'
                    ? 'border-accent/30 bg-accent/10 text-accent'
                    : 'border-line text-ink-soft',
                )}
              >
                {user.role === 'ADMIN' && <Shield className="h-3 w-3" />}
                {user.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-ink-soft transition-colors hover:bg-elevated hover:text-danger"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
