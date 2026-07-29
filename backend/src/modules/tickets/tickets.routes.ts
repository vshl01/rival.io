import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import { upload } from '@/middleware/upload';
import { validate } from '@/middleware/validate';
import { sprintTicketsController, ticketsController } from './tickets.controller';
import {
  createCommentSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  ticketIdParamSchema,
  updateTicketSchema,
} from './tickets.schemas';

export const personalTasksRouter = Router();

// Every task route requires authentication.
personalTasksRouter.use(requireAuth);

personalTasksRouter
  .route('/')
  .get(validate({ query: listTicketsQuerySchema }), ticketsController.list)
  .post(validate({ body: createTicketSchema }), ticketsController.create);

personalTasksRouter
  .route('/:id')
  .get(validate({ params: ticketIdParamSchema }), ticketsController.getOne)
  .patch(validate({ params: ticketIdParamSchema, body: updateTicketSchema }), ticketsController.update)
  .delete(validate({ params: ticketIdParamSchema }), ticketsController.remove);

personalTasksRouter.get(
  '/:id/activity',
  validate({ params: ticketIdParamSchema }),
  ticketsController.activity,
);

personalTasksRouter.post(
  '/:id/attachments',
  validate({ params: ticketIdParamSchema }),
  upload.single('file'),
  ticketsController.addAttachment,
);

personalTasksRouter.delete(
  '/:id/attachments/:attachmentId',
  ticketsController.removeAttachment,
);

// Comments / discussion thread
personalTasksRouter.get('/:id/comments', validate({ params: ticketIdParamSchema }), ticketsController.listComments);
personalTasksRouter.post(
  '/:id/comments',
  validate({ params: ticketIdParamSchema, body: createCommentSchema }),
  ticketsController.addComment,
);
personalTasksRouter.delete('/:id/comments/:commentId', ticketsController.removeComment);

/**
 * Tickets inside one sprint. Mounted by sprints.routes at
 * `/api/orgs/:slug/cycles/:cycle/sprints/:number/tickets`, so `mergeParams`
 * carries slug, cycle and number down. Auth comes from the orgs router.
 *
 * Only the collection lives here: a single ticket is addressed by id through
 * `/api/tasks/:id`, which serves both kinds and lets the policy layer decide.
 */
export const sprintTicketsRouter = Router({ mergeParams: true });

sprintTicketsRouter
  .route('/')
  .get(sprintTicketsController.list)
  .post(validate({ body: createTicketSchema }), sprintTicketsController.create);
