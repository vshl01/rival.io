import type { ReactNode } from 'react';
import { AppNav } from '@/components/app/app-nav';
import { CommandPalette } from '@/components/app/command-palette';
import { RequireAuth } from '@/components/auth/auth-gate';
import { TaskDetailDrawer } from '@/components/tasks/task-detail-drawer';
import { TaskFormModal } from '@/components/tasks/task-form-modal';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen flex-col">
        <AppNav />
        <main className="flex-1">{children}</main>

        {/* Global, route-independent overlays */}
        <CommandPalette />
        <TaskFormModal />
        <TaskDetailDrawer />
      </div>
    </RequireAuth>
  );
}
