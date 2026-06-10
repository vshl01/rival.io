import type { CookieOptions, Request, Response } from 'express';
import { env } from '@/config/env';
import { AppError } from '@/utils/AppError';
import { asyncHandler } from '@/utils/asyncHandler';
import { ok } from '@/utils/httpResponse';
import { authService } from './auth.service';

const REFRESH_COOKIE = 'rival_refresh';

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SECURE ? 'none' : 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions);
}

export const authController = {
  signup: asyncHandler(async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await authService.signup(req.body);
    setRefreshCookie(res, refreshToken);
    return ok(res, { user, accessToken }, 201);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await authService.login(req.body);
    setRefreshCookie(res, refreshToken);
    return ok(res, { user, accessToken });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw AppError.unauthorized('No refresh token');
    const { user, accessToken, refreshToken } = await authService.refresh(token);
    setRefreshCookie(res, refreshToken); // rotate
    return ok(res, { user, accessToken });
  }),

  logout: asyncHandler(async (_req: Request, res: Response) => {
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions, maxAge: undefined });
    return ok(res, { success: true });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getById(req.user!.id);
    return ok(res, { user });
  }),
};
