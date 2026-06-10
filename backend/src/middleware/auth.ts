import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '@/lib/jwt';
import { AppError } from '@/utils/AppError';

/**
 * Require a valid Bearer access token. Populates `req.user`.
 * Tokens are read from the `Authorization` header (preferred for SPAs).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing Bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyAccessToken(token);
  req.user = { id: payload.sub, email: payload.email, role: payload.role };
  next();
}

/** Require the authenticated user to be an ADMIN. Must run after `requireAuth`. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw AppError.unauthorized();
  if (req.user.role !== 'ADMIN') {
    throw AppError.forbidden('Admin privileges required');
  }
  next();
}
