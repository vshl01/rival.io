'use client';

import { ArrowLeft, CalendarDays, Trash2, UserCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { cycleLabel } from '@/components/sprints/cycle-block';
import { TicketBoard } from '@/components/tickets/ticket-board';
import { Button } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { useDeleteSprint, useSprint } from '@/hooks/use-sprints';
import { useOrg } from '@/hooks/use-orgs';
import { ApiError } from '@/lib/api';
import { formatDue, formatFullDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * One sprint: /dashboard/{org}/{cycle}/{number}
 *
 * Shows the sprint's schedule and who leads it, then its ticket board. Deleting
 * the sprint is assigner-only, matching the ticket rule.
 */
export default function SprintPage() {
  const { orgSlug, cycle, sprintNumber } = useParams<{
    orgSlug: string;
    cycle: string;
    sprintNumber: string;
  }>();
  const router = useRouter();

  const number = Number(sprintNumber);
  const { data: org } = useOrg(orgSlug ?? null);
  const { data: sprint, isLoading, error } = useSprint(orgSlug ?? null, cycle ?? null, number);
  const deleteSprint = useDeleteSprint(orgSlug, cycle);

  const isAssigner = org?.myRole === 'ASSIGNER';
  const orgHref = `/dashboard/${orgSlug}`;

  if (isLoading) {
    return (
      <div className="container-page space-y-6 py-8">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error instanceof ApiError) {
    const forbidden = error.status === 403;
    return (
      <div className="container-page py-8">
        <ErrorState
          title={forbidden ? 'You’re not a member of this organisation' : 'Sprint not found'}
          message={
            forbidden
              ? 'Ask an assigner for access to this workspace.'
              : `There is no sprint #${sprintNumber} in ${cycleLabel(cycle)}. It may have been deleted — sprint numbers are never reused.`
          }
        />
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => router.push(orgHref)}>
            <ArrowLeft className="h-4 w-4" />
            Back to {org?.name ?? 'the organisation'}
          </Button>
        </div>
      </div>
    );
  }

  if (!sprint) return null;

  const due = formatDue(sprint.deadline);

  return (
    <div className="container-page space-y-8 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <nav className="mb-2 flex items-center gap-1.5 text-xs text-ink-faint">
            <Link href={orgHref} className="transition-colors hover:text-ink">
              {org?.name ?? orgSlug}
            </Link>
            <span>/</span>
            <span>{cycleLabel(cycle)}</span>
          </nav>

          <div className="flex items-baseline gap-3">
            <span className="rounded-lg border border-line bg-elevated px-2 py-1 font-mono text-sm text-ink-soft">
              #{sprint.number}
            </span>
            <h1 className="truncate font-display text-4xl leading-none text-ink">{sprint.name}</h1>
          </div>
        </div>

        {isAssigner && (
          <Button
            variant="ghost"
            size="sm"
            loading={deleteSprint.isPending}
            onClick={async () => {
              await deleteSprint.mutateAsync(sprint.number);
              router.push(orgHref);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete sprint
          </Button>
        )}
      </header>

      <dl className="grid gap-4 sm:grid-cols-3">
        <Fact icon={CalendarDays} label="Starts" value={formatFullDate(sprint.startsAt)} />
        <Fact
          icon={CalendarDays}
          label="Deadline"
          value={formatFullDate(sprint.deadline)}
          hint={due ? `${due.overdue ? 'overdue' : 'due'} ${due.label}` : undefined}
          tone={due?.overdue ? 'text-danger' : undefined}
        />
        <Fact icon={UserCircle2} label="Led by" value={sprint.assigner.name} hint={sprint.assigner.email} />
      </dl>

      <TicketBoard orgSlug={orgSlug} cycle={cycle} sprint={sprint.number} canDelete={isAssigner} />
    </div>
  );
}

interface FactProps {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}

function Fact({ icon: Icon, label, value, hint, tone }: FactProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4">
      <dt className="flex items-center gap-1.5 text-xs text-ink-faint">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1.5 text-sm text-ink">{value}</dd>
      {hint && <dd className={cn('mt-0.5 text-xs text-ink-faint', tone)}>{hint}</dd>}
    </div>
  );
}
