'use client';

import { Check, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { useDebounce } from '@/hooks/use-debounce';
import { useOrgDirectory, useRequestToJoin } from '@/hooks/use-orgs';
import { formatRelative } from '@/lib/format';
import type { DirectoryOrganization } from '@/lib/types';

/**
 * Organisations the caller does not belong to, with a request-to-join action.
 *
 * Each row already carries the caller's own pending request from the API, so
 * "Requested" renders without a second query.
 */
export function OrgDirectory() {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 250);
  const { data, isLoading } = useOrgDirectory(debounced);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search organisations by name"
          className="pl-10"
          aria-label="Search organisations"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[74px] w-full rounded-2xl" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title={debounced ? 'No matches' : 'Nothing to join yet'}
          description={
            debounced
              ? `No organisation matches “${debounced}”.`
              : 'Every organisation already has you as a member — or none exist yet.'
          }
        />
      ) : (
        <ul className="space-y-2">
          {data.items.map((org) => (
            <DirectoryRow key={org.id} org={org} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DirectoryRow({ org }: { org: DirectoryOrganization }) {
  const requestToJoin = useRequestToJoin();
  const requested = org.pendingRequest !== null;

  return (
    <li className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{org.name}</p>
        <p className="mt-0.5 flex items-center gap-3 text-xs text-ink-faint">
          <span className="font-mono">{org.key}</span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {org._count.memberships}
          </span>
        </p>
      </div>

      {requested ? (
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-elevated px-3 py-1.5 text-xs text-ink-soft"
          title={`Requested ${formatRelative(org.pendingRequest!.createdAt)}`}
        >
          <Check className="h-3 w-3" />
          Requested
        </span>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0"
          loading={requestToJoin.isPending && requestToJoin.variables?.slug === org.slug}
          onClick={() => requestToJoin.mutate({ slug: org.slug })}
        >
          Ask to join
        </Button>
      )}
    </li>
  );
}
