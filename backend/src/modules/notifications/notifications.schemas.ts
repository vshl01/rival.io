import { z } from 'zod';

/**
 * NOTE: every field here must be IDEMPOTENT under re-parsing.
 *
 * `validate()` replaces `req.query` with the parsed result, and the handler then
 * parses it again to recover the typed value. A one-way `transform` (string →
 * boolean) therefore fails on the second pass, because the input is already a
 * boolean. Accepting both shapes keeps it safe to parse any number of times.
 */
export const listNotificationsQuerySchema = z.object({
  /** The drawer's "Unread" filter — arrives as the string "true" from the URL. */
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .default(false),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

export const notificationIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
