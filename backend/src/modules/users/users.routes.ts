import { Router } from 'express';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAuth } from '@/middleware/auth';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/httpResponse';

export const usersRouter = Router();

// Admin-only: list every user with task counts, for the admin console's
// "view any user's tasks" feature.
usersRouter.get(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { tasks: true } },
      },
    });
    return ok(res, users);
  }),
);
