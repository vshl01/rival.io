# Rival — Backend API

REST API for Rival. Node + TypeScript + Express + Prisma + PostgreSQL, with
JWT auth, Zod validation, Socket.IO realtime, file uploads, and an activity log.

---

## Architecture

A layered, feature-module structure:

```
src/
├── server.ts            # entry: connects DB, starts HTTP + Socket.IO, graceful shutdown
├── app.ts               # Express app factory (imported by tests — no port binding)
├── config/env.ts        # Zod-validated environment (fails fast on boot)
├── lib/                 # prisma (singleton), jwt, password (bcrypt), socket
├── middleware/          # auth (requireAuth/requireAdmin), validate (Zod), error, upload (Multer)
├── modules/
│   ├── auth/            # routes · controller · service · schemas
│   ├── tasks/           # routes · controller · service · schemas
│   └── users/           # admin-only user listing
└── utils/               # AppError, asyncHandler, httpResponse (envelopes + pagination)
```

**Request flow:** `route → validate(Zod) → requireAuth → controller → service → Prisma`.
Controllers are thin (HTTP in/out); business rules and authorization live in services.

---

## API

Base URL: `/api`. All responses use a consistent envelope.

- **Success:** `{ "data": ..., "meta"?: { pagination } }`
- **Error:** `{ "error": { "code": "BAD_REQUEST", "message": "...", "details"?: {...} } }`

### Auth

| Method | Path             | Auth | Body / notes |
| ------ | ---------------- | ---- | ------------ |
| POST   | `/auth/signup`   | —    | `{ name, email, password }` → sets refresh cookie, returns `{ user, accessToken }` |
| POST   | `/auth/login`    | —    | `{ email, password }` |
| POST   | `/auth/refresh`  | cookie | rotates refresh cookie, returns a fresh access token |
| POST   | `/auth/logout`   | —    | clears the refresh cookie |
| GET    | `/auth/me`       | ✅   | current user |

### Tasks (all require `Authorization: Bearer <token>`)

| Method | Path                              | Notes |
| ------ | --------------------------------- | ----- |
| GET    | `/tasks`                          | `?status&priority&search&sortBy&sortOrder&page&pageSize` (+ `ownerId` for admins) |
| POST   | `/tasks`                          | `{ title, description?, status?, priority?, dueDate? }` |
| GET    | `/tasks/:id`                      | own task (admins: any) |
| PATCH  | `/tasks/:id`                      | partial update; status→DONE sets `completedAt` |
| DELETE | `/tasks/:id`                      | |
| GET    | `/tasks/:id/activity`             | audit trail |
| POST   | `/tasks/:id/attachments`          | `multipart/form-data`, field `file` |
| DELETE | `/tasks/:id/attachments/:attachmentId` | |
| GET    | `/tasks/:id/comments`             | discussion thread (owner + admins) |
| POST   | `/tasks/:id/comments`             | `{ body }` — add a comment |
| DELETE | `/tasks/:id/comments/:commentId`  | author or admin only |

| GET | `/users` | **admin only** — list users with task counts |
| GET | `/health` | liveness probe |

**Validation:** every write endpoint is validated with Zod; failures return `400` with `details.fieldErrors`.
**Authorization:** non-owners get `404` (existence is never leaked); admin-only routes get `403` otherwise.
**Realtime:** mutations emit `task:created|updated|deleted` and `activity:created` to the owner’s socket room.

---

## Setup

Requires Node ≥ 20 and a PostgreSQL database.

```bash
cp .env.example .env       # fill in DATABASE_URL + JWT secrets
npm install
npm run prisma:migrate     # apply migrations (creates tables)
npm run db:seed            # optional demo data
npm run dev                # http://localhost:4000
```

### Scripts

```bash
npm run dev              # tsx watch (hot reload)
npm run build            # tsc → dist/ (+ tsc-alias for path aliases)
npm start                # run compiled dist/
npm test                 # vitest (needs a reachable Postgres)
npm run typecheck        # tsc --noEmit
npm run prisma:migrate   # create/apply a dev migration
npm run prisma:studio    # browse data
npm run db:seed          # seed demo users + tasks
```

---

## Environment

See [`.env.example`](./.env.example). Key vars:

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | token signing (use `openssl rand -base64 48`) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | token lifetimes (default `15m` / `7d`) |
| `CORS_ORIGINS` | comma-separated allowed frontend origins — the only origins a browser may call this API from. Refuses to boot on `*` when `NODE_ENV=production` |
| `COOKIE_SECURE` | `true` in production (HTTPS) for `SameSite=None; Secure` refresh cookie |
| `MAX_UPLOAD_BYTES` | attachment size limit (default 5 MB) |

`CORS_ORIGINS` and `COOKIE_SECURE` are set per environment in the committed
`.env.development` / `.env.production`, chosen by `NODE_ENV` (see `src/config/env.ts`).
Files load highest-precedence first: `.env.$NODE_ENV.local` → `.env.$NODE_ENV` → `.env`,
and real platform variables beat all of them. Keep secrets in `.env` only.
`NODE_ENV=test` loads **only** `.env.test`, so the suite can never reach a real database.

---

## Tests

14 Supertest + Vitest tests covering auth (signup/login/duplicate/weak password/protected `/me`), task CRUD, **ownership isolation**, pagination meta, **filter + search + sort combined**, and **admin RBAC**.

```bash
npm test
```

Tests run against a **dedicated `rival_test` database** (never your dev data). The
suite loads [`.env.test`](./.env.test) when `NODE_ENV=test`, and the `pretest` script
applies the schema to it automatically — so with the Docker `db` running, `npm test`
just works. Tables are truncated between tests for isolation.

---

## Data model

`User (1) ─< Task (1) ─< Attachment`, plus `Task (1) ─< Activity` and `Task (1) ─< Comment`.
Tasks cascade-delete their attachments, activities, and comments. Composite indexes on
`(ownerId, status|dueDate|priority|createdAt)` keep the list query fast.
See [`prisma/schema.prisma`](./prisma/schema.prisma).
