'use client';

import { motion } from 'framer-motion';
import { TaskWorkspace } from '@/components/tasks/task-workspace';
import { ease } from '@/lib/motion';
import { useAuth } from '@/store/auth';

export default function DashboardPage() {
  const user = useAuth((s) => s.user);
  const name = user?.name?.split(' ')[0];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="container-page py-8 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="mb-7"
      >
        <p className="text-eyebrow mb-1.5">{greeting}{name ? `, ${name}` : ''}</p>
        <h1 className="font-display text-4xl tracking-[-0.02em] text-ink sm:text-5xl">
          Let’s make it a <span className="italic text-accent">productive</span> one.
        </h1>
      </motion.div>

      {/* Scope the dashboard to the signed-in user's own tasks — even for
          admins (whose org-wide view lives in the Admin console). */}
      <TaskWorkspace ownerId={user?.id} />
    </div>
  );
}
