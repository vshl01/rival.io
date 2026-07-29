import type { Prisma } from '@prisma/client';
import type { Actor } from '@/access/actor';
import { requireOrgMembership } from '@/access/policy';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/utils/AppError';
import { type CycleWindowQuery, formatCycle, parseCycle } from './cycles.schemas';

/**
 * Cycles — the month blocks an organisation's sprints hang off.
 *
 * See docs/architecture.md §2. Two rules drive everything here:
 *
 *  1. Cycles are created LAZILY by the read path. No cron, no creation step in
 *     the UI, and month rollover handles itself.
 *  2. "Which month is now" is resolved in ONE fixed zone, not per user. A user
 *     in IST at 00:30 on 1 August and a UTC server disagree about the current
 *     month, and that disagreement would create duplicate-looking cycles.
 */
const CYCLE_TIME_ZONE = 'Asia/Kolkata';

/**
 * How far from the current month a cycle may be created.
 *
 * Without a bound, any URL could mint a row for the year 9999. Reading still
 * works for anything that already exists — this only limits creation.
 */
const EARLIEST_MONTHS_BACK = 12;
const LATEST_MONTHS_AHEAD = 24;

interface YearMonth {
  year: number;
  month: number;
}

/** The current month in `CYCLE_TIME_ZONE`. */
function currentYearMonth(): YearMonth {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CYCLE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());

  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return { year, month };
}

/** `count` consecutive months starting at `start`, inclusive. */
function monthsFrom(start: YearMonth, count: number): YearMonth[] {
  return Array.from({ length: count }, (_, offset) => {
    // Months are 1-indexed, so shift to 0-index for the arithmetic and back.
    const zeroBased = start.month - 1 + offset;
    return { year: start.year + Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
  });
}

/** Signed month distance from the current month — negative means the past. */
function monthsFromNow({ year, month }: YearMonth): number {
  const now = currentYearMonth();
  return (year - now.year) * 12 + (month - now.month);
}

const cycleInclude = {
  sprints: {
    orderBy: { number: 'asc' },
    select: {
      id: true,
      number: true,
      name: true,
      startsAt: true,
      deadline: true,
      createdAt: true,
      assigner: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.CycleInclude;

type CycleWithSprints = Prisma.CycleGetPayload<{ include: typeof cycleInclude }>;

/** Wire shape: the month is exposed as its readable `cycle` key, not raw parts. */
function toDto(cycle: CycleWithSprints) {
  return {
    id: cycle.id,
    cycle: formatCycle(cycle.year, cycle.month),
    year: cycle.year,
    month: cycle.month,
    sprints: cycle.sprints,
  };
}

/**
 * Create the cycle if it does not exist, and return it.
 *
 * Shared with sprint creation, which must be able to file a sprint into a month
 * nobody has opened yet. `createMany` + `skipDuplicates` rather than `upsert` so
 * two concurrent callers cannot race on the unique index.
 */
export async function ensureCycle(orgId: string, cycleKey: string) {
  const { year, month } = parseCycle(cycleKey);
  const distance = monthsFromNow({ year, month });

  if (distance < -EARLIEST_MONTHS_BACK || distance > LATEST_MONTHS_AHEAD) {
    throw AppError.badRequest(
      `${cycleKey} is outside the allowed range (${EARLIEST_MONTHS_BACK} months back to ${LATEST_MONTHS_AHEAD} months ahead)`,
    );
  }

  await prisma.cycle.createMany({ data: [{ orgId, year, month }], skipDuplicates: true });
  return prisma.cycle.findUniqueOrThrow({
    where: { orgId_year_month: { orgId, year, month } },
  });
}

export const cyclesService = {
  /**
   * The rolling window: the current month plus the next `months - 1`.
   *
   * Upserting on read is what makes cycles appear without anyone creating them.
   */
  async listWindow(actor: Actor, slug: string, query: CycleWindowQuery) {
    const { org } = await requireOrgMembership(actor, slug);
    const window = monthsFrom(currentYearMonth(), query.months);

    await prisma.cycle.createMany({
      data: window.map(({ year, month }) => ({ orgId: org.id, year, month })),
      skipDuplicates: true,
    });

    const cycles = await prisma.cycle.findMany({
      where: { orgId: org.id, OR: window },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
      include: cycleInclude,
    });

    return cycles.map(toDto);
  },

  /**
   * One month by its `YYYY-MM` key.
   *
   * Read-only on purpose: it 404s rather than creating. Only the window endpoint
   * and sprint creation mint cycles, which keeps arbitrary URLs from filling the
   * table with empty months.
   */
  async getOne(actor: Actor, slug: string, cycleKey: string) {
    const { org } = await requireOrgMembership(actor, slug);
    const { year, month } = parseCycle(cycleKey);

    const cycle = await prisma.cycle.findUnique({
      where: { orgId_year_month: { orgId: org.id, year, month } },
      include: cycleInclude,
    });
    if (!cycle) throw AppError.notFound(`No cycle for ${cycleKey} in this organisation`);

    return toDto(cycle);
  },
};
