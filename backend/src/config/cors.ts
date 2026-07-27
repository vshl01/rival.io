import type { CorsOptions } from 'cors';
import { env } from '@/config/env';

/**
 * Single CORS policy, shared by the REST API and the Socket.IO handshake so the
 * two can't drift apart.
 *
 * Requests with no `Origin` header (curl, uptime monitors, server-to-server)
 * pass through: CORS governs what a *browser* lets one site read from another,
 * so rejecting origin-less requests buys no security and breaks health checks.
 *
 * Disallowed origins get `callback(null, false)` rather than an error — the
 * response simply carries no `Access-Control-Allow-Origin`, so the browser
 * refuses to expose it to the caller. Throwing here would surface as a 500.
 */
export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || env.corsAllowAll || env.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (!env.isTest) {
      // eslint-disable-next-line no-console
      console.warn(`[cors] blocked origin: ${origin}`);
    }
    callback(null, false);
  },
  credentials: true,
};
