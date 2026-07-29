import { Router } from 'express';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAuth } from '@/middleware/auth';
import { orgMembersService } from '@/modules/org-members/org-members.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/httpResponse';

export const usersRouter = Router();

// The caller's own join requests across every org. Lives here rather than under
// /orgs/:slug because it spans organisations — it answers "where have I applied?".
usersRouter.get(
  '/me/join-requests',
  requireAuth,
  asyncHandler(async (req, res) => {
    const requests = await orgMembersService.listMyJoinRequests(req.user!);
    return ok(res, requests);
  }),
);

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
        // Personal tasks and org tickets both live in `tickets`.
        _count: { select: { tickets: true } },
      },
    });
    return ok(res, users);
  }),
);
