import type {
  Activity,
  AdminUser,
  AppNotification,
  Attachment,
  Comment,
  Cycle,
  DirectoryOrganization,
  JoinRequest,
  JoinStatus,
  MyJoinRequest,
  OrgMember,
  OrgRole,
  Organization,
  PageMeta,
  SprintDetail,
  Task,
  TaskFilters,
  User,
} from "./types";

// Trailing slashes are stripped so a value like "https://host/" can't produce "//api".
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/+$/, "");
const BASE = `${API_URL}/api`;

/** A typed error carrying the backend's machine code and any field errors. */
export class ApiError extends Error {
  status: number;
  code: string;
  fieldErrors?: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

/* ── Token + lifecycle wiring (set by the auth store, no React import here) ── */
let accessToken: string | null = null;
let onRefreshed: (token: string, user: User) => void = () => {};
let onUnauthorized: () => void = () => {};

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const onTokenRefreshed = (fn: (token: string, user: User) => void) => {
  onRefreshed = fn;
};
export const onSessionExpired = (fn: () => void) => {
  onUnauthorized = fn;
};

interface ApiEnvelope<T> {
  data: T;
  meta?: PageMeta;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Internal: prevents infinite refresh loops. */
  _retry?: boolean;
  /** Skip the auto-refresh dance (used by the auth endpoints themselves). */
  skipAuthRefresh?: boolean;
}

async function parseError(res: Response): Promise<ApiError> {
  let code = "ERROR";
  let message = res.statusText || "Request failed";
  let fieldErrors: Record<string, string[]> | undefined;
  try {
    const body = await res.json();
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      fieldErrors = body.error.details?.fieldErrors;
    }
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, code, message, fieldErrors);
}

// De-dupe concurrent refreshes so a burst of 401s triggers a single round-trip.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) return false;
        const { data } = (await res.json()) as ApiEnvelope<{
          accessToken: string;
          user: User;
        }>;
        accessToken = data.accessToken;
        onRefreshed(data.accessToken, data.user);
        return true;
      } catch {
        return false;
      } finally {
        // Allow the next refresh after this one settles.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

async function request<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const { body, headers, _retry, skipAuthRefresh, ...rest } = opts;
  const isFormData = body instanceof FormData;

  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(isFormData
        ? {}
        : body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: isFormData
      ? (body as FormData)
      : body !== undefined
        ? JSON.stringify(body)
        : undefined,
  });

  // Transparently refresh once on an expired access token.
  if (res.status === 401 && !_retry && !skipAuthRefresh) {
    const ok = await refreshSession();
    if (ok) return request<T>(path, { ...opts, _retry: true });
    onUnauthorized();
    throw await parseError(res);
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return { data: undefined as T };
  return (await res.json()) as ApiEnvelope<T>;
}

/* ── Endpoint helpers ───────────────────────────────────────── */

function buildTaskQuery(f: Partial<TaskFilters>): string {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status);
  if (f.priority) p.set("priority", f.priority);
  if (f.search) p.set("search", f.search);
  if (f.ownerId) p.set("ownerId", f.ownerId);
  if (f.sortBy) p.set("sortBy", f.sortBy);
  if (f.sortOrder) p.set("sortOrder", f.sortOrder);
  if (f.page) p.set("page", String(f.page));
  if (f.pageSize) p.set("pageSize", String(f.pageSize));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export interface AuthResult {
  user: User;
  accessToken: string;
}

export type CreateTaskPayload = {
  title: string;
  description?: string | null;
  status?: Task["status"];
  priority?: Task["priority"];
  dueDate?: string | null;
};
export type UpdateTaskPayload = Partial<CreateTaskPayload>;

export type CreateOrgPayload = {
  name: string;
  /** Both are derived from `name` server-side when omitted. */
  slug?: string;
  key?: string;
};

export type CreateSprintPayload = {
  name: string;
  /** ISO strings. The deadline must be after the start. */
  startsAt: string;
  deadline: string;
};
export type UpdateSprintPayload = Partial<CreateSprintPayload>;

