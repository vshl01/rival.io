import { Eye, ShieldCheck, Wrench } from 'lucide-react';
import type { OrgRole } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Role chip. `null` is a real state, not missing data: a platform admin viewing
 * an org they do not belong to has no org role, and showing "Worker" there would
 * be a lie about their permissions.
 */
const META = {
  ASSIGNER: {
    label: 'Assigner',
    icon: ShieldCheck,
    chip: 'border-accent/30 bg-accent/10 text-accent',
  },
  WORKER: {
    label: 'Worker',
    icon: Wrench,
    chip: 'border-line bg-elevated text-ink-soft',
  },
} as const;

const VIEWING = {
  label: 'Viewing',
  icon: Eye,
  chip: 'border-line bg-elevated text-ink-faint',
} as const;

export function OrgRoleBadge({ role, className }: { role: OrgRole | null; className?: string }) {
  const meta = role ? META[role] : VIEWING;
  const Icon = meta.icon;

  return (
    <span
      title={role ? undefined : 'Platform admin — read-only access to this organisation'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        meta.chip,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}
