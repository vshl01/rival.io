import { Router } from 'express';
import { validate } from '@/middleware/validate';
import { orgMembersController } from './org-members.controller';
import {
  createJoinRequestSchema,
  joinRequestParamSchema,
  listJoinRequestsQuerySchema,
  memberParamSchema,
  updateMemberRoleSchema,
} from './org-members.schemas';

/**
 * Mounted at `/api/orgs/:slug` by orgs.routes, so `mergeParams` is required for
 * `:slug` to reach these handlers. Authentication is already applied by the
 * parent router.
 */
export const orgMembersRouter = Router({ mergeParams: true });

// ── Roster ────────────────────────────────────────────────────────────────────
orgMembersRouter.get('/members', orgMembersController.listMembers);

orgMembersRouter
  .route('/members/:userId')
  .patch(
    validate({ params: memberParamSchema, body: updateMemberRoleSchema }),
    orgMembersController.updateRole,
  )
  .delete(validate({ params: memberParamSchema }), orgMembersController.removeMember);

/** Leaving is self-service, so it is a separate path from removing someone. */
orgMembersRouter.delete('/membership', orgMembersController.leave);

// ── Join requests ─────────────────────────────────────────────────────────────
orgMembersRouter
  .route('/join-requests')
  .get(validate({ query: listJoinRequestsQuerySchema }), orgMembersController.listJoinRequests)
  .post(validate({ body: createJoinRequestSchema }), orgMembersController.requestToJoin);

orgMembersRouter.post(
  '/join-requests/:requestId/accept',
  validate({ params: joinRequestParamSchema }),
  orgMembersController.acceptJoinRequest,
);

orgMembersRouter.post(
  '/join-requests/:requestId/reject',
  validate({ params: joinRequestParamSchema }),
  orgMembersController.rejectJoinRequest,
);
