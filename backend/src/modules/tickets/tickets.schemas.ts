import { z } from 'zod';

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const SORT_FIELDS = ['dueDate', 'priority', 'createdAt', 'updatedAt', 'title'] as const;

// Accept ISO strings or null; coerce to Date. `null` clears the due date.
const dueDate = z
  .union([z.string().datetime({ offset: true }), z.string().date(), z.null()])
  .transform((v) => (v === null ? null : new Date(v)));

export const createTicketSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  status: z.enum(TASK_STATUSES).default('TODO'),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  dueDate: dueDate.optional(),
  /**
   * Only meaningful for a sprint ticket — a personal task has nobody to assign
   * it to. The service verifies the assignee belongs to the organisation.
   */
  assigneeId: z.string().min(1).optional().nullable(),
});

// All fields optional on update, but at least one must be present.
export const updateTicketSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).nullable(),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(PRIORITIES),
    dueDate,
    /** `null` unassigns. Any member may reassign to any other member. */
    assigneeId: z.string().min(1).nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const ticketIdParamSchema = z.object({
  id: z.string().min(1),
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
});

export const listTicketsQuerySchema = z.object({
  // Filtering
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  search: z.string().trim().max(200).optional(),
  // Admin-only: view a specific user's personal tasks (ignored for non-admins).
  ownerId: z.string().optional(),
  // Sorting
  sortBy: z.enum(SORT_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
