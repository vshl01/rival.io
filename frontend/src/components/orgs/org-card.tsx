import { ArrowUpRight, Users } from 'lucide-react';
import Link from 'next/link';
import type { Organization } from '@/lib/types';
import { OrgRoleBadge } from './org-role-badge';

/** One organisation the caller belongs to. Links into its workspace. */
export function OrgCard({ org }: { org: Organization }) {
  return (
    <Link
      href={`/dashboard/${org.slug}`}
      className="group flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface p-5 transition-all hover:border-ink-faint/40 hover:shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl leading-tight text-ink">{org.name}</h3>
          <p className="mt-1 font-mono text-xs text-ink-faint">{org.key}-000</p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <OrgRoleBadge role={org.myRole} />
        <span className="flex items-center gap-1.5 text-xs text-ink-faint">
          <Users className="h-3.5 w-3.5" />
          {org._count.memberships}
          {org._count.memberships === 1 ? ' member' : ' members'}
        </span>
      </div>
    </Link>
  );
}
