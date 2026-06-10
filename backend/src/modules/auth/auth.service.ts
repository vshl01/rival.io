import type { User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/jwt';
import { hashPassword, verifyPassword } from '@/lib/password';
import { AppError } from '@/utils/AppError';
import type { LoginInput, SignupInput } from './auth.schemas';

/** Public-safe user shape — never leaks the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: User['role'];
  createdAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function issueTokens(user: User) {
  return {
    accessToken: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    refreshToken: signRefreshToken(user.id),
  };
}

export const authService = {
  async signup(input: SignupInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw AppError.conflict('An account with that email already exists');

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
      },
    });

    return { user: toPublicUser(user), ...issueTokens(user) };
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    // Constant-ish failure path: verify against a dummy hash to reduce timing
    // signal on whether the email exists.
    const valid = user
      ? await verifyPassword(input.password, user.passwordHash)
      : await verifyPassword(input.password, '$2a$12$0000000000000000000000.0000000000000000000000000000000');

    if (!user || !valid) throw AppError.unauthorized('Invalid email or password');

    return { user: toPublicUser(user), ...issueTokens(user) };
  },

  /** Exchange a valid refresh token for a fresh access (and rotated refresh) token. */
  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw AppError.unauthorized('Account no longer exists');
    return { user: toPublicUser(user), ...issueTokens(user) };
  },

  async getById(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw AppError.notFound('User not found');
    return toPublicUser(user);
  },
};
