// Shared domain types — mirror the backend API contract.

export type Role = 'USER' | 'ADMIN';
export type TaskStatus =
  | 'SCOPING'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'DONE'
  | 'REMOVED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type SortField = 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  attachments?: Attachment[];
  _count?: { attachments: number; activities: number; comments: number };
  /**
   * Set only for a sprint ticket. `null` on a personal task — that difference is
   * what distinguishes the two kinds (docs/architecture.md §1).
   */
  key?: string | null;
  assignee?: Person | null;
  sprint?: { id: string; number: number; name: string } | null;
}

export interface Comment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; email: string; role: Role } | null;
}

export interface Activity {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: Priority;
  search?: string;
  ownerId?: string;
  sortBy: SortField;
  sortOrder: SortOrder;
  page: number;
  pageSize: number;
}

export interface AdminUser extends User {
  /** Personal tasks and org tickets both live in `tickets`. */
  _count: { tickets: number };
}

/* ── Collaboration: organisations, membership, notifications ──────────────────
 * Mirrors backend/prisma/schema.prisma. See docs/architecture.md for the rules
 * these shapes encode (per-org roles, the assigner/worker split).
 * -------------------------------------------------------------------------- */

/** Role *within one organisation* — unrelated to the platform-level `Role`. */
export type OrgRole = 'ASSIGNER' | 'WORKER';

export type JoinStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/** Minimal person shape returned alongside memberships and requests. */
export interface Person {
  id: string;
  name: string;
  email: string;
}

export interface Organization {
  id: string;
  name: string;
  /** URL segment — /dashboard/acme */
  slug: string;
  /** Ticket key prefix — ACME-142 */
  key: string;
  createdAt: string;
  createdById: string;
  _count: { memberships: number; sprints: number };
  /** The caller's role. `null` when a platform admin is looking in. */
  myRole: OrgRole | null;
}

/** A directory row: an org the caller is *not* in. */
export interface DirectoryOrganization {
  id: string;
  name: string;
  slug: string;
  key: string;
  createdAt: string;
  _count: { memberships: number };
  /** The caller's own open request, so the UI can show "Requested". */
  pendingRequest: { id: string; createdAt: string } | null;
}

export interface OrgMember {
  id: string;
  role: OrgRole;
  joinedAt: string;
  user: Person;
}

export interface JoinRequest {
  id: string;
  status: JoinStatus;
  message: string | null;
  createdAt: string;
  decidedAt: string | null;
  user: Person;
  decidedBy: Person | null;
}

/** The caller's own request, which carries the org instead of the applicant. */
export interface MyJoinRequest {
  id: string;
  status: JoinStatus;
  message: string | null;
  createdAt: string;
  decidedAt: string | null;
  org: { id: string; name: string; slug: string; key: string };
}

export type NotificationType =
  | 'join_request.received'
  | 'join_request.accepted'
  | 'join_request.rejected'
  | 'member.role_changed'
  | 'member.removed';

export interface AppNotification {
  id: string;
  type: NotificationType;
  /** Shape varies by `type`; enough to render a line without another fetch. */
  payload: {
    orgSlug?: string;
    orgName?: string;
    requestId?: string;
    applicant?: Person;
    message?: string | null;
    role?: OrgRole;
  } | null;
  readAt: string | null;
  createdAt: string;
}

/* ── Cycles and sprints ───────────────────────────────────────────────────────
 * A cycle is one calendar month, addressed by its `YYYY-MM` key rather than an
 * id so URLs stay readable: /dashboard/acme/2026-07/3
 * -------------------------------------------------------------------------- */

export interface Sprint {
  id: string;
  /** Human-readable, unique within its cycle — the number in the URL. */
  number: number;
  name: string;
  startsAt: string;
  deadline: string;
  createdAt: string;
  /** Whoever created it, and therefore leads it. Always an assigner. */
  assigner: Person;
}

/** A sprint fetched on its own also carries which month it belongs to. */
export interface SprintDetail extends Sprint {
  updatedAt: string;
  cycle: string;
}

export interface Cycle {
  id: string;
  /** `2026-07` — the canonical key used in URLs and API paths. */
  cycle: string;
  year: number;
  /** 1..12 */
  month: number;
  sprints: Sprint[];
}
