'use client';

import { MoreHorizontal, ShieldCheck, UserMinus, Users, Wrench } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/tickets/assignee-stack';
import { Skeleton } from '@/components/ui/feedback';
import { useOrgMembers, useRemoveMember, useSetMemberRole } from '@/hooks/use-orgs';
import { formatRelative } from '@/lib/format';
import type { OrgMember, OrgRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { OrgRoleBadge } from './org-role-badge';

interface MemberListProps {
  slug: string;
  /** Only assigners get the management menu. */
  canManage: boolean;
  /** The signed-in user, so their own row can be marked and self-removal hidden. */
  currentUserId: string | undefined;
}

export function MemberList({ slug, canManage, currentUserId }: MemberListProps) {
  const { data: members, isLoading } = useOrgMembers(slug);

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!members?.length) return null;

  // No card chrome: this lives inside the workspace's side panel, which owns it.
  return (
    <ul className="divide-y divide-line">
      {members.map((member) => (
        <MemberRow
          key={member.id}
          slug={slug}
          member={member}
          canManage={canManage}
          isSelf={member.user.id === currentUserId}
          assignerCount={members.filter((m) => m.role === 'ASSIGNER').length}
        />
      ))}
    </ul>
  );
}

interface MemberRowProps {
  slug: string;
  member: OrgMember;
  canManage: boolean;
  isSelf: boolean;
  assignerCount: number;
}

function MemberRow({ slug, member, canManage, isSelf, assignerCount }: MemberRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const setRole = useSetMemberRole(slug);
  const removeMember = useRemoveMember(slug);

  /**
   * The backend rejects demoting or removing the last assigner with a 409. The
   * UI disables those actions ahead of time so the rule is discoverable rather
   * than only being learnt by hitting an error.
   */
  const isLastAssigner = member.role === 'ASSIGNER' && assignerCount === 1;
  const nextRole: OrgRole = member.role === 'ASSIGNER' ? 'WORKER' : 'ASSIGNER';
  const busy = setRole.isPending || removeMember.isPending;

  const act = (fn: () => void) => {
    setMenuOpen(false);
    fn();
  };

  return (
    <li className="flex items-center justify-between gap-2 px-1 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar person={member.user} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {member.user.name}
            {isSelf && <span className="ml-1.5 text-xs font-normal text-ink-faint">(you)</span>}
          </p>
          {/* Joined date moves into the tooltip: the panel is narrow, and the
              email is the identifying detail worth the line. */}
          <p
            className="truncate text-xs text-ink-faint"
            title={`joined ${formatRelative(member.joinedAt)}`}
          >
            {member.user.email}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <OrgRoleBadge role={member.role} />

        {canManage && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              disabled={busy}
              aria-label={`Manage ${member.user.name}`}
              aria-expanded={menuOpen}
              className="rounded-lg p-1 text-ink-faint transition-colors hover:bg-elevated hover:text-ink disabled:opacity-40"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>

            {menuOpen && (
              <>
                {/* Click-away layer, below the menu but above the page. */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lift">
                  <MenuItem
                    icon={nextRole === 'ASSIGNER' ? ShieldCheck : Wrench}
                    disabled={isLastAssigner}
                    hint={isLastAssigner ? 'Promote someone else first' : undefined}
                    onClick={() => act(() => setRole.mutate({ userId: member.user.id, role: nextRole }))}
                  >
                    {nextRole === 'ASSIGNER' ? 'Make assigner' : 'Change to worker'}
                  </MenuItem>

                  {!isSelf && (
                    <MenuItem
                      icon={UserMinus}
                      danger
                      disabled={isLastAssigner}
                      hint={isLastAssigner ? 'The only assigner cannot be removed' : undefined}
                      onClick={() => act(() => removeMember.mutate(member.user.id))}
                    >
                      Remove from organisation
                    </MenuItem>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

interface MenuItemProps {
  icon: typeof Users;
  children: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Explains *why* an item is disabled — otherwise it reads as a bug. */
  hint?: string;
}

function MenuItem({ icon: Icon, children, onClick, danger, disabled, hint }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={cn(
        'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors',
        disabled
          ? 'cursor-not-allowed text-ink-faint'
          : danger
            ? 'text-danger hover:bg-danger/10'
            : 'text-ink-soft hover:bg-elevated hover:text-ink',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0">
        {children}
        {disabled && hint && <span className="mt-0.5 block text-[11px] leading-tight">{hint}</span>}
      </span>
    </button>
  );
}
