import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { uploadRoot } from '@/middleware/upload';
import { AppError } from '@/utils/AppError';
import { asyncHandler } from '@/utils/asyncHandler';
import { buildPageMeta, ok } from '@/utils/httpResponse';
import { listTasksQuerySchema } from './tasks.schemas';
import { tasksService } from './tasks.service';

/** Read a route param that the matched route guarantees to exist. */
const param = (req: Request, key: string): string => req.params[key] as string;

export const tasksController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const task = await tasksService.create(req.user!, req.body);
    return ok(res, task, 201);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    // Re-parse to recover the coerced/typed query (validate() already guaranteed validity).
    const query = listTasksQuerySchema.parse(req.query);
    const { items, total } = await tasksService.list(req.user!, query);
    return ok(res, items, 200, buildPageMeta(query.page, query.pageSize, total));
  }),

  getOne: asyncHandler(async (req: Request, res: Response) => {
    const task = await tasksService.getById(req.user!, param(req, 'id'));
    return ok(res, task);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const task = await tasksService.update(req.user!, param(req, 'id'), req.body);
    return ok(res, task);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const result = await tasksService.remove(req.user!, param(req, 'id'));
    return ok(res, result);
  }),

  activity: asyncHandler(async (req: Request, res: Response) => {
    const activities = await tasksService.listActivity(req.user!, param(req, 'id'));
    return ok(res, activities);
  }),

  addAttachment: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw AppError.badRequest('No file provided (field name must be "file")');
    const attachment = await tasksService.addAttachment(req.user!, param(req, 'id'), {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/api/uploads/${req.file.filename}`,
    });
    return ok(res, attachment, 201);
  }),

  removeAttachment: asyncHandler(async (req: Request, res: Response) => {
    const { filename } = await tasksService.removeAttachment(
      req.user!,
      param(req, 'id'),
      param(req, 'attachmentId'),
    );
    // Best-effort cleanup of the file on disk.
    fs.promises
      .unlink(path.join(uploadRoot, filename))
      .catch(() => void 0);
    return ok(res, { success: true });
  }),

  listComments: asyncHandler(async (req: Request, res: Response) => {
    const comments = await tasksService.listComments(req.user!, param(req, 'id'));
    return ok(res, comments);
  }),

  addComment: asyncHandler(async (req: Request, res: Response) => {
    const comment = await tasksService.addComment(req.user!, param(req, 'id'), req.body.body);
    return ok(res, comment, 201);
  }),

  removeComment: asyncHandler(async (req: Request, res: Response) => {
    const result = await tasksService.removeComment(
      req.user!,
      param(req, 'id'),
      param(req, 'commentId'),
    );
    return ok(res, result);
  }),
};
