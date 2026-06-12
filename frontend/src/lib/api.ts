import type {
  Activity,
  AdminUser,
  Attachment,
  Comment,
  PageMeta,
  Task,
  TaskFilters,
  User,
} from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
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
  users: {
    list: () => request<AdminUser[]>("/users").then((r) => r.data),
  },
};
