import type { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Populated by `requireAuth`. Present on every protected route. */
      user?: {
        id: string;
        email: string;
        role: Role;
      };
    }
  }
}

export {};
