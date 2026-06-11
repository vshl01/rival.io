<div align="center">

# ⟫⟫ Rival

### Outpace your day — a kinetic, real-time task manager.

A production-grade full-stack task management application.
Next.js + TypeScript on the front, Node + Express + Prisma + PostgreSQL on the back.

</div>

---

## ✨ Highlights

- **Every core requirement, plus most of the bonuses.** CRUD, JWT auth, ownership isolation, filtering + search + sort that compose, pagination — and on top of that: real-time sync, optimistic UI with rollback, a ⌘K command palette, attachments **with inline preview**, per-task **comment threads** (owner ↔ admin), a per-task activity log, an admin console, dark/light mode, Dockerised setup, and a CI pipeline.
- **A distinctive interface.** Not another stock dashboard — an editorial, kinetic design language with character-revealing headlines, spring physics, smooth scrolling, and a warm near-black palette with an electric-lime accent.
- **Built like production.** Layered backend (routes → controllers → services), Zod validation everywhere, consistent error envelopes, a singleton Prisma client, graceful shutdown, rate-limited auth, httpOnly refresh-token rotation, and a typed API client with transparent token refresh.

---

## 🧱 Tech stack

| Layer       | Choice                                                                 |
| ----------- | ---------------------------------------------------------------------- |
| Frontend    | Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, TanStack Query, Zustand, React Hook Form + Zod |
| Backend     | Node + TypeScript, Express, Prisma ORM, Zod, Socket.IO, JWT, bcrypt    |
| Database    | PostgreSQL 16                                                          |
| Realtime    | Socket.IO (authenticated rooms per user)                              |
| Tests       | Vitest + Supertest (backend)                                          |
| Tooling     | Docker Compose, GitHub Actions                                       |

---

## 📁 Repository layout

```
rival.io/
├── backend/            # REST API — see backend/README.md
│   ├── src/
│   │   ├── modules/    # auth, tasks, users (routes · controller · service · schemas)
│   │   ├── middleware/ # auth, validation, error handling, uploads
│   │   ├── lib/        # prisma, jwt, password, socket
│   │   └── ...
│   ├── prisma/         # schema + migrations + seed
│   └── tests/          # Vitest + Supertest suites
├── frontend/           # Next.js app — see frontend/README.md (detailed guide)
│   └── src/
│       ├── app/        # routes: landing, (auth), (app)/dashboard, (app)/admin
│       ├── components/ # landing · app · tasks · ui · motion · auth
│       ├── hooks/      # React Query data hooks (optimistic mutations)
│       ├── lib/        # api client, types, design helpers
│       ├── providers/  # theme · query · socket
│       └── store/      # zustand: auth (persisted) · ui
├── docker-compose.yml  # one-command stack: db + api + web
└── .github/workflows/  # CI: backend.yml + frontend.yml (each path-filtered)
```

> The **frontend** has its own in-depth [`README.md`](./frontend/README.md) covering folder structure, conventions, and implementation details, as requested.

---

## 🚀 Getting started

You need **Node ≥ 20** and either **Docker** (easiest) or a local **PostgreSQL**.

### Option A — Docker (one command)

```bash
git clone <repo-url> rival && cd rival
docker compose up --build
```

That boots Postgres, runs the API migrations automatically, and serves:

- Web app → **http://localhost:3000**
- API → **http://localhost:4000** (health check at `/api/health`)

The database starts empty. To load the demo data, run the seed once the stack is up:

```bash
docker compose exec api npx prisma db seed
```

### Option B — Run locally (two terminals)

**1. Start Postgres** (via Docker, or use your own and update `DATABASE_URL`):

```bash
docker compose up -d db
```

**2. Backend**

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:migrate       # create tables
npm run db:seed              # optional: demo users + tasks
npm run dev                  # → http://localhost:4000
```

**3. Frontend** (new terminal)

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                  # → http://localhost:3000
```

### 🔑 Demo accounts (after seeding)

| Role  | Email             | Password      |
| ----- | ----------------- | ------------- |
| User  | `demo@rival.app`  | `Password123` |
| Admin | `admin@rival.app` | `Password123` |

The login screen has a **“Use the demo account”** shortcut.

---

## ✅ Requirements coverage

