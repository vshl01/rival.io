-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('ASSIGNER', 'WORKER');

-- CreateEnum
CREATE TYPE "JoinStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ticketSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_memberships" (
    "id" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'WORKER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "org_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "join_requests" (
    "id" TEXT NOT NULL,
    "status" "JoinStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decidedById" TEXT,

    CONSTRAINT "join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "sprintSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprints" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cycleId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assignerId" TEXT NOT NULL,

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_key_key" ON "organizations"("key");

-- CreateIndex
CREATE INDEX "organizations_createdById_idx" ON "organizations"("createdById");

-- CreateIndex
CREATE INDEX "org_memberships_userId_idx" ON "org_memberships"("userId");

-- CreateIndex
CREATE INDEX "org_memberships_orgId_role_idx" ON "org_memberships"("orgId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "org_memberships_orgId_userId_key" ON "org_memberships"("orgId", "userId");

-- CreateIndex
CREATE INDEX "join_requests_orgId_status_idx" ON "join_requests"("orgId", "status");

-- CreateIndex
CREATE INDEX "join_requests_userId_status_idx" ON "join_requests"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cycles_orgId_year_month_key" ON "cycles"("orgId", "year", "month");

-- CreateIndex
CREATE INDEX "sprints_orgId_startsAt_idx" ON "sprints"("orgId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "sprints_cycleId_number_key" ON "sprints"("cycleId", "number");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_assignerId_fkey" FOREIGN KEY ("assignerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: one PENDING join request per (org, user).
-- Prisma cannot express a partial unique index, so this is maintained by hand.
-- It must stay in sync with orgMembersService.requestToJoin, which performs the
-- same check to return a friendly 409 instead of a raw constraint error.
-- Rejected/accepted rows are intentionally excluded so a person can re-apply.
CREATE UNIQUE INDEX "join_requests_orgId_userId_pending_key"
  ON "join_requests" ("orgId", "userId")
  WHERE "status" = 'PENDING';
