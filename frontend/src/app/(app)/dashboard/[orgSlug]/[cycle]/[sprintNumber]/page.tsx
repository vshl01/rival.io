'use client';

import { AlertTriangle, ArrowLeft, CalendarDays, Trash2, UserCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cycleLabel } from '@/components/sprints/cycle-block';
import { TicketBoard } from '@/components/tickets/ticket-board';
import { Button } from '@/components/ui/button';
import { ErrorState, Skeleton } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import { useOrg } from '@/hooks/use-orgs';
import { useDeleteSprint, useSprint } from '@/hooks/use-sprints';
import { ApiError } from '@/lib/api';
import { formatDue } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * One sprint: /dashboard/{org}/{cycle}/{number}
 *
 * The header is deliberately one dense block — breadcrumb, then identity with the
 * schedule and lead as inline metadata rather than cards. A board needs its
 * vertical space for tickets, so the sprint's own details never exceed two lines.
 */
export default function SprintPage() {
  const { orgSlug, cycle, sprintNumber } = useParams<{
    orgSlug: string;
    cycle: string;
    sprintNumber: string;
  }>();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const number = Number(sprintNumber);
  const { data: org } = useOrg(orgSlug ?? null);
  const { data: sprint, isLoading, error } = useSprint(orgSlug ?? null, cycle ?? null, number);
  const deleteSprint = useDeleteSprint(orgSlug, cycle);

  const isAssigner = org?.myRole === 'ASSIGNER';
  const orgHref = `/dashboard/${orgSlug}`;

  if (isLoading) {
    return (
      <div className="w-full space-y-3 px-4 py-5 sm:px-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
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
          <Button variant="secondary" size="sm" onClick={() => router.push(orgHref)}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {org?.name ?? 'the organisation'}
          </Button>
        </div>
      </div>
    );
  }

  if (!sprint) return null;

  const due = formatDue(sprint.deadline);
  const short = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    /*
      Full-bleed, unlike every other page: a board is a workspace, not an
      article, so the 1240px reading measure of `container-page` would leave
      columns squeezed in the middle of a wide screen with dead space either
      side. Only the gutter is kept.
    */
    <div className="w-full px-4 pb-6 sm:px-6">
      {/*
        Sticky beneath the h-16 app nav so the sprint's identity and actions stay
        reachable while the board scrolls. The negative margin lets the blurred
        background span the full width while the content keeps its gutter.
      */}
      <header className="sticky top-16 z-20 -mx-4 mb-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          <Link href={orgHref} className="transition-colors hover:text-ink">
            {org?.name ?? orgSlug}
          </Link>
          <span aria-hidden>/</span>
          <span>{cycleLabel(cycle)}</span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="rounded border border-line bg-elevated px-1.5 py-0.5 font-mono text-[11px] leading-none text-ink-soft">
            #{sprint.number}
          </span>
          <h1 className="truncate font-display text-2xl leading-none text-ink">{sprint.name}</h1>

          {/* Schedule and lead as metadata, not as three full-width cards. */}
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
            <CalendarDays className="h-3 w-3" />
            {short(sprint.startsAt)} – {short(sprint.deadline)}
          </span>
          {due && (
            <span
              className={cn(
                'text-[11px]',
                due.overdue ? 'font-medium text-danger' : 'text-ink-faint',
              )}
            >
              {due.overdue ? 'overdue' : `due ${due.label}`}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1 text-[11px] text-ink-faint"
            title={sprint.assigner.email}
          >
            <UserCircle2 className="h-3 w-3" />
            {sprint.assigner.name}
          </span>

          {isAssigner && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-ink-faint transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="h-3 w-3" />
              Delete sprint
            </button>
          )}
        </div>
      </header>

      <TicketBoard
        orgSlug={orgSlug}
        cycle={cycle}
        sprint={sprint.number}
        sprintId={sprint.id}
        canDelete={isAssigner}
      />

      {/*
        Deleting a sprint takes its tickets with it (ON DELETE CASCADE) and the
        number is never reissued, so this is the one action on the page that
        cannot be walked back — it gets an explicit confirmation naming exactly
        what is about to go.
      */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this sprint?"
        description="This cannot be undone."
      >
        <div className="px-6 py-6">
          <div className="flex gap-3 rounded-xl border border-danger/25 bg-danger/[0.06] p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <div className="min-w-0 text-sm">
              <p className="text-ink">
                You are deleting{' '}
                <span className="font-medium">
                  #{sprint.number} — {sprint.name}
                </span>
                , which runs {short(sprint.startsAt)} – {short(sprint.deadline)} in{' '}
                {cycleLabel(cycle)}.
              </p>
              <p className="mt-2 text-ink-soft">
                Every ticket on its board is deleted with it, and sprint #{sprint.number} is
                never reissued in {cycleLabel(cycle)}.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep sprint
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                // Fire and leave: the sprint is already off its month block, and
                // staying here would only show a board that no longer exists.
                deleteSprint.mutate(sprint.number);
                setConfirmDelete(false);
                router.push(orgHref);
              }}
            >
              Delete sprint
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
