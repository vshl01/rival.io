import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { authController } from './auth.controller';
import { loginSchema, signupSchema } from './auth.schemas';

// Throttle credential endpoints to blunt brute-force / enumeration attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, try again later' } },
});

export const authRouter = Router();

authRouter.post('/signup', authLimiter, validate({ body: signupSchema }), authController.signup);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', requireAuth, authController.me);
