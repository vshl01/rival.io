'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { RequireAdmin } from '@/components/auth/auth-gate';
import { TaskWorkspace } from '@/components/tasks/task-workspace';
import { Skeleton } from '@/components/ui/feedback';
import { api } from '@/lib/api';
import { ease } from '@/lib/motion';
import { cn } from '@/lib/utils';

function AdminConsole() {
  const [ownerId, setOwnerId] = useState<string | undefined>(undefined);
  const { data: users, isLoading } = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.users.list() });

  return (
    <div className="container-page py-8 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="mb-7"
      >
        <p className="text-eyebrow mb-1.5 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Admin console
        </p>
        <h1 className="font-display text-4xl tracking-[-0.02em] text-ink sm:text-5xl">
          Every task, <span className="italic text-accent">everyone’s.</span>
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          As an admin you can browse all users’ tasks. Pick a person to focus, or view the whole org.
        </p>
      </motion.div>

      {/* User selector */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-32 shrink-0 rounded-full" />)
        ) : (
          <>
            <Chip active={!ownerId} onClick={() => setOwnerId(undefined)} label="Everyone" count={users?.reduce((a, u) => a + u._count.tickets, 0)} />
            {users?.map((u) => (
              <Chip
                key={u.id}
                active={ownerId === u.id}
                onClick={() => setOwnerId(u.id)}
                label={u.name}
                sub={u.role === 'ADMIN' ? 'admin' : undefined}
                count={u._count.tickets}
              />
            ))}
          </>
        )}
      </div>

      <TaskWorkspace key={ownerId ?? 'all'} ownerId={ownerId} />
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  sub,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
        active ? 'border-accent bg-accent/10 text-ink' : 'border-line bg-surface text-ink-soft hover:text-ink',
      )}
    >
      <span className="font-medium">{label}</span>
      {sub && <span className="text-[11px] text-accent">{sub}</span>}
      {count !== undefined && (
        <span className={cn('rounded-full px-1.5 text-xs', active ? 'bg-accent/20 text-ink' : 'bg-elevated text-ink-faint')}>
          {count}
        </span>
      )}
    </button>
  );
}

export default function AdminPage() {
  return (
    <RequireAdmin>
      <AdminConsole />
    </RequireAdmin>
  );
}
