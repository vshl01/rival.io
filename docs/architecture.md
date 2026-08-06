# Rival — collaboration architecture

How organisations, cycles, sprints and tickets fit together, and the rules that
govern who may do what. This is the design record: read it before changing the
data model or the permission checks.

---

## 1. The two kinds of work

Rival deliberately supports two things that look similar and are governed
completely differently. Keeping them distinct is the single most important idea
in this document.

| | **Personal task** | **Ticket** |
| --- | --- | --- |
| Lives in | `/dashboard` | `/dashboard/{org}/{cycle}/{sprint}` |
| Belongs to a sprint | no (`sprintId` is `null`) | yes, always |
| Readable key | none | `ACME-142` |
| Who can see it | only the creator | every member of the org |
| Governed by | `createdById` | org membership + role |

One `Ticket` model backs both: `sprintId == null` means personal. The database
allows null so existing data keeps working; **the service layer refuses to create
a ticket inside an org without a sprint.** Schema permissiveness is for
migration, not for callers.

---

## 2. Hierarchy

```
Organization            "Acme"        slug: acme        key: ACME
└── Cycle               a calendar month (year + month)
    └── Sprint          numbered within its cycle, has a deadline
        └── Ticket      ACME-142
```

Route shape mirrors it exactly, and every segment is human-readable:

```
/dashboard/acme/2026-07/3/ACME-142
           │    │       │ └── ticket key   (unique per org)
           │    │       └──── sprint number (unique per cycle)
           │    └──────────── cycle        (year-month)
           └───────────────── org slug
```

Sprint **numbers** rather than cuids are in the URL on purpose: `/spr_cmq9k6zir0001/`
is unreadable and unshareable. Numbers restart at 1 each cycle.

### Cycles are created lazily

A cycle is a real row, so something must create it. That something is the **read
path**: when the org page asks for its rolling window (current month + next 2),
those three cycles are upserted. Idempotent thanks to
`@@unique([orgId, year, month])`, needs no cron, and month rollover handles
itself. Past cycles are never deleted, so history stays browsable even though the
default view is three months.

"Which month is current" is resolved server-side in a single fixed zone, not
per-user — otherwise a user at 00:30 IST on 1 August and the server in UTC
disagree about which cycle to upsert.

### A sprint starts in its own month; it may end outside it

Two rules, deliberately asymmetric:

| | enforced? | why |
| --- | --- | --- |
| `deadline > startsAt` | yes | a sprint that ends before it starts is a typo |
| `startsAt` inside the cycle month | **yes** | the cycle is where the sprint lives |
| `deadline` inside the cycle month | no | 28 July → 8 August is an ordinary sprint |

Filing a July sprint that starts on 12 August is not a filing decision, it is a
mistake — usually made by opening the wrong month's *+ Sprint* button. It also
breaks the board: July would list work that has not begun while August looks
empty. So the start is clamped and the deadline is free.

The check lives in `sprintsService` rather than the Zod schema, because the cycle
key is a path parameter the schema cannot see. It resolves "which month is this
date in?" through `yearMonthOf` — the cycles module's single fixed-zone helper —
so it can never disagree with the code that decides which month is current.

Re-scheduling is checked the same way: there is no endpoint to re-file a sprint
under a different month, so a `PATCH` that moved its start out of that month would
leave it stranded.

---

## 3. Roles

Two **independent** axes. Merging them would be the worst possible mistake here.

- **`User.role`** — `USER | ADMIN`. Platform-level, powers the existing
  super-admin console. Unchanged by any of this.
- **`OrgMembership.role`** — `ASSIGNER | WORKER`. Per organisation.

Because it is per-org, the same person is an assigner in the org they created and
a worker in one they joined. Both are true at once, which is why the role cannot
live in the JWT and is looked up per request.

### Roles are earned by action, never self-declared

There is no "are you an assigner or a worker?" screen — no real tool has one,
because the answer is never global.

> **Create an organisation → you are its assigner.
> Join an organisation → you are a worker.**

An assigner may later promote a worker. The onboarding screen therefore offers
*Create an organisation* or *Join an organisation*: a choice of action, from
which the role follows.

### Permissions

| Action | Assigner | Worker |
| --- | :---: | :---: |
| Create ticket | ✅ | ✅ |
| Read tickets in their org | ✅ | ✅ |
| Update ticket | ✅ | ✅ |
| **Delete ticket** | ✅ | ❌ |
| Create cycle / sprint, set deadline | ✅ | ❌ |
| Accept or reject join requests | ✅ | ❌ |
| Promote or remove members | ✅ | ❌ |
| Anything in an org they are not a member of | ❌ | ❌ |

Delete is the only asymmetry — a worker cannot delete even their own ticket.
That is intentional, and it is why tickets need a cancelled/archived status:
without one, workers must ask an assigner to clean up every typo.

A platform `ADMIN` may **read** any org (for the admin console) but is not
granted write access by virtue of being an admin. Writes require real
membership.