export const api = {
  auth: {
    signup: (input: { name: string; email: string; password: string }) =>
      request<AuthResult>("/auth/signup", {
        method: "POST",
        body: input,
        skipAuthRefresh: true,
      }).then((r) => r.data),
    login: (input: { email: string; password: string }) =>
      request<AuthResult>("/auth/login", {
        method: "POST",
        body: input,
        skipAuthRefresh: true,
      }).then((r) => r.data),
    logout: () =>
      request("/auth/logout", { method: "POST", skipAuthRefresh: true }),
    me: () => request<{ user: User }>("/auth/me").then((r) => r.data.user),
  },
  tasks: {
    list: (filters: Partial<TaskFilters>) =>
      request<Task[]>(`/tasks${buildTaskQuery(filters)}`).then((r) => ({
        items: r.data,
        meta: r.meta!,
      })),
    get: (id: string) => request<Task>(`/tasks/${id}`).then((r) => r.data),
    create: (payload: CreateTaskPayload) =>
      request<Task>("/tasks", { method: "POST", body: payload }).then(
        (r) => r.data,
      ),
    update: (id: string, payload: UpdateTaskPayload) =>
      request<Task>(`/tasks/${id}`, { method: "PATCH", body: payload }).then(
        (r) => r.data,
      ),
    remove: (id: string) =>
      request<{ id: string }>(`/tasks/${id}`, { method: "DELETE" }).then(
        (r) => r.data,
      ),
    activity: (id: string) =>
      request<Activity[]>(`/tasks/${id}/activity`).then((r) => r.data),
    addAttachment: (id: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return request<Attachment>(`/tasks/${id}/attachments`, {
        method: "POST",
        body: fd,
      }).then((r) => r.data);
    },
    removeAttachment: (taskId: string, attachmentId: string) =>
      request(`/tasks/${taskId}/attachments/${attachmentId}`, {
        method: "DELETE",
      }),
    comments: (id: string) =>
      request<Comment[]>(`/tasks/${id}/comments`).then((r) => r.data),
    addComment: (id: string, body: string) =>
      request<Comment>(`/tasks/${id}/comments`, {
        method: "POST",
        body: { body },
      }).then((r) => r.data),
    removeComment: (taskId: string, commentId: string) =>
      request(`/tasks/${taskId}/comments/${commentId}`, { method: "DELETE" }),
  },
  orgs: {
    /** Organisations the caller belongs to, each with `myRole`. */
    listMine: () => request<Organization[]>("/orgs").then((r) => r.data),
    get: (slug: string) =>
      request<Organization>(`/orgs/${slug}`).then((r) => r.data),
    create: (payload: CreateOrgPayload) =>
      request<Organization>("/orgs", { method: "POST", body: payload }).then(
        (r) => r.data,
      ),
    rename: (slug: string, name: string) =>
      request<Organization>(`/orgs/${slug}`, {
        method: "PATCH",
        body: { name },
      }).then((r) => r.data),

    /** Organisations the caller is NOT in — the "find one to join" directory. */
    directory: (params: { q?: string; page?: number } = {}) => {
      const p = new URLSearchParams();
      if (params.q) p.set("q", params.q);
      if (params.page) p.set("page", String(params.page));
      const qs = p.toString();
      return request<DirectoryOrganization[]>(
        `/orgs/directory${qs ? `?${qs}` : ""}`,
      ).then((r) => ({ items: r.data, meta: r.meta! }));
    },

    members: (slug: string) =>
      request<OrgMember[]>(`/orgs/${slug}/members`).then((r) => r.data),
    setMemberRole: (slug: string, userId: string, role: OrgRole) =>
      request<{ id: string; role: OrgRole }>(`/orgs/${slug}/members/${userId}`, {
        method: "PATCH",
        body: { role },
      }).then((r) => r.data),
    removeMember: (slug: string, userId: string) =>
      request<{ removed: boolean }>(`/orgs/${slug}/members/${userId}`, {
        method: "DELETE",
      }).then((r) => r.data),
    /** Leave an org yourself — distinct from being removed. */
    leave: (slug: string) =>
      request<{ left: boolean }>(`/orgs/${slug}/membership`, {
        method: "DELETE",
      }).then((r) => r.data),

    /** The rolling window of months — current plus the next two by default. */
    cycles: (slug: string, months?: number) =>
      request<Cycle[]>(
        `/orgs/${slug}/cycles${months ? `?months=${months}` : ""}`,
      ).then((r) => r.data),

    sprints: {
      list: (slug: string, cycle: string) =>
        request<SprintDetail[]>(`/orgs/${slug}/cycles/${cycle}/sprints`).then(
          (r) => r.data,
        ),
      get: (slug: string, cycle: string, num: number) =>
        request<SprintDetail>(
          `/orgs/${slug}/cycles/${cycle}/sprints/${num}`,
        ).then((r) => r.data),
      create: (slug: string, cycle: string, payload: CreateSprintPayload) =>
        request<SprintDetail>(`/orgs/${slug}/cycles/${cycle}/sprints`, {
          method: "POST",
          body: payload,
        }).then((r) => r.data),
      update: (
        slug: string,
        cycle: string,
        num: number,
        payload: UpdateSprintPayload,
      ) =>
        request<SprintDetail>(`/orgs/${slug}/cycles/${cycle}/sprints/${num}`, {
          method: "PATCH",
          body: payload,
        }).then((r) => r.data),
      remove: (slug: string, cycle: string, num: number) =>
        request<{ id: string; number: number }>(
          `/orgs/${slug}/cycles/${cycle}/sprints/${num}`,
          { method: "DELETE" },
        ).then((r) => r.data),
    },

    /** Tickets on one sprint's board. A single ticket uses `api.tasks.*` by id. */
    tickets: {
      list: (slug: string, cycle: string, sprint: number) =>
        request<Task[]>(
          `/orgs/${slug}/cycles/${cycle}/sprints/${sprint}/tickets`,
        ).then((r) => r.data),
      create: (
        slug: string,
        cycle: string,
        sprint: number,
        payload: CreateTaskPayload & { assigneeId?: string | null },
      ) =>
        request<Task>(`/orgs/${slug}/cycles/${cycle}/sprints/${sprint}/tickets`, {
          method: "POST",
          body: payload,
        }).then((r) => r.data),
    },

    joinRequests: (slug: string, status: JoinStatus = "PENDING") =>
      request<JoinRequest[]>(`/orgs/${slug}/join-requests?status=${status}`).then(
        (r) => r.data,
      ),
    requestToJoin: (slug: string, message?: string) =>
      request<MyJoinRequest>(`/orgs/${slug}/join-requests`, {
        method: "POST",
        body: message ? { message } : {},
      }).then((r) => r.data),
    decideJoinRequest: (slug: string, requestId: string, accept: boolean) =>
      request<JoinRequest>(
        `/orgs/${slug}/join-requests/${requestId}/${accept ? "accept" : "reject"}`,
        { method: "POST" },
      ).then((r) => r.data),
  },
  notifications: {
    list: (params: { unreadOnly?: boolean; page?: number } = {}) => {
      const p = new URLSearchParams();
      if (params.unreadOnly) p.set("unreadOnly", "true");
      if (params.page) p.set("page", String(params.page));
      const qs = p.toString();
      return request<AppNotification[]>(
        `/notifications${qs ? `?${qs}` : ""}`,
      ).then((r) => ({
        items: r.data,
        meta: r.meta as (PageMeta & { unread: number }) | undefined,
      }));
    },
    unreadCount: () =>
      request<{ unread: number }>("/notifications/unread-count").then(
        (r) => r.data.unread,
      ),
    markRead: (id: string) =>
      request<{ id: string }>(`/notifications/${id}/read`, { method: "POST" }),
    markAllRead: () =>
      request<{ updated: number }>("/notifications/read-all", {
        method: "POST",
      }).then((r) => r.data),
  },
  users: {
    list: () => request<AdminUser[]>("/users").then((r) => r.data),
    /** The caller's own join requests across every org. */
    myJoinRequests: () =>
      request<MyJoinRequest[]>("/users/me/join-requests").then((r) => r.data),
  },
};
