import type { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/httpResponse';
import { listJoinRequestsQuerySchema } from './org-members.schemas';
import { orgMembersService } from './org-members.service';

/** Read a route param that the matched route guarantees to exist. */
const param = (req: Request, key: string): string => req.params[key] as string;

export const orgMembersController = {
  listMembers: asyncHandler(async (req: Request, res: Response) => {
    const members = await orgMembersService.listMembers(req.user!, param(req, 'slug'));
    return ok(res, members);
  }),

  updateRole: asyncHandler(async (req: Request, res: Response) => {
    const member = await orgMembersService.updateRole(
      req.user!,
      param(req, 'slug'),
      param(req, 'userId'),
      req.body,
    );
    return ok(res, member);
  }),

  removeMember: asyncHandler(async (req: Request, res: Response) => {
    const result = await orgMembersService.removeMember(
      req.user!,
      param(req, 'slug'),
      param(req, 'userId'),
    );
    return ok(res, result);
  }),

  leave: asyncHandler(async (req: Request, res: Response) => {
    const result = await orgMembersService.leave(req.user!, param(req, 'slug'));
    return ok(res, result);
  }),

  requestToJoin: asyncHandler(async (req: Request, res: Response) => {
    const request = await orgMembersService.requestToJoin(
      req.user!,
      param(req, 'slug'),
      req.body,
    );
    return ok(res, request, 201);
  }),

  listJoinRequests: asyncHandler(async (req: Request, res: Response) => {
    // Re-parse to recover the coerced/typed query (validate() already guaranteed validity).
    const query = listJoinRequestsQuerySchema.parse(req.query);
    const requests = await orgMembersService.listJoinRequests(
      req.user!,
      param(req, 'slug'),
      query,
    );
    return ok(res, requests);
  }),

  acceptJoinRequest: asyncHandler(async (req: Request, res: Response) => {
    const decided = await orgMembersService.decideJoinRequest(
      req.user!,
      param(req, 'slug'),
      param(req, 'requestId'),
      true,
    );
    return ok(res, decided);
  }),

  rejectJoinRequest: asyncHandler(async (req: Request, res: Response) => {
    const decided = await orgMembersService.decideJoinRequest(
      req.user!,
      param(req, 'slug'),
      param(req, 'requestId'),
      false,
    );
    return ok(res, decided);
  }),
};
