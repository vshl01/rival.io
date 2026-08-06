import { z } from 'zod';
import { CYCLE_PATTERN } from '@/modules/cycles/cycles.schemas';

const slug = z.string().trim().min(1);
const cycle = z.string().trim().regex(CYCLE_PATTERN, 'Use a YYYY-MM month, e.g. 2026-07');

export const sprintParamSchema = z.object({
  slug,
  cycle,
  /** The human-readable per-cycle number from the URL, e.g. /2026-07/3. */
  number: z.coerce.number().int().positive(),
});

export const sprintCollectionParamSchema = z.object({ slug, cycle });

/**
 * Two date rules, and they live in different places:
 *
 *  · ends after it starts — here, since both values are in the request.
 *  · STARTS inside the month it is filed under — in the service, because the
 *    cycle key is a path parameter the schema cannot see. See
 *    `assertStartsInCycle` and docs/architecture.md §2.
 *
 * The deadline may fall outside the month; only the start is clamped.
 */
const dateRange = {
  startsAt: z.coerce.date(),
  deadline: z.coerce.date(),
};

const endsAfterItStarts = <T extends { startsAt: Date; deadline: Date }>(value: T) =>
  value.deadline > value.startsAt;

export const createSprintSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is too short').max(80),
    ...dateRange,
  })
  .refine(endsAfterItStarts, {
    message: 'The deadline must be after the start date',
    path: ['deadline'],
  });

/**
 * Updates are all-or-nothing on the date pair: validating one date against a
 * stored counterpart would need a database read inside the schema, so the
 * service checks a partial date change instead.
 */
export const updateSprintSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    startsAt: z.coerce.date().optional(),
    deadline: z.coerce.date().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export type CreateSprintInput = z.infer<typeof createSprintSchema>;
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;
