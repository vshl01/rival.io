import { z } from 'zod';

/**
 * A cycle is addressed by calendar month, not by id: `2026-07`.
 *
 * That keeps the URL readable and shareable (/dashboard/acme/2026-07/3) and means
 * the client never has to look an id up before it can navigate.
 */
export const CYCLE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

const slug = z.string().trim().min(1);

export const cycleParamSchema = z.object({
  slug,
  cycle: z.string().trim().regex(CYCLE_PATTERN, 'Use a YYYY-MM month, e.g. 2026-07'),
});

/**
 * How many months to return, counting the current one.
 *
 * Defaults to 3 — "this month and the next two" — which is the product decision
 * in docs/architecture.md §2. Capped so a caller cannot ask us to upsert years
 * of empty cycles in one request.
 */
export const cycleWindowQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(12).default(3),
});

/** Parse "2026-07" into its parts. Assumes the pattern already matched. */
export function parseCycle(cycle: string): { year: number; month: number } {
  const [year, month] = cycle.split('-');
  return { year: Number(year), month: Number(month) };
}

/** Inverse of `parseCycle` — the canonical string form, zero-padded. */
export function formatCycle(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export type CycleWindowQuery = z.infer<typeof cycleWindowQuerySchema>;
