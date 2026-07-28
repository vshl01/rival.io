import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { buildPageMeta, ok } from '@/utils/httpResponse';
import { orgDirectoryQuerySchema } from './orgs.schemas';
import { orgsService } from './orgs.service';

/** Read a route param that the matched route guarantees to exist. */
const param = (req: Request, key: string): string => req.params[key] as string;

export const orgsController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const org = await orgsService.create(req.user!, req.body);
    return ok(res, org, 201);
  }),

  listMine: asyncHandler(async (req: Request, res: Response) => {
    const orgs = await orgsService.listMine(req.user!);
    return ok(res, orgs);
  }),

  directory: asyncHandler(async (req: Request, res: Response) => {
    // Re-parse to recover the coerced/typed query (validate() already guaranteed validity).
    const query = orgDirectoryQuerySchema.parse(req.query);
    const { items, total } = await orgsService.directory(req.user!, query);
    return ok(res, items, 200, buildPageMeta(query.page, query.pageSize, total));
  }),

  getOne: asyncHandler(async (req: Request, res: Response) => {
    const org = await orgsService.getBySlug(req.user!, param(req, 'slug'));
    return ok(res, org);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const org = await orgsService.update(req.user!, param(req, 'slug'), req.body);
    return ok(res, org);
  }),
};
