'use client';

import { AlertTriangle, ArrowLeft, CalendarRange, LogOut, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { OrgRoleBadge } from '@/components/orgs/org-role-badge';
import { OrgSidePanel } from '@/components/orgs/org-side-panel';
import { CycleBlock } from '@/components/sprints/cycle-block';
import { Button } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { useLeaveOrg, useOrg, useOrgMembers } from '@/hooks/use-orgs';
import { useCycles } from '@/hooks/use-sprints';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';

/**
 * An organisation's workspace: /dashboard/{org}
 *
 * Two columns, and which is which is a deliberate ranking. Sprints are what the
 * page is FOR, so they hold the wide column permanently. Membership — the roster
 * and the approval queue — matters in bursts, so it shares one narrow panel that
 * flips between them instead of pushing the months below the fold.
 */
export default function OrgWorkspacePage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const currentUser = useAuth((s) => s.user);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const { data: org, isLoading, error } = useOrg(orgSlug ?? null);
  // Already loaded for the side panel, so this is the same cached query.
  const { data: members } = useOrgMembers(orgSlug ?? null);
  const leaveOrg = useLeaveOrg();

  const isAssigner = org?.myRole === 'ASSIGNER';
  /*
    The server refuses this with a 409 (`org-members.service.leave`). Checking it
    here too is not duplication for its own sake: the instruction — promote someone
    first — is only actionable next to the roster, and finding that out by being
    rejected is a worse way to learn a rule than being told before you act.
  */
  const isOnlyAssigner =
    isAssigner && (members?.filter((m) => m.role === 'ASSIGNER').length ?? 0) === 1;

  if (isLoading) {
    return (
      <div className="w-full space-y-4 px-4 py-5 sm:px-6">
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // 403 is the expected answer for a non-member, so it gets a real explanation
  // rather than a generic failure.
  if (error instanceof ApiError) {
    const forbidden = error.status === 403;
    return (
      <div className="container-page py-8">
        <ErrorState
          title={forbidden ? 'You’re not a member of this organisation' : 'Organisation not found'}
          message={
            forbidden
              ? 'Ask an assigner for an invitation, or request to join from Discover.'
              : 'Check the address — this organisation may have been renamed or removed.'
          }
        />
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => router.push('/dashboard/organizations')}>
            <ArrowLeft className="h-4 w-4" />
            Back to organisations
          </Button>
        </div>
      </div>
    );
  }

  if (!org) return null;

  return (
    <div className="w-full px-4 pb-8 sm:px-6">
      {/*
        Sticky under the h-16 app nav, like the sprint page, so the org's identity
        stays put while a long month list scrolls. One line: name, role, size, key.
      */}
      <header className="sticky top-16 z-20 -mx-4 mb-4 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <Link
          href="/dashboard/organizations"
          className="inline-flex items-center gap-1.5 text-[11px] text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3 w-3" />
          Organisations
        </Link>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="truncate font-display text-2xl leading-none text-ink">{org.name}</h1>
          <OrgRoleBadge role={org.myRole} />
          <span className="text-[11px] text-ink-faint">
            {org._count.memberships}
            {org._count.memberships === 1 ? ' member' : ' members'}
          </span>
          <span className="font-mono text-[11px] text-ink-faint" title="ticket key prefix">
            {org.key}-1, {org.key}-2, …
          </span>

          {/* A platform admin looking in has no membership to leave. */}
          {org.myRole !== null && (
            <button
              onClick={() => setLeaveOpen(true)}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <LogOut className="h-3 w-3" />
              Leave
            </button>
          )}
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <SprintColumn slug={org.slug} canCreate={isAssigner} />
        <OrgSidePanel
          slug={org.slug}
          isAssigner={isAssigner}
          currentUserId={currentUser?.id}
        />
      </div>

      {/*
        Leaving is confirmed rather than immediate, and blocked outright for the
        last assigner: an org with no assigner can never approve a member, create
        a sprint or delete a ticket again, and nobody left inside it can fix that.
      */}
      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title={isOnlyAssigner ? 'Transfer ownership first' : `Leave ${org.name}?`}
        description={
          isOnlyAssigner
            ? 'You are the only assigner in this organisation.'
            : 'You can ask to rejoin, but an assigner has to approve it.'
        }
      >
        <div className="px-6 py-6">
          {isOnlyAssigner ? (
            <div className="flex gap-3 rounded-xl border border-high/25 bg-high/[0.06] p-4 text-sm">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-high" />
              <div className="min-w-0">
                <p className="text-ink">
                  Promote another member to <span className="font-medium">assigner</span> before you
                  leave.
                </p>
                <p className="mt-2 text-ink-soft">
                  Without one, nobody could approve members, create sprints or delete tickets — and
                  no one inside {org.name} would be able to put that right.
                </p>
                <p className="mt-2 text-ink-faint">
                  Open <span className="font-medium text-ink-soft">Members</span> beside this list,
                  then choose <span className="font-medium text-ink-soft">Make assigner</span> on
                  the person taking over.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 rounded-xl border border-danger/25 bg-danger/[0.06] p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <div className="min-w-0">
                <p className="text-ink">
                  You will lose access to every board in{' '}
                  <span className="font-medium">{org.name}</span>.
                </p>
                <p className="mt-2 text-ink-soft">
                  Tickets you created and comments you wrote stay where they are — the history is
                  the organisation's, not yours.
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setLeaveOpen(false)}>
              {isOnlyAssigner ? 'Close' : 'Stay'}
            </Button>
            {!isOnlyAssigner && (
              <Button
                variant="danger"
                loading={leaveOrg.isPending}
                onClick={async () => {
                  await leaveOrg.mutateAsync(org.slug);
                  setLeaveOpen(false);
                  router.push('/dashboard/organizations');
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                Leave organisation
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * The rolling month window: this month plus the next two.
 *
 * Fetching it is what CREATES those cycles server-side, so nothing needs setting
 * up before an organisation has months to plan in.
 */
function SprintColumn({ slug, canCreate }: { slug: string; canCreate: boolean }) {
  const { data: cycles, isLoading, isError, refetch } = useCycles(slug);

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <CalendarRange className="h-3.5 w-3.5 text-ink-faint" />
        <h2 className="text-sm font-medium text-ink">Sprints</h2>
        <span className="text-[11px] text-ink-faint">this month and the next two</span>
      </header>

      <div className="p-4">
        {isLoading ? (
          <div className="space-y-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Couldn’t load this month’s sprints"
            message="The API didn’t respond as expected."
            onRetry={() => refetch()}
          />
        ) : (
          <div className="space-y-5">
            {cycles?.map((cycle, index) => (
              <CycleBlock
                key={cycle.id}
                orgSlug={slug}
                cycle={cycle}
                // The window always starts at the current month.
                isCurrent={index === 0}
                canCreate={canCreate}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
