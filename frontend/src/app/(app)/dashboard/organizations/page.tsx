'use client';

import { Building2, Compass, Plus } from 'lucide-react';
import { useState } from 'react';
import { CreateOrgModal } from '@/components/orgs/create-org-modal';
import { OrgCard } from '@/components/orgs/org-card';
import { OrgDirectory } from '@/components/orgs/org-directory';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { useMyJoinRequests, useMyOrgs } from '@/hooks/use-orgs';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The organisations hub — and the answer to "am I an assigner or a worker?".
 *
 * That question is never asked directly, because the role follows from the
 * action: create an organisation and you are its assigner; join one and you are
 * a worker. Both paths are presented side by side here.
 */
export default function OrganizationsPage() {
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [createOpen, setCreateOpen] = useState(false);
  const { data: orgs, isLoading, isError, refetch } = useMyOrgs();

  return (
    <div className="container-page py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-none text-ink">Organisations</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Create one to lead it, or join one to work in it.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New organisation
        </Button>
      </header>

      <nav className="mt-7 flex gap-1 border-b border-line" aria-label="Organisation views">
        {(
          [
            { id: 'mine', label: 'Mine', icon: Building2 },
            { id: 'discover', label: 'Discover', icon: Compass },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm transition-colors',
              tab === id
                ? 'border-accent font-medium text-ink'
                : 'border-transparent text-ink-soft hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {id === 'mine' && orgs?.length ? (
              <span className="text-xs text-ink-faint">{orgs.length}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === 'discover' ? (
          <OrgDirectory />
        ) : isError ? (
          <ErrorState
            title="Couldn’t load your organisations"
            message="The API didn’t respond as expected."
            onRetry={() => refetch()}
          />
        ) : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[132px] rounded-2xl" />
            ))}
          </div>
        ) : !orgs?.length ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="No organisations yet"
            description="Create one and you'll be its assigner — able to run sprints and approve who joins. Or browse Discover to ask to join an existing team."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create an organisation
                </Button>
                <Button variant="secondary" onClick={() => setTab('discover')}>
                  <Compass className="h-4 w-4" />
                  Find one to join
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {orgs.map((org) => (
                <OrgCard key={org.id} org={org} />
              ))}
            </div>
            <PendingRequests />
          </>
        )}
      </div>

      <CreateOrgModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

/**
 * The caller's own outstanding requests.
 *
 * Rendered only when there are pending ones — a settled request is already
 * reflected by the org appearing (or not) in the list above, so listing it again
 * would just be noise.
 */
function PendingRequests() {
  const { data: requests } = useMyJoinRequests();
  const pending = requests?.filter((request) => request.status === 'PENDING') ?? [];

  if (pending.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-sm font-medium text-ink">Awaiting approval</h2>
      <ul className="mt-3 space-y-2">
        {pending.map((request) => (
          <li
            key={request.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-line px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">{request.org.name}</p>
              <p className="text-xs text-ink-faint">asked {formatRelative(request.createdAt)}</p>
            </div>
            <span className="shrink-0 text-xs text-ink-faint">Pending</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
