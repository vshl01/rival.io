'use client';

import { Check, Inbox, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { useDecideJoinRequest, useJoinRequests } from '@/hooks/use-orgs';
import { formatRelative } from '@/lib/format';

/**
 * Pending requests awaiting an assigner's decision.
 *
 * Assigner-only: the API returns 403 for anyone else, so this is never rendered
 * without `canManage` from the parent.
 */
export function JoinRequestList({ slug }: { slug: string }) {
  const { data: requests, isLoading } = useJoinRequests(slug, 'PENDING');
  const decide = useDecideJoinRequest(slug);

  if (isLoading) return <Skeleton className="h-[86px] w-full rounded-2xl" />;

  if (!requests?.length) {
    return (
      <EmptyState
        icon={<Inbox className="h-6 w-6" />}
        title="No pending requests"
        description="When someone asks to join, they'll appear here for you to approve."
        className="rounded-2xl border border-line bg-surface py-12"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {requests.map((request) => {
        // Track pending state per row so one decision does not spin every button.
        const busy = decide.isPending && decide.variables?.requestId === request.id;

        return (
          <li
            key={request.id}
            className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{request.user.name}</p>
              <p className="truncate text-xs text-ink-faint">{request.user.email}</p>
              {request.message && (
                <p className="mt-2 border-l-2 border-line pl-2.5 text-sm italic text-ink-soft">
                  “{request.message}”
                </p>
              )}
              <p className="mt-1.5 text-[11px] text-ink-faint">
                asked {formatRelative(request.createdAt)}
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                loading={busy}
                onClick={() => decide.mutate({ requestId: request.id, accept: true })}
              >
                <Check className="h-3.5 w-3.5" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => decide.mutate({ requestId: request.id, accept: false })}
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
