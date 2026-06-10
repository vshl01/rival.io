import { PrismaClient } from '@prisma/client';
import { env } from '@/config/env';

/**
 * Single PrismaClient instance per process. In dev, `tsx watch` reloads the
 * module graph on every change — caching on `globalThis` prevents exhausting
 * the connection pool with a new client on each reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProd ? ['error'] : ['warn', 'error'],
  });

if (!env.isProd) globalForPrisma.prisma = prisma;