| Requirement | Status | Where |
| --- | --- | --- |
| **Task 1** — REST CRUD, PostgreSQL, validation, status codes, consistent errors | ✅ | `backend/src/modules/tasks` |
| **Task 2** — JWT auth, hashed passwords, protected routes, ownership, persisted session | ✅ | `backend/src/modules/auth`, `frontend/src/store/auth.ts` |
| **Task 3** — list + filter + pagination, create/edit form w/ validation, complete + delete, loading/empty/error states, responsive | ✅ | `frontend/src/components/tasks` |
| **Task 4** — search by title, sort by due/priority/created, all combined | ✅ | `tasks.service.ts`, `task-toolbar.tsx` |
| **Task 5** — README, `.env.example`, ≥3 tests, clean history | ✅ | this file, `backend/tests` (14 tests) |
| **Bonus** — admin role | ✅ | `/admin` console + `ownerId` scoping |
| **Bonus** — real-time (WebSockets) | ✅ | Socket.IO, `socket-provider.tsx` |
| **Bonus** — optimistic UI w/ rollback | ✅ | `use-tasks.ts` |
| **Bonus** — task attachments | ✅ | Multer upload + drawer UI |
| **Bonus** — activity log | ✅ | `Activity` model + timeline UI |
| **Bonus** — Dockerised setup | ✅ | `docker-compose.yml` |
| **Bonus** — CI pipeline | ✅ | `.github/workflows/{backend,frontend}.yml` (path-filtered) |
| **Bonus** — dark mode w/ persisted preference | ✅ | `next-themes` |
| **Extra** — per-task comment threads (owner ↔ admin, realtime) | ✅ | `comment-thread.tsx`, `Comment` model |
| **Extra** — inline attachment preview (image / PDF) | ✅ | `attachment-preview.tsx` |
| **Extra** — ⌘K command palette | ✅ | `command-palette.tsx` |

---

## 🧪 Tests

```bash
cd backend
npm test            # 14 tests: auth, CRUD, ownership isolation, pagination, filter+search+sort, admin RBAC
```

Tests run against a **dedicated `rival_test` database** so they never touch your dev/seed data. When `NODE_ENV=test`, the backend loads [`backend/.env.test`](backend/.env.test) (committed; local, non-secret values), and `pretest` applies the schema to it automatically — so with the Docker `db` running, `npm test` just works. CI spins up an ephemeral Postgres service and runs the suite on every push.

---

## 🌐 Deployment

**Live API:** https://rival-io.onrender.com — health check: https://rival-io.onrender.com/api/health

The app is deploy-ready for a typical split hosting setup:

- **Backend → Render** (live). Deployed from `backend/` on Render with a managed Postgres; the image boots via `prisma migrate deploy → seed → start`. Env: real `JWT_*` secrets, `COOKIE_SECURE=true`, `CORS_ORIGINS=*` (or your frontend origin).
- **Frontend → Vercel.** Import `frontend/`, set `NEXT_PUBLIC_API_URL=https://rival-io.onrender.com`.

> Cross-site cookies: in production set `COOKIE_SECURE=true` (the refresh cookie then uses `SameSite=None; Secure`) and serve both apps over HTTPS.

---

## 🧭 Assumptions & trade-offs

- **Dashboard vs. Admin console.** `/dashboard` is always the signed-in user's *own* tasks — including for admins (an admin has their own tasks too). The admin-only `/admin` console is for oversight: it shows *all* users' tasks, with a chip selector to focus on one person. This keeps the two routes purposeful and non-overlapping rather than both showing the same firehose.
- **Auth model.** Short-lived JWT access token (15 min) held in memory + persisted to `localStorage` for instant restore, paired with a long-lived **httpOnly** refresh cookie that rotates on use. A page refresh restores the session by verifying `/me` and silently refreshing if needed. This balances DX (no flash of logged-out UI) with reasonable security; for a higher bar I’d move the access token fully out of JS and add server-side refresh-token revocation.
- **Ownership leaks.** Accessing another user’s task returns **404, not 403**, so the API never confirms a task exists to someone who shouldn’t see it.
- **Priority sorting** relies on PostgreSQL native enum ordering (`LOW < MEDIUM < HIGH < URGENT`), so `priority desc` means “most urgent first” with no extra column.
- **File storage** is local disk (simple, works in Docker via a volume). For multi-instance production I’d swap the storage adapter for S3 — the upload boundary is isolated in `middleware/upload.ts`.
- **Realtime** invalidates React Query caches on push (rather than patching them) — simpler and always-correct, at the cost of a refetch.
- **Scope.** Backend tests are the required ≥3 (14 here, covering the critical paths); the frontend is verified via build + an automated end-to-end browser pass rather than a unit suite.

---

<div align="center">
<sub>Built with care. Outpace your day. ⟫⟫</sub>
</div>
