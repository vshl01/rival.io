import { Router } from 'express';
import { validate } from '@/middleware/validate';
import { sprintTicketsRouter } from '@/modules/tickets/tickets.routes';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/httpResponse';
import {
  createSprintSchema,
  sprintCollectionParamSchema,
  sprintParamSchema,
  updateSprintSchema,
} from './sprints.schemas';
import { sprintsService } from './sprints.service';

/**
 * Mounted at `/api/orgs/:slug/cycles/:cycle/sprints`, so `mergeParams` carries
 * both `slug` and `cycle` down. Authentication comes from the orgs router.
 *
 * The URL mirrors the UI exactly — /dashboard/acme/2026-07/3 maps to
 * /api/orgs/acme/cycles/2026-07/sprints/3 — so a sprint has one identity across
 * the whole product.
 */
export const sprintsRouter = Router({ mergeParams: true });

const slugOf = (req: { params: Record<string, string | undefined> }) => req.params.slug as string;
const cycleOf = (req: { params: Record<string, string | undefined> }) => req.params.cycle as string;

sprintsRouter
  .route('/')
  .get(
    validate({ params: sprintCollectionParamSchema }),
    asyncHandler(async (req, res) =>
      ok(res, await sprintsService.list(req.user!, slugOf(req), cycleOf(req))),
    ),
  )
  .post(
    validate({ params: sprintCollectionParamSchema, body: createSprintSchema }),
    asyncHandler(async (req, res) =>
      ok(res, await sprintsService.create(req.user!, slugOf(req), cycleOf(req), req.body), 201),
    ),
  );

sprintsRouter
  .route('/:number')
  .get(
    validate({ params: sprintParamSchema }),
    asyncHandler(async (req, res) =>
      ok(
        res,
        await sprintsService.getOne(req.user!, slugOf(req), cycleOf(req), Number(req.params.number)),
      ),
    ),
  )
  .patch(
    validate({ params: sprintParamSchema, body: updateSprintSchema }),
    asyncHandler(async (req, res) =>
      ok(
        res,
        await sprintsService.update(
          req.user!,
          slugOf(req),
          cycleOf(req),
          Number(req.params.number),
          req.body,
        ),
      ),
    ),
  )
  .delete(
    validate({ params: sprintParamSchema }),
    asyncHandler(async (req, res) =>
      ok(
        res,
        await sprintsService.remove(req.user!, slugOf(req), cycleOf(req), Number(req.params.number)),
      ),
    ),
  );

// The board for a sprint:
//   /api/orgs/:slug/cycles/:cycle/sprints/:number/tickets
sprintsRouter.use('/:number/tickets', sprintTicketsRouter);
