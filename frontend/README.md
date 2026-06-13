# Rival — Frontend

The Next.js (App Router) client for Rival. This document is a guided tour of the
folder structure, the conventions every file follows, and how the major pieces
fit together — so a new contributor can be productive in minutes.

---

## 1. Stack & rationale

| Concern            | Library                | Why |
| ------------------ | ---------------------- | --- |
| Framework          | **Next.js 14 (App Router)** | Required; RSC-ready routing, file-based layouts, route groups. |
| Styling            | **Tailwind CSS**       | Token-driven design system via CSS variables; fast, consistent. |
| Animation          | **Framer Motion** + **Lenis** | Kinetic headlines, spring micro-interactions, smooth scroll. |
| Server state       | **TanStack Query**     | Caching, background refetch, and first-class **optimistic updates**. |
| Client state       | **Zustand**            | Tiny, ergonomic stores for **auth** (persisted) and **UI** (modals). |
| Forms              | **React Hook Form + Zod** | Performant forms with schema validation shared in spirit with the API. |
| Realtime           | **socket.io-client**   | Authenticated live updates that invalidate query caches. |
| Icons / toasts     | **lucide-react** / **sonner** | Clean icon set; themeable notifications. |

---

## 2. Folder structure

```
src/
├── app/                          # Routing layer (App Router)
│   ├── layout.tsx                # Root: fonts, <Providers>, <html> theme class
│   ├── globals.css               # Design tokens (light/dark) + base + utilities
│   ├── providers.tsx             # Composes Theme + Query + Socket + Toaster + AuthBootstrap
│   ├── page.tsx                  # Public landing page
│   ├── (auth)/                   # Route group — split-screen auth shell
│   │   ├── layout.tsx            #   redirects authed users away
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   └── (app)/                    # Route group — authenticated shell
│       ├── layout.tsx            #   RequireAuth + nav + global modals/palette
│       ├── dashboard/page.tsx    #   the task workspace
│       └── admin/page.tsx        #   admin console (RequireAdmin)
│
├── components/                   # Presentational + interactive components
│   ├── ui/                       # Primitives: button, field, modal, badge, feedback, logo, theme-toggle
│   ├── motion/                   # Reveal, KineticHeadline, SmoothScroll
│   ├── landing/                  # Marketing sections: hero, bento, how-it-works, cta, footer…
│   ├── auth/                     # auth-gate (guards/bootstrap), auth-aside
│   ├── app/                      # app-nav, user-menu, command-palette
│   └── tasks/                    # task-workspace, list, card, toolbar, form modal, detail drawer, momentum bar, activity timeline
│
├── hooks/
│   ├── use-tasks.ts              # All task queries + mutations (query keys live here)
│   └── use-debounce.ts
│
├── lib/
│   ├── api.ts                    # Typed fetch client: auth header, transparent refresh, error parsing
│   ├── types.ts                  # Domain types mirroring the API contract
│   ├── task-meta.ts              # Status/priority labels, icons, colours, sort options
│   ├── format.ts                 # Date / size formatting (date-fns)
│   ├── motion.ts                 # Shared Framer Motion variants + easings
│   └── utils.ts                  # cn() — clsx + tailwind-merge
│
├── providers/
│   ├── theme-provider.tsx        # next-themes wrapper
│   ├── query-provider.tsx        # QueryClient with retry/staleness policy
│   └── socket-provider.tsx       # Authenticated socket → cache invalidation + useRealtime()
│
└── store/
    ├── auth.ts                   # Session: login/signup/logout/bootstrap, persisted to localStorage
    └── ui.ts                     # Ephemeral UI: command palette + task form + detail drawer
```

### Why this shape

