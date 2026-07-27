# Debian-slim (not Alpine): Prisma's engines need glibc + OpenSSL, and slim
# avoids the musl/OpenSSL incompatibilities that break `prisma migrate` on Alpine.

# ─── Build stage ────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

# Generate Prisma client + compile TypeScript
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Runtime stage ──────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Production deps only (prisma CLI + tsx are in dependencies, so migrate & seed work here)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Regenerate the client for this image, then bring in the compiled app
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=builder /app/dist ./dist

# Non-root user; uploads dir owned by it
RUN groupadd -r app && useradd -r -g app -m app \
  && mkdir -p uploads && chown -R app:app /app
USER app

EXPOSE 4000
# On boot: apply migrations, then start. `migrate deploy` is safe to re-run on
# every deploy. Seeding is deliberately NOT part of boot — run it by hand on a
# fresh database: `npm run db:seed`.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