### Assignees are a set, not a person

`Ticket.assignees` is a many-to-many relation (`_TicketAssignees`), not a single
`assigneeId` column. Real work is shared, and one column forces a lie about who is
responsible for it — the second person ends up named in the description, where
nothing can filter or count them.

Rules:

- Any member may add or remove any member, at any time. There is no "owner" of the
  assignment.
- Every assignee must be a member of the ticket's org, verified in one `count`
  query rather than one per id. Otherwise a ticket could be pushed at someone who
  cannot open it.
- `PATCH` **replaces** the whole set (`assignees: { set: [...] }`). The client
  always sends the full list, so there is no add/remove endpoint pair to keep
  consistent, and a dropped request cannot leave a half-applied change.
- Sending no `assigneeIds` at all leaves the set untouched — distinct from `[]`,
  which clears it.

### Sprint leadership

`Sprint.assignerId` is whoever created it. Since only assigners can create
sprints, that person is always an assigner — no special case needed for
"the org's assigner versus the sprint's creator".

Any assigner in the org may delete tickets in any of its sprints;
`assignerId` records who leads the sprint. The stricter alternative — only *that
sprint's* assigner may delete within it — was rejected because it stops an org
owner from tidying a colleague's sprint.

---

## 4. Where permission checks live

All of them live in [`src/access/`](../backend/src/access/), and nowhere else.

```
src/access/
  actor.ts   the authenticated caller (mirrors req.user)
  policy.ts  getOrgBySlugOrThrow · findMembership
             requireMember · requireAssigner
             requireOrgMembership · requireOrgAssigner   (slug → check, one step)
```

This matters because the previous model was one line — `where.ownerId = actor.id`
— and it was *self-enforcing*: forget it and you get an empty list, not a leak.
Membership scoping is the opposite: forget it and every org's data is exposed.
Scattering these checks across ~20 endpoints is precisely how IDOR bugs happen,
so there is one module that answers "may this actor do this", and route handlers
call it rather than reimplementing it.

Every lookup is a single index hit on `@@unique([orgId, userId])`, so no caching
layer is warranted yet. If profiling ever shows it, memoise per request — do not
add a TTL cache, because a stale role is a security bug.

---

## 4b. Sequence numbers: sprints now, tickets next

`Cycle.sprintSeq` and `Organization.ticketSeq` both hand out numbers the same way,
and both follow two rules learnt the hard way:

**Increment atomically, in the database.** `{ increment: 1 }` returns a number no
other caller can hold. Counting existing rows and adding one lets two simultaneous
creators pick the same value and collide on the unique index — silent under low
load, loud under high load.

**Do not wrap it in an interactive transaction.** The increment is already atomic
on its own. Wrapping the increment-then-create pair holds a transaction open per
request, and concurrent creates then contend for Prisma's `maxWait` against a
remote database — which fails under exactly the load the transaction was meant to
survive. This was observed: five simultaneous sprint creates against Neon failed
inside a `$transaction` and passed without one.

The trade-off is **gaps**. A failure between the two statements consumes a number,
and deletes leave holes. That is intended: a number is an identity that appears in
URLs and history, so it moves forward only and is never reused.

## 5. Ticket keys

`ACME-142` = `Organization.key` + a per-org counter.

The counter follows the rules in §4b: an atomic `{ increment: 1 }` in the
database, and **not** wrapped in an interactive transaction. Two simultaneous
creators would otherwise both read `141` and both write `142` — which fails
silently under low load and loudly under high load, the worst combination.

A key is never reused. Delete `ACME-3` and the next ticket is `ACME-4`, because a
key is an identity that appears in URLs, comments and history.

---

## 6. Audit trail

`Activity` is append-only and already computes a field-level diff
(`{ title: { from, to } }`). Two additions for collaboration:

- **`actorName`** — a snapshot of the actor's display name at write time.
  `actorId` alone is not enough: `onDelete: SetNull` means deleting a user
  currently erases who did what, and an audit trail that loses its actor is not
  an audit trail.
- **`ticketKey`, `orgId`, `sprintId`** — so org-level events ("member joined",
  "sprint created") can be logged, and so the log is readable without a join.

**Relation changes are logged explicitly.** The generic diff walks the scalar
columns of the row, so it cannot see the assignee set at all. Reassignment — one
of the few things people actually argue about — would silently leave no trace.
`ticket.assignees_changed` is therefore written by hand with `{ added, removed }`
as *names*, so the entry stays readable years later even if those accounts are
gone. Any future relation field needs the same treatment.

Audit history only — no live presence layer.

---

## 7. Realtime

Two kinds of room, because a ticket has an audience rather than an owner:

| room | receives | joined |
| --- | --- | --- |
| `user:<id>` | notifications, and their own personal tasks | automatically, at connection |
| `sprint:<id>` | ticket, comment and activity events for one board | on request, after a membership check |

