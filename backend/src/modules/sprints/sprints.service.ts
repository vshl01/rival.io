import type { Prisma } from '@prisma/client';
import type { Actor } from '@/access/actor';
import { requireOrgAssigner, requireOrgMembership } from '@/access/policy';
import { prisma } from '@/lib/prisma';
import { ensureCycle } from '@/modules/cycles/cycles.service';
import { formatCycle, parseCycle } from '@/modules/cycles/cycles.schemas';
import { AppError } from '@/utils/AppError';
import type { CreateSprintInput, UpdateSprintInput } from './sprints.schemas';

const sprintSelect = {
  id: true,
  number: true,
  name: true,
  startsAt: true,
  deadline: true,
  createdAt: true,
  updatedAt: true,
  assigner: { select: { id: true, name: true, email: true } },
  cycle: { select: { year: true, month: true } },
} satisfies Prisma.SprintSelect;

type SprintRow = Prisma.SprintGetPayload<{ select: typeof sprintSelect }>;

/** Flatten the cycle relation into the readable `2026-07` key the URL uses. */
function toDto({ cycle, ...sprint }: SprintRow) {
  return { ...sprint, cycle: formatCycle(cycle.year, cycle.month) };
}

/**
 * Resolve a sprint from the URL triple (org slug, cycle key, per-cycle number).
 *
 * Scoped by org AND cycle, so a number from one month can never resolve to a
 * sprint in another — the number alone is not unique across the organisation.
 */
async function findSprintOrThrow(orgId: string, cycleKey: string, number: number) {
  const { year, month } = parseCycle(cycleKey);

  const sprint = await prisma.sprint.findFirst({
    where: { orgId, number, cycle: { year, month } },
    select: sprintSelect,
  });
  if (!sprint) throw AppError.notFound(`Sprint ${number} does not exist in ${cycleKey}`);

  return sprint;
}

export const sprintsService = {
  /** Every sprint in a month. Any member may read. */
  async list(actor: Actor, slug: string, cycleKey: string) {
    const { org } = await requireOrgMembership(actor, slug);
    const { year, month } = parseCycle(cycleKey);

    const sprints = await prisma.sprint.findMany({
      where: { orgId: org.id, cycle: { year, month } },
      orderBy: { number: 'asc' },
      select: sprintSelect,
    });

    return sprints.map(toDto);
  },

  async getOne(actor: Actor, slug: string, cycleKey: string, number: number) {
    const { org } = await requireOrgMembership(actor, slug);
    return toDto(await findSprintOrThrow(org.id, cycleKey, number));
  },

  /**
   * Create a sprint in a month. Assigner only — and the creator becomes the
   * sprint's assigner, which holds by construction since only assigners get here.
   *
   * The per-cycle number comes from an ATOMIC increment of `Cycle.sprintSeq`.
   * Counting existing sprints and adding one would let two simultaneous creators
   * pick the same number and collide on `@@unique([cycleId, number])`.
   *
   * Deliberately NOT wrapped in an interactive transaction. `UPDATE … SET seq =
   * seq + 1 RETURNING` is atomic by itself, so every caller already leaves with a
   * number nobody else can hold. Wrapping the pair would add a held-open
   * transaction per request, and concurrent creates then contend for Prisma's
   * `maxWait` against a remote database — which fails under exactly the load this
   * is meant to survive.
   *
   * The trade-off is that a failure between the two statements consumes a number
   * and leaves a gap. That is already the documented behaviour for deletes:
   * numbers move forward only and are never reused.
   */
  async create(actor: Actor, slug: string, cycleKey: string, input: CreateSprintInput) {
    const { org } = await requireOrgAssigner(actor, slug);
    // Filing a sprint into a month nobody has opened yet must work.
    const cycle = await ensureCycle(org.id, cycleKey);

    const { sprintSeq } = await prisma.cycle.update({
      where: { id: cycle.id },
      data: { sprintSeq: { increment: 1 } },
      select: { sprintSeq: true },
    });

    const created = await prisma.sprint.create({
      data: {
        cycleId: cycle.id,
        // Denormalised from the cycle — this is the only place it is written,
        // which is what keeps sprint.orgId === sprint.cycle.orgId true.
        orgId: org.id,
        number: sprintSeq,
        name: input.name,
        startsAt: input.startsAt,
        deadline: input.deadline,
        assignerId: actor.id,
      },
      select: sprintSelect,
    });

    return toDto(created);
  },

  /** Rename or re-schedule a sprint. Assigner only. */
  async update(
    actor: Actor,
    slug: string,
    cycleKey: string,
    number: number,
    input: UpdateSprintInput,
  ) {
    const { org } = await requireOrgAssigner(actor, slug);
    const sprint = await findSprintOrThrow(org.id, cycleKey, number);

    // Only one date may be supplied, so the pair is validated against the stored
    // values here rather than in the schema, which cannot read the database.
    const startsAt = input.startsAt ?? sprint.startsAt;
    const deadline = input.deadline ?? sprint.deadline;
    if (deadline <= startsAt) {
      throw AppError.badRequest('The deadline must be after the start date');
    }

    const updated = await prisma.sprint.update({
      where: { id: sprint.id },
      data: { name: input.name, startsAt: input.startsAt, deadline: input.deadline },
      select: sprintSelect,
    });

    return toDto(updated);
  },

  /**
   * Delete a sprint. Assigner only — the same asymmetry as tickets.
   *
   * The number is NOT reused: `Cycle.sprintSeq` only ever moves forward, so a
   * deleted sprint 3 leaves a gap rather than letting a new sprint inherit an old
   * one's identity in links and history.
   */
  async remove(actor: Actor, slug: string, cycleKey: string, number: number) {
    const { org } = await requireOrgAssigner(actor, slug);
    const sprint = await findSprintOrThrow(org.id, cycleKey, number);

    await prisma.sprint.delete({ where: { id: sprint.id } });
    return { id: sprint.id, number: sprint.number };
  },
};
