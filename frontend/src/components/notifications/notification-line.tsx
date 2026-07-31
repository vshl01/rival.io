import { Bell, ShieldCheck, UserMinus, UserPlus, X } from 'lucide-react';
import type { AppNotification } from '@/lib/types';

/**
 * Turns a notification into a sentence plus an icon.
 *
 * The payload is denormalised by the backend precisely so this can render
 * without another fetch — but every field is optional, because a notification
 * written by an older build may lack one. Hence the fallbacks throughout.
 */
export function describeNotification(notification: AppNotification): {
  icon: typeof Bell;
  tone: string;
  title: string;
  detail?: string;
  href?: string;
} {
  const { type, payload } = notification;
  const org = payload?.orgName ?? 'an organisation';
  const orgHref = payload?.orgSlug ? `/dashboard/${payload.orgSlug}` : undefined;

  switch (type) {
    case 'join_request.received':
      return {
        icon: UserPlus,
        tone: 'text-accent',
        title: `${payload?.applicant?.name ?? 'Someone'} asked to join ${org}`,
        detail: payload?.message ?? undefined,
        href: orgHref,
      };
    case 'join_request.accepted':
      return {
        icon: ShieldCheck,
        tone: 'text-accent',
        title: `You joined ${org}`,
        detail: 'Your request was accepted.',
        href: orgHref,
      };
    case 'join_request.rejected':
      return {
        icon: X,
        tone: 'text-ink-faint',
        title: `Your request to join ${org} was declined`,
      };
    case 'member.role_changed':
      return {
        icon: ShieldCheck,
        tone: 'text-accent',
        title:
          payload?.role === 'ASSIGNER'
            ? `You're now an assigner in ${org}`
            : `Your role in ${org} changed to worker`,
        href: orgHref,
      };
    case 'member.removed':
      return {
        icon: UserMinus,
        tone: 'text-danger',
        title: `You were removed from ${org}`,
      };
    default:
      // Unknown type from a newer backend — show something rather than nothing.
      return { icon: Bell, tone: 'text-ink-faint', title: 'You have a new notification' };
  }
}
