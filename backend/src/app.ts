import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { corsOptions } from '@/config/cors';
import { env } from '@/config/env';
import { uploadRoot } from '@/middleware/upload';
import { errorHandler, notFoundHandler } from '@/middleware/error';
import { authRouter } from '@/modules/auth/auth.routes';
import { tasksRouter } from '@/modules/tasks/tasks.routes';
import { usersRouter } from '@/modules/users/users.routes';

/**
 * Build the Express application. Kept separate from `server.ts` so tests can
 * import a fresh app without binding a port or starting Socket.IO.
 */
export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1); // correct client IPs behind a proxy (rate limiting)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // Health check — used by docker-compose and uptime monitors.
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // Serve uploaded files (read-only). Auth is intentionally relaxed here so
  // <img src> works; filenames are unguessable UUIDs.
  app.use(
    '/api/uploads',
    express.static(uploadRoot, { index: false, dotfiles: 'deny', maxAge: '1h' }),
  );

  // Feature routers
  app.use('/api/auth', authRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/users', usersRouter);

  // 404 + centralized error handling (must be last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
