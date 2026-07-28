import type { Role } from '@prisma/client';

/**
 * The authenticated caller. Mirrors what `requireAuth` puts on `req.user`, so
 * services can take an `Actor` without depending on Express.
 *
 * `role` here is the PLATFORM role (USER | ADMIN). A caller's role *inside an
 * organisation* is a different thing entirely and is never carried on the token
 * — it is looked up per request. See docs/architecture.md §3.
 */
export interface Actor {
  id: string;
  email: string;
  role: Role;
}