- **Routing is thin.** Files under `app/` wire layouts, guards, and page composition. Real logic lives in `components/`, `hooks/`, and `lib/` so it’s testable and reusable.
- **Route groups** `(auth)` and `(app)` give each area its own layout/guard without leaking into the URL.
- **Components are grouped by domain** (`landing`, `tasks`, `app`) with shared primitives in `ui/` and pure motion helpers in `motion/`.
- **One source of truth per concern:** the API contract in `lib/api.ts` + `lib/types.ts`, query keys + mutations in `hooks/use-tasks.ts`, design tokens in `globals.css` + `tailwind.config.ts`.

---

## 3. Conventions (code-level separation)

- **Server vs client.** Components are server components by default; anything using hooks, browser APIs, or motion starts with `'use client'`. Pages stay lean and delegate interactivity to client components.
- **Data flows one way.** Components never call `fetch` directly — they use hooks from `use-tasks.ts`, which call the typed `api` object. The `api` layer is the *only* place that knows about URLs, headers, and the refresh dance.
- **State boundaries.**
  - *Server state* (tasks, users, activity) → TanStack Query.
  - *Session* → `useAuth` (Zustand, persisted).
  - *Ephemeral UI* (which modal is open) → `useUi` (Zustand).
  - *Local form/component state* → `useState` / React Hook Form.
- **Styling.** Tailwind utilities only; colours come from semantic tokens (`bg-surface`, `text-ink`, `border-line`, `text-accent`) — never raw hex — so light/dark and theming stay consistent. Compose conditional classes with `cn()`.
- **Naming.** Files are `kebab-case`; components are `PascalCase`; hooks are `useX`. Each file does one thing and is named for it.
- **Accessibility.** Buttons have `aria-label`s where icon-only, modals trap focus + close on Escape, the focus ring is themed, and `prefers-reduced-motion` is honoured globally.

---

## 4. How the key flows work

### Authentication & session persistence
- `useAuth` (`store/auth.ts`) holds `{ user, accessToken }`, persisted to `localStorage`.
- On load, `<AuthBootstrap>` calls `bootstrap()`, which verifies the token via `/me`. If the access token is stale, `lib/api.ts` **transparently** hits the httpOnly refresh cookie and retries — so a page refresh keeps you logged in with no flicker.
- Guards in `components/auth/auth-gate.tsx`: `RequireAuth` (app routes), `RequireAdmin` (admin), `RedirectIfAuthenticated` (auth routes).

### Tasks & optimistic UI
- All reads/writes live in `hooks/use-tasks.ts`. Query keys are centralised in `taskKeys`.
- **Optimistic updates:** toggling complete, editing, and deleting patch the cache immediately and **roll back on error** (with a toast). See `useUpdateTask` / `useDeleteTask`.
- Filtering, search (debounced), sort, and pagination are composed in `TaskWorkspace` and flow into a single query key, so they all work together.

### Realtime
- `socket-provider.tsx` opens one authenticated socket while logged in and invalidates the relevant query caches on `task:*` / `activity:*` events. The nav shows a **Live** indicator. Open two tabs to see it.

### Command palette (⌘K)
- `command-palette.tsx` (cmdk) is mounted once in the app layout and toggled via a global key listener + the `useUi` store. Actions: new task, switch theme, navigate, sign out.

---

## 5. Design system

Tokens are defined as HSL channels in `globals.css` under `:root` (light) and
`.dark`, and mapped to Tailwind colours in `tailwind.config.ts` so every token
supports opacity modifiers (`bg-accent/10`). Typography pairs an editorial serif
(**Instrument Serif**) for display with **Inter** for UI and **JetBrains Mono**
for labels. Motion variants and easings are shared from `lib/motion.ts`.

To restyle the whole app, edit the variables in `globals.css` — nothing
hard-codes a colour.

---

## 6. Commands

```bash
npm run dev        # dev server (http://localhost:3000)
npm run build      # production build
npm run start      # serve the production build
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
```

### Environment

Copy `.env.example` → `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000   # base URL of the Rival API
```

`NEXT_PUBLIC_*` values are inlined at build time, so set this before building
for production (the Docker image takes it as a build arg).
