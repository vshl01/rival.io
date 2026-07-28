import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { asyncHandler } from '@/utils/asyncHandler';
import { buildPageMeta, ok } from '@/utils/httpResponse';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from './notifications.schemas';
import { notificationsService } from './notifications.service';

export const notificationsRouter = Router();

// Notifications are always personal — there is no cross-user read path.
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  validate({ query: listNotificationsQuerySchema }),
  asyncHandler(async (req, res) => {
    // Re-parse to recover the coerced/typed query (validate() already guaranteed validity).
    const query = listNotificationsQuerySchema.parse(req.query);
    const { items, total, unread } = await notificationsService.list(req.user!, query);
    return ok(res, items, 200, { ...buildPageMeta(query.page, query.pageSize, total), unread });
  }),
);

// Declared before "/:id/read" would ever be considered; keeps the badge cheap.
notificationsRouter.get(
  '/unread-count',
  asyncHandler(async (req, res) => ok(res, await notificationsService.unreadCount(req.user!))),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => ok(res, await notificationsService.markAllRead(req.user!))),
);

notificationsRouter.post(
  '/:id/read',
  validate({ params: notificationIdParamSchema }),
  asyncHandler(async (req, res) =>
    ok(res, await notificationsService.markRead(req.user!, req.params.id as string)),
  ),
);
