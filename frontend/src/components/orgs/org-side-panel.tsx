'use client';

import { Inbox, Users } from 'lucide-react';
import { useState } from 'react';
import { JoinRequestList } from '@/components/orgs/join-request-list';
import { MemberList } from '@/components/orgs/member-list';
import { useJoinRequests, useOrgMembers } from '@/hooks/use-orgs';
import { cn } from '@/lib/utils';

type Panel = 'requests' | 'members';

interface OrgSidePanelProps {
  slug: string;
  /** Assigners decide join requests; workers have no queue to see. */
  isAssigner: boolean;
  currentUserId: string | undefined;
}

/**
 * The right-hand column of an organisation: roster and approvals, one at a time.
 *
 * Sprints are what the page is *for*, so they keep the wide column permanently.
 * Membership matters in bursts — you approve someone, or you check who is here —
 * and stacking both underneath pushed the sprints off the screen. Tabs keep them
 * one click away without ever competing for the same vertical space.
 *
 * A worker sees only the roster: the requests endpoint is assigner-only (403), so
 * a tab they cannot use would be a dead control.
 */
export function OrgSidePanel({ slug, isAssigner, currentUserId }: OrgSidePanelProps) {
  // Requests first for an assigner — it is the panel with work in it.
  const [panel, setPanel] = useState<Panel>(isAssigner ? 'requests' : 'members');

  const { data: requests } = useJoinRequests(isAssigner ? slug : null, 'PENDING');
  const { data: members } = useOrgMembers(slug);

  const pending = requests?.length ?? 0;
  const active = isAssigner ? panel : 'members';

  return (
    <aside
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-line bg-surface',
        /*
          Sticks beside the sprint column and scrolls internally, so a long roster
          never drags the page past the months. The offset clears the h-16 app nav
          plus the org's own sticky header (~4.25rem) — sitting any higher would
          slide the panel's tabs under that header's blur.
        */
        'lg:sticky lg:top-[8.5rem] lg:max-h-[calc(100vh-10rem)]',
      )}
    >
      {isAssigner ? (
        <div className="flex shrink-0 items-center gap-1 border-b border-line p-1.5">
          <Tab
            active={active === 'requests'}
            onClick={() => setPanel('requests')}
            icon={<Inbox className="h-3.5 w-3.5" />}
            label="Requests"
            count={pending}
            // Pending approvals are somebody waiting, so the count is loud.
            emphasise
          />
          <Tab
            active={active === 'members'}
            onClick={() => setPanel('members')}
            icon={<Users className="h-3.5 w-3.5" />}
            label="Members"
            count={members?.length ?? 0}
          />
        </div>
      ) : (
        <header className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3">
          <Users className="h-3.5 w-3.5 text-ink-faint" />
          <h2 className="text-sm font-medium text-ink">Members</h2>
          <span className="text-xs text-ink-faint">{members?.length ?? 0}</span>
        </header>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {active === 'requests' ? (
          <JoinRequestList slug={slug} />
        ) : (
          <>
            <MemberList slug={slug} canManage={isAssigner} currentUserId={currentUserId} />
            {isAssigner && (
              <p className="mt-3 px-1 text-[11px] leading-relaxed text-ink-faint">
                Assigners create sprints, approve members and delete tickets. Workers create and
                update tickets.
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

interface TabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
  emphasise?: boolean;
}

function Tab({ active, onClick, icon, label, count, emphasise }: TabProps) {
  return (
    <button
      onClick={onClick}
      aria-current={active}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors',
        active ? 'bg-elevated text-ink' : 'text-ink-faint hover:text-ink',
      )}
    >
      {icon}
      {label}
      {count > 0 && (
        <span
          className={cn(
            'rounded-full px-1.5 text-[11px] leading-4 tabular-nums',
            emphasise ? 'bg-accent/15 text-accent' : 'bg-elevated text-ink-faint',
            emphasise && active && 'bg-accent text-accent-ink',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
