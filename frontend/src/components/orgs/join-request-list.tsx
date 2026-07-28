'use client';

import { Check, Inbox, X } from 'lucide-react';
import { Avatar } from '@/components/tickets/assignee-stack';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { useDecideJoinRequest, useJoinRequests } from '@/hooks/use-orgs';
import { formatRelative } from '@/lib/format';

/**
 * Pending requests awaiting an assigner's decision.
 *
 * Assigner-only: the API returns 403 for anyone else, so this is never rendered
 * without `canManage` from the parent. Sized for the workspace's side column —
 * no card chrome of its own, since the panel already provides it.
 */
export function JoinRequestList({ slug }: { slug: string }) {
  const { data: requests, isLoading } = useJoinRequests(slug, 'PENDING');
  const decide = useDecideJoinRequest(slug);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!requests?.length) {
    return (
      <EmptyState
        icon={<Inbox className="h-5 w-5" />}
        title="Nothing waiting"
        description="Requests to join land here for you to approve."
        className="py-10"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {requests.map((request) => {
        // Track pending state per row so one decision does not spin every button.
        const busy = decide.isPending && decide.variables?.requestId === request.id;

        return (
          <li key={request.id} className="rounded-xl border border-line bg-canvas px-3 py-3">
            <div className="flex items-start gap-2.5">
              <Avatar person={request.user} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{request.user.name}</p>
                <p className="truncate text-xs text-ink-faint">{request.user.email}</p>
              </div>
              <span className="shrink-0 text-[11px] text-ink-faint">
                {formatRelative(request.createdAt)}
              </span>
            </div>

            {request.message && (
              <p className="mt-2 border-l-2 border-line pl-2.5 text-xs italic leading-relaxed text-ink-soft">
                “{request.message}”
              </p>
            )}

            <div className="mt-2.5 flex gap-2">
              <Button
                size="sm"
                className="flex-1"
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
