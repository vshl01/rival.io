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

### Sprint dates are not clamped to their cycle

A sprint filed under the July cycle may have an August deadline. The cycle is an
organisational bucket, not a date constraint. The only invariant enforced is
`deadline > startsAt`.

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
| Update ticket, incl. assigning it to anyone | ✅ | ✅ |
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

Audit history only — no live presence layer.

---

## 7. Realtime

Rooms move from per-user to per-scope, because a ticket now has an audience
rather than an owner:

| room | receives |
| --- | --- |
| `user:<id>` | notifications addressed to one person |
| `org:<id>` | membership and sprint structure changes |
| `sprint:<id>` | ticket and comment activity |

Sockets join rooms from membership at handshake, and must re-join when
membership changes mid-session.

---

## 8. Build order

1. ✅ Schema + migration + `src/access/` policy layer
2. ✅ Orgs · membership · join requests · accept/reject
3. ✅ Cycles (lazy upsert) + sprints
4. ✅ `Task` → `Ticket` rename, sprint scoping, `assigneeId`, keys, policy checks
5. Realtime rooms replace `emitToUser`
6. ✅ Notifications REST + sidebar drawer — socket push still pending (see §7)
7. Widen `Activity` (§6)
8. ◐ Frontend: organisations hub, org workspace, roster, join requests,
   notifications drawer done; sprint board waits on step 3
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
- **Realtime for tickets is interim.** `emitTicket` notifies the creator and
  assignee directly, because rooms are still keyed per user. Step 5 replaces this
  with `sprint:<id>` rooms so every member sees board changes live. Until then a
  third member must refetch.

### Conventions worth knowing

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
