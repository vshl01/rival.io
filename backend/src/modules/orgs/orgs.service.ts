import { Prisma } from '@prisma/client';
import type { Actor } from '@/access/actor';
import { requireOrgAssigner, requireOrgMembership } from '@/access/policy';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/AppError';
import type { CreateOrgInput, OrgDirectoryQuery, UpdateOrgInput } from './orgs.schemas';

/** Shape returned for a single org — enough for the org header and member count. */
const orgSelect = {
  id: true,
  name: true,
  slug: true,
  key: true,
  createdAt: true,
  createdById: true,
  _count: { select: { memberships: true, sprints: true } },
} satisfies Prisma.OrganizationSelect;

/**
 * Slugs that would collide with a static frontend route under /dashboard.
 *
 * Next.js resolves a literal segment before a dynamic one, so an org slugged
 * "organizations" would simply be unreachable — a silent dead end rather than an
 * error. Rejecting it up front is the only way the user finds out.
 */
const RESERVED_SLUGS = new Set([
  'organizations',
  'organization',
  'orgs',
  'org',
  'new',
  'settings',
  'notifications',
  'admin',
  'dashboard',
  'me',
]);

/** "Acme Corp!" → "acme-corp". Falls back to "org" if nothing survives. */
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug || 'org';
}

/** "Acme Corp" → "ACME". Must start with a letter, so leading digits are dropped. */
function deriveKey(name: string): string {
  const key = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^[0-9]+/, '')
    .slice(0, 4);
  return key || 'ORG';
}

/**
 * Find a free variant of `base` by appending -2, -3, … .
 *
 * This is a best-effort convenience, not a guarantee: two simultaneous creates
 * can still collide on the unique index. `create` below catches that and reports
 * a clean 409 rather than leaking a Prisma error.
 */
async function firstFreeSlug(base: string): Promise<string> {
  for (let suffix = 1; suffix <= 50; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    if (RESERVED_SLUGS.has(candidate)) continue;
    const taken = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw AppError.conflict('Could not derive a free slug — please choose one explicitly');
}

async function firstFreeKey(base: string): Promise<string> {
  for (let suffix = 1; suffix <= 50; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}${suffix}`;
    const taken = await prisma.organization.findUnique({
      where: { key: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw AppError.conflict('Could not derive a free key — please choose one explicitly');
}

export const orgsService = {
  /**
   * Create an organisation. The creator becomes its ASSIGNER — role follows from
   * the action rather than being self-declared (docs/architecture.md §3).
   *
   * The org and the first membership are written in one transaction: an org with
   * no assigner would be permanently unmanageable.
   */
  async create(actor: Actor, input: CreateOrgInput) {
    // An explicit slug is never silently rewritten — the caller chose it, so a
    // reserved one is an error rather than a surprise.
    if (input.slug && RESERVED_SLUGS.has(input.slug)) {
      throw AppError.conflict(`"${input.slug}" is a reserved slug — please choose another`);
    }

    const slug = input.slug ?? (await firstFreeSlug(slugify(input.name)));
    const key = input.key ?? (await firstFreeKey(deriveKey(input.name)));

    try {
      return await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: input.name, slug, key, createdById: actor.id },
          select: orgSelect,
        });
        await tx.orgMembership.create({
          data: { orgId: org.id, userId: actor.id, role: 'ASSIGNER' },
        });
        return org;
      });
    } catch (err) {
      // P2002 = unique constraint. Only slug and key are unique here, and the
      // target tells us which one lost the race.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = String(err.meta?.target ?? '');
        throw AppError.conflict(
          target.includes('key')
            ? `Ticket key "${key}" is already taken`
            : `Organisation slug "${slug}" is already taken`,
        );
      }
      throw err;
    }
  },

  /** Organisations the actor belongs to, with their role in each. */
  async listMine(actor: Actor) {
    const memberships = await prisma.orgMembership.findMany({
      where: { userId: actor.id },
      orderBy: { joinedAt: 'asc' },
      select: { role: true, joinedAt: true, org: { select: orgSelect } },
    });

    return memberships.map(({ org, role, joinedAt }) => ({ ...org, myRole: role, joinedAt }));
  },

  /** One organisation. Members only — platform admins may look in (see policy). */
  async getBySlug(actor: Actor, slug: string) {
    const { org, membership } = await requireOrgMembership(actor, slug);

    const detail = await prisma.organization.findUniqueOrThrow({
      where: { id: org.id },
      select: orgSelect,
    });

    return { ...detail, myRole: membership?.role ?? null };
  },

  /**
   * Organisations the actor is NOT in — the "find an org to join" directory.
   *
   * Each row carries the actor's own pending request, so the UI can show
   * "Requested" instead of a join button without a second round-trip.
   */
  async directory(actor: Actor, query: OrgDirectoryQuery) {
    const where: Prisma.OrganizationWhereInput = {
      memberships: { none: { userId: actor.id } },
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          name: true,
          slug: true,
          key: true,
          createdAt: true,
          _count: { select: { memberships: true } },
          joinRequests: {
            where: { userId: actor.id, status: 'PENDING' },
            select: { id: true, createdAt: true },
            take: 1,
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    const items = rows.map(({ joinRequests, ...org }) => ({
      ...org,
      pendingRequest: joinRequests[0] ?? null,
    }));

    return { items, total };
  },

  /** Rename an organisation. Slug and key are immutable — they are in URLs and ticket keys. */
  async update(actor: Actor, slug: string, input: UpdateOrgInput) {
    const { org } = await requireOrgAssigner(actor, slug);

    return prisma.organization.update({
      where: { id: org.id },
      data: { name: input.name },
      select: orgSelect,
    });
  },
};
