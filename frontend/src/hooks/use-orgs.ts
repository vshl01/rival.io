'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, type CreateOrgPayload } from '@/lib/api';
import type { JoinRequest, JoinStatus, OrgMember, OrgRole } from '@/lib/types';
import { notificationKeys } from './use-notifications';

/* ── Query keys ─────────────────────────────────────────────── */
export const orgKeys = {
  all: ['orgs'] as const,
  mine: () => [...orgKeys.all, 'mine'] as const,
  detail: (slug: string) => [...orgKeys.all, 'detail', slug] as const,
  directory: (q: string) => [...orgKeys.all, 'directory', q] as const,
  members: (slug: string) => [...orgKeys.all, 'members', slug] as const,
  joinRequests: (slug: string, status: JoinStatus) =>
    [...orgKeys.all, 'join-requests', slug, status] as const,
  myJoinRequests: () => [...orgKeys.all, 'my-join-requests'] as const,
};

/** Surface the backend's message rather than a generic failure. */
const showError = (err: unknown, fallback: string) =>
  toast.error(err instanceof ApiError ? err.message : fallback);

/* ── Queries ────────────────────────────────────────────────── */
export function useMyOrgs() {
  return useQuery({ queryKey: orgKeys.mine(), queryFn: api.orgs.listMine });
}

export function useOrg(slug: string | null) {
  return useQuery({
    queryKey: orgKeys.detail(slug ?? ''),
    queryFn: () => api.orgs.get(slug as string),
    enabled: !!slug,
    // A 403 means "not a member" — retrying cannot change that.
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
  });
}

export function useOrgDirectory(search: string) {
  return useQuery({
    queryKey: orgKeys.directory(search),
    queryFn: () => api.orgs.directory({ q: search || undefined }),
    placeholderData: keepPreviousData, // no flicker while typing
  });
}

export function useOrgMembers(slug: string | null) {
  return useQuery({
    queryKey: orgKeys.members(slug ?? ''),
    queryFn: () => api.orgs.members(slug as string),
    enabled: !!slug,
  });
}

export function useJoinRequests(slug: string | null, status: JoinStatus = 'PENDING') {
  return useQuery({
    queryKey: orgKeys.joinRequests(slug ?? '', status),
    queryFn: () => api.orgs.joinRequests(slug as string, status),
    enabled: !!slug,
  });
}

export function useMyJoinRequests() {
  return useQuery({ queryKey: orgKeys.myJoinRequests(), queryFn: api.users.myJoinRequests });
}

/* ── Mutations ──────────────────────────────────────────────── */
export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrgPayload) => api.orgs.create(payload),
    onSuccess: (org) => {
      qc.invalidateQueries({ queryKey: orgKeys.mine() });
      // It leaves the directory the moment you belong to it.
      qc.invalidateQueries({ queryKey: [...orgKeys.all, 'directory'] });
      toast.success(`${org.name} created — you're its assigner`);
    },
    onError: (err) => showError(err, 'Could not create the organisation'),
  });
}

export function useRenameOrg(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.orgs.rename(slug, name),
    onSuccess: (org) => {
      qc.setQueryData(orgKeys.detail(slug), org);
      qc.invalidateQueries({ queryKey: orgKeys.mine() });
      toast.success('Organisation renamed');
    },
    onError: (err) => showError(err, 'Could not rename the organisation'),
  });
}

export function useRequestToJoin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, message }: { slug: string; message?: string }) =>
      api.orgs.requestToJoin(slug, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...orgKeys.all, 'directory'] });
      qc.invalidateQueries({ queryKey: orgKeys.myJoinRequests() });
      toast.success('Request sent — an assigner will review it');
    },
    onError: (err) => showError(err, 'Could not send the request'),
  });
}

/**
 * Accept or reject, with the row gone from the queue on click.
 *
 * A pending request is a decision the assigner has just made in their head; the
 * list has to agree at once or they click twice. The roster it adds to is left to
 * the refetch — inventing a membership row locally would mean guessing the id and
 * join date the server is about to assign.
 */
export function useDecideJoinRequest(slug: string) {
  const qc = useQueryClient();
  const pendingKey = orgKeys.joinRequests(slug, 'PENDING');

  return useMutation({
    mutationFn: ({ requestId, accept }: { requestId: string; accept: boolean }) =>
      api.orgs.decideJoinRequest(slug, requestId, accept),
    onMutate: async ({ requestId }) => {
      await qc.cancelQueries({ queryKey: pendingKey });
      const previous = qc.getQueryData<JoinRequest[]>(pendingKey);
      qc.setQueryData<JoinRequest[]>(pendingKey, (rows) =>
        rows?.filter((r) => r.id !== requestId),
      );
      return { previous };
    },
    onSuccess: (_data, { accept }) => toast.success(accept ? 'Request accepted' : 'Request rejected'),
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(pendingKey, ctx.previous);
      showError(err, 'Could not save that decision');
    },
    onSettled: () => {
      // Accepting changes the roster and the member count on the org header.
      qc.invalidateQueries({ queryKey: [...orgKeys.all, 'join-requests', slug] });
      qc.invalidateQueries({ queryKey: orgKeys.members(slug) });
      qc.invalidateQueries({ queryKey: orgKeys.detail(slug) });
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/** Promote or demote, with the badge changing on click. */
export function useSetMemberRole(slug: string) {
  const qc = useQueryClient();
  const membersKey = orgKeys.members(slug);

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      api.orgs.setMemberRole(slug, userId, role),
    onMutate: async ({ userId, role }) => {
      await qc.cancelQueries({ queryKey: membersKey });
      const previous = qc.getQueryData<OrgMember[]>(membersKey);
      qc.setQueryData<OrgMember[]>(membersKey, (members) =>
        members?.map((m) => (m.user.id === userId ? { ...m, role } : m)),
      );
      return { previous };
    },
    onSuccess: (_data, { role }) =>
      toast.success(role === 'ASSIGNER' ? 'Promoted to assigner' : 'Changed to worker'),
    // The common failure is the last-assigner rule (409) — its message is the
    // actual instruction, so it must reach the user verbatim. The badge snaps
    // back at the same time, so the refusal is unmistakable.
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(membersKey, ctx.previous);
      showError(err, 'Could not change that role');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: membersKey });
      qc.invalidateQueries({ queryKey: orgKeys.detail(slug) });
    },
  });
}

export function useRemoveMember(slug: string) {
  const qc = useQueryClient();
  const membersKey = orgKeys.members(slug);

  return useMutation({
    mutationFn: (userId: string) => api.orgs.removeMember(slug, userId),
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: membersKey });
      const previous = qc.getQueryData<OrgMember[]>(membersKey);
      qc.setQueryData<OrgMember[]>(membersKey, (members) =>
        members?.filter((m) => m.user.id !== userId),
      );
      return { previous };
    },
    onSuccess: () => toast.success('Member removed'),
    onError: (err, _userId, ctx) => {
      if (ctx?.previous) qc.setQueryData(membersKey, ctx.previous);
      showError(err, 'Could not remove that member — they are back');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: membersKey });
      qc.invalidateQueries({ queryKey: orgKeys.detail(slug) });
    },
  });
}

export function useLeaveOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.orgs.leave(slug),
    onSuccess: (_data, slug) => {
      qc.removeQueries({ queryKey: orgKeys.detail(slug) });
      qc.invalidateQueries({ queryKey: orgKeys.mine() });
      qc.invalidateQueries({ queryKey: [...orgKeys.all, 'directory'] });
      toast.success('You left the organisation');
    },
    onError: (err) => showError(err, 'Could not leave the organisation'),
  });
}
