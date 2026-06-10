import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '@/utils/AppError';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validate and coerce `body` / `query` / `params` against Zod schemas.
 * Parsed (typed, coerced) values replace the raw request fields so handlers
 * receive clean data. Validation errors become a 400 with field-level details.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query) as Request['query'];
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(AppError.badRequest('Validation failed', { fieldErrors: err.flatten().fieldErrors }));
        return;
      }
      next(err);
    }
  };
}
