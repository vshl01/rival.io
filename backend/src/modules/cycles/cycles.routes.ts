import { Router } from 'express';
import { validate } from '@/middleware/validate';
import { sprintsRouter } from '@/modules/sprints/sprints.routes';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/httpResponse';
import { cycleParamSchema, cycleWindowQuerySchema } from './cycles.schemas';
import { cyclesService } from './cycles.service';

/**
 * Mounted at `/api/orgs/:slug` by orgs.routes, so `mergeParams` is required for
 * `:slug` to reach these handlers. Authentication comes from the parent router.
 */
export const cyclesRouter = Router({ mergeParams: true });

/** The rolling window — current month plus the next two by default. */
cyclesRouter.get(
  '/',
  validate({ query: cycleWindowQuerySchema }),
  asyncHandler(async (req, res) => {
    // Re-parse to recover the coerced/typed query (validate() already guaranteed validity).
    const query = cycleWindowQuerySchema.parse(req.query);
    return ok(res, await cyclesService.listWindow(req.user!, req.params.slug as string, query));
  }),
);

cyclesRouter.get(
  '/:cycle',
  validate({ params: cycleParamSchema }),
  asyncHandler(async (req, res) =>
    ok(
      res,
      await cyclesService.getOne(req.user!, req.params.slug as string, req.params.cycle as string),
    ),
  ),
);

// Sprints live inside the month they belong to:
//   /api/orgs/:slug/cycles/:cycle/sprints
cyclesRouter.use('/:cycle/sprints', sprintsRouter);
