import { z } from 'zod';

/** kebab-case, no leading/trailing/double dashes — safe as a URL segment. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Ticket prefix: starts with a letter, 2-6 chars, e.g. ACME → ACME-142. */
const KEY_PATTERN = /^[A-Z][A-Z0-9]{1,5}$/;

export const createOrgSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(60),
  // Both are derived from `name` when omitted, which is the normal path.
  // They are accepted explicitly so a user can correct an ugly derivation.
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and single dashes')
    .optional(),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(KEY_PATTERN, 'Use 2-6 characters starting with a letter, e.g. ACME')
    .optional(),
});

export const updateOrgSchema = z.object({
  name: z.string().trim().min(2).max(60),
});

export const orgSlugParamSchema = z.object({
  slug: z.string().trim().min(1),
});

export const orgDirectoryQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;
export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
export type OrgDirectoryQuery = z.infer<typeof orgDirectoryQuerySchema>;
