import { Router } from 'express';
import { requireAuth } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { cyclesRouter } from '@/modules/cycles/cycles.routes';
import { orgMembersRouter } from '@/modules/org-members/org-members.routes';
import { orgsController } from './orgs.controller';
import {
  createOrgSchema,
  orgDirectoryQuerySchema,
  orgSlugParamSchema,
  updateOrgSchema,
} from './orgs.schemas';

export const orgsRouter = Router();

// Every organisation route requires authentication.
orgsRouter.use(requireAuth);

// Declared before "/:slug", otherwise "directory" is matched as an org slug.
orgsRouter.get(
  '/directory',
  validate({ query: orgDirectoryQuerySchema }),
  orgsController.directory,
);

orgsRouter
  .route('/')
  .get(orgsController.listMine)
  .post(validate({ body: createOrgSchema }), orgsController.create);

orgsRouter
  .route('/:slug')
  .get(validate({ params: orgSlugParamSchema }), orgsController.getOne)
  .patch(validate({ params: orgSlugParamSchema, body: updateOrgSchema }), orgsController.update);

// Membership and join requests live under the org they belong to:
//   /api/orgs/:slug/members            /api/orgs/:slug/join-requests
orgsRouter.use('/:slug', orgMembersRouter);

// Months, and the sprints inside them:
//   /api/orgs/:slug/cycles             /api/orgs/:slug/cycles/2026-07/sprints/3
orgsRouter.use('/:slug/cycles', cyclesRouter);
