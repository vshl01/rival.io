import { z } from 'zod';

/**
 * These routes are mounted under `/api/orgs/:slug`, so every params schema
 * carries `slug` as well as its own identifier.
 */
const slug = z.string().trim().min(1);

export const memberParamSchema = z.object({ slug, userId: z.string().trim().min(1) });

export const joinRequestParamSchema = z.object({ slug, requestId: z.string().trim().min(1) });

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ASSIGNER', 'WORKER']),
});

export const createJoinRequestSchema = z.object({
  /** Optional note to the assigner: "I'm on the design team". */
  message: z.string().trim().max(280).optional(),
});

export const listJoinRequestsQuerySchema = z.object({
  // Pending is what an assigner almost always wants, so it is the default.
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED']).default('PENDING'),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type CreateJoinRequestInput = z.infer<typeof createJoinRequestSchema>;
export type ListJoinRequestsQuery = z.infer<typeof listJoinRequestsQuerySchema>;
