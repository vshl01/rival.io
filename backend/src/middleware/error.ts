import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ZodError } from 'zod';
import { env } from '@/config/env';
import { AppError } from '@/utils/AppError';

/** 404 for any route that didn't match. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`));
}

/**
 * Central error handler. Maps known error types to consistent envelopes:
 *   { error: { code, message, details? } }
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong';
  let details: unknown;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    code = 'BAD_REQUEST';
    message = 'Validation failed';
    details = { fieldErrors: err.flatten().fieldErrors };
  } else if (err instanceof multer.MulterError) {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = err.code;
    message = err.message;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      code = 'CONFLICT';
      message = 'A record with that value already exists';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      code = 'NOT_FOUND';
      message = 'Resource not found';
    } else {
      statusCode = 400;
      code = 'DB_ERROR';
      message = 'Database request failed';
    }
  } else if (err instanceof Error) {
    message = err.message || message;
  }

  // Log unexpected (non-operational) errors with the stack for observability.
  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }

  const body: Record<string, unknown> = { error: { code, message } };
  if (details !== undefined) (body.error as Record<string, unknown>).details = details;
  if (!env.isProd && err instanceof Error && statusCode >= 500) {
    (body.error as Record<string, unknown>).stack = err.stack;
  }

  res.status(statusCode).json(body);
}