Every ticket event goes to **both**: the sprint room, so whoever has that board
open sees the card move; and the creator and assignees, who care about their own
work whether or not they are looking. A person in both receives it twice, which
is harmless — every handler patches by id or refetches.

### Why the sprint room is joined on request, not at handshake

A room name is a client-supplied string. `socket.join('sprint:' + whatever)` with
no check is a subscription to another organisation's board, so `sprint:watch`
verifies membership first (one query — `Sprint.orgId` is denormalised) and
silently ignores anything else. Silently, because there is nothing the client can
do about a refusal, and "that sprint exists but is not yours" is a probing oracle
the REST API does not offer.

Joining at handshake was the alternative and it is worse: it would mean loading
every sprint of every org the user belongs to on connect, and re-joining whenever
membership or the sprint list changed.

**Reconnects re-join.** A reconnect is a new session id and Socket.IO does not
restore rooms, so `useWatchSprint` re-emits whenever `connected` flips back to
true. Without that, a board silently stops updating after a network blip — the
worst kind of failure, because nothing looks broken.

The client patches its board cache from the pushed payload *and* invalidates.
The patch is what makes a colleague's drag land instantly; the refetch is what
makes it correct if the payload was ever incomplete.

---

## 8. Build order

1. ✅ Schema + migration + `src/access/` policy layer
2. ✅ Orgs · membership · join requests · accept/reject
3. ✅ Cycles (lazy upsert) + sprints
4. ✅ `Task` → `Ticket` rename, sprint scoping, assignees, keys, policy checks
5. ✅ `sprint:<id>` rooms alongside `user:<id>` — boards update live for everyone
6. ✅ Notifications REST + sidebar drawer, pushed over the socket
7. Widen `Activity` (§6)
8. ✅ Frontend: organisations hub, org workspace, roster, join requests,
   notifications drawer, sprint board
9. ✅ Cross-org denial tests (`backend/tests/orgs.test.ts`)

The notifications drawer polls its unread count every 60s rather than receiving a
push. That is deliberate: the socket layer moves from per-user to per-scope rooms
in step 5, and a notification channel built before that would have to be rebuilt.

### API surface

Personal tasks kept their original paths, so nothing that worked before changed:

```
GET|POST      /api/tasks                 personal tasks only (sprintId = null)
GET|PATCH|DEL /api/tasks/:id             EITHER kind — the policy layer decides
              /api/tasks/:id/{attachments,comments,activity}

GET|POST      /api/orgs/:slug/cycles/:cycle/sprints/:number/tickets   the board
```

A single ticket is addressed by id through `/api/tasks/:id` rather than being
nested under its sprint. Nesting would mean four path segments before the id on
every sub-resource, and the policy layer already resolves scope from the ticket
itself — the path adds nothing it does not already know.

### Deliberate deferrals

- **`Activity` widening** waits for step 7. `actorName` is non-null, so it needs
  a backfill, and there is no reason to couple that to this migration.
- **Concurrent-edit protection** is still open. Two people on one ticket is now
  normal and last-write-wins silently clobbers; the fix is rejecting a write whose
  `updatedAt` is stale.
- **The org has no room of its own.** Membership changes (someone joins, a role
  changes) reach the people involved through their `user:<id>` notification, and
  the assigner's queue refetches on that event. An `org:<id>` room would let a
  roster update reach members who are merely watching — worth adding when
  something on screen depends on it, which nothing currently does.

### Conventions worth knowing

**One test run at a time.** Every test truncates every table and the test database
is shared, so two concurrent runs delete each other's fixtures. The symptoms are
nothing like the cause — a `POST` returning 201 for a row that no longer exists,
duplicate-slug errors nobody typed twice, `deadlock detected` from two `deleteMany`
batches meeting. `tests/global-setup.ts` now refuses to start while another run
holds the lock.

**Reserved slugs.** `orgs.service` rejects slugs that would collide with a static
route under `/dashboard` (`organizations`, `admin`, `settings`, …). Next resolves
a literal segment before a dynamic one, so such an org would be silently
unreachable rather than erroring.

**Query schemas must be idempotent.** `validate()` replaces `req.query` with the
parsed result and handlers parse it again to recover typed values. A one-way
`transform` (string → boolean) therefore throws on the second pass. Use
`z.coerce.*`, plain `z.enum`, or a union that accepts both shapes — never a bare
`transform` in a *query* schema. Body schemas are parsed once and are exempt.

### Known schema gap

One PENDING join request per (org, user) needs a **partial** unique index, which
Prisma cannot express:

```sql
CREATE UNIQUE INDEX "join_requests_org_user_pending_key"
  ON "join_requests" ("orgId", "userId")
  WHERE "status" = 'PENDING';
```

Until that ships as a raw-SQL migration, the service enforces it — see
`orgMembersService.requestToJoin`. The index is the durable guarantee; the
service check is the friendly error message.
