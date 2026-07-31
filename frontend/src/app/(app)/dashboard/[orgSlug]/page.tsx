'use client';

import { ArrowLeft, CalendarRange, LogOut, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { JoinRequestList } from '@/components/orgs/join-request-list';
import { MemberList } from '@/components/orgs/member-list';
import { OrgRoleBadge } from '@/components/orgs/org-role-badge';
import { CycleBlock } from '@/components/sprints/cycle-block';
import { Button } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { useJoinRequests, useLeaveOrg, useOrg } from '@/hooks/use-orgs';
import { useCycles } from '@/hooks/use-sprints';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';

/**
 * An organisation's workspace.
 *
 * Cycles and sprints (the month blocks) arrive in build step 3 — until then this
 * covers everything that actually exists: who is in the org, their roles, and
 * the requests waiting on an assigner.
 */
export default function OrgWorkspacePage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const currentUser = useAuth((s) => s.user);
  const { data: org, isLoading, error } = useOrg(orgSlug ?? null);
  const leaveOrg = useLeaveOrg();

  const isAssigner = org?.myRole === 'ASSIGNER';

  if (isLoading) {
    return (
      <div className="container-page space-y-6 py-8">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
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
    <div className="container-page space-y-8 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/dashboard/organizations"
            className="mb-2 inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3 w-3" />
            Organisations
          </Link>
          <h1 className="truncate font-display text-4xl leading-none text-ink">{org.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <OrgRoleBadge role={org.myRole} />
            <span className="flex items-center gap-1.5 text-xs text-ink-faint">
              <Users className="h-3.5 w-3.5" />
              {org._count.memberships}
              {org._count.memberships === 1 ? ' member' : ' members'}
            </span>
            <span className="font-mono text-xs text-ink-faint">
              tickets: {org.key}-1, {org.key}-2, …
            </span>
          </div>
        </div>

        {/* A platform admin looking in has no membership to leave. */}
        {org.myRole !== null && (
          <Button
            variant="ghost"
            size="sm"
            loading={leaveOrg.isPending}
            onClick={async () => {
              await leaveOrg.mutateAsync(org.slug);
              router.push('/dashboard/organizations');
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Leave
          </Button>
        )}
      </header>

      <CycleWindow slug={org.slug} canCreate={isAssigner} />

      {isAssigner && (
        <section>
          <SectionHeading title="Join requests" slug={org.slug} />
          <JoinRequestList slug={org.slug} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-ink">Members</h2>
        <MemberList slug={org.slug} canManage={isAssigner} currentUserId={currentUser?.id} />
        {isAssigner && (
          <p className="mt-2.5 text-xs text-ink-faint">
            Assigners create sprints, approve members and delete tickets. Workers create and update
            tickets.
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * The rolling month window: this month plus the next two.
 *
 * Fetching it is what creates those cycles server-side, so nothing needs setting
 * up before an organisation has months to plan in.
 */
function CycleWindow({ slug, canCreate }: { slug: string; canCreate: boolean }) {
  const { data: cycles, isLoading, isError, refetch } = useCycles(slug);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn’t load this month’s sprints"
        message="The API didn’t respond as expected."
        onRetry={() => refetch()}
      />
    );
  }

  if (!cycles?.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <CalendarRange className="h-4 w-4 text-ink-faint" />
        Sprints
      </div>
      {cycles.map((cycle, index) => (
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
  );
}

/** Heading that carries a live pending count, so an assigner sees work waiting. */
function SectionHeading({ title, slug }: { title: string; slug: string }) {
  const { data: requests } = useJoinRequests(slug, 'PENDING');
  const count = requests?.length ?? 0;

  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
      {title}
      {count > 0 && (
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
          {count}
        </span>
      )}
    </h2>
  );
}
