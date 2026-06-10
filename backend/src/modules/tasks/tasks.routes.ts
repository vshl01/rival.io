import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import { upload } from '@/middleware/upload';
import { validate } from '@/middleware/validate';
import { tasksController } from './tasks.controller';
import {
  createCommentSchema,
  createTaskSchema,
  listTasksQuerySchema,
  taskIdParamSchema,
  updateTaskSchema,
} from './tasks.schemas';

export const tasksRouter = Router();

// Every task route requires authentication.
tasksRouter.use(requireAuth);

tasksRouter
  .route('/')
  .get(validate({ query: listTasksQuerySchema }), tasksController.list)
  .post(validate({ body: createTaskSchema }), tasksController.create);

tasksRouter
  .route('/:id')
  .get(validate({ params: taskIdParamSchema }), tasksController.getOne)
  .patch(validate({ params: taskIdParamSchema, body: updateTaskSchema }), tasksController.update)
  .delete(validate({ params: taskIdParamSchema }), tasksController.remove);

tasksRouter.get(
  '/:id/activity',
  validate({ params: taskIdParamSchema }),
  tasksController.activity,
);

tasksRouter.post(
  '/:id/attachments',
  validate({ params: taskIdParamSchema }),
  upload.single('file'),
  tasksController.addAttachment,
);

tasksRouter.delete(
  '/:id/attachments/:attachmentId',
  tasksController.removeAttachment,
);

// Comments / discussion thread
tasksRouter.get('/:id/comments', validate({ params: taskIdParamSchema }), tasksController.listComments);
tasksRouter.post(
  '/:id/comments',
  validate({ params: taskIdParamSchema, body: createCommentSchema }),
  tasksController.addComment,
);
tasksRouter.delete('/:id/comments/:commentId', tasksController.removeComment);
