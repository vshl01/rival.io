-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_taskId_fkey";

-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_taskId_fkey";

-- DropForeignKey
ALTER TABLE "comments" DROP CONSTRAINT "comments_taskId_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_ownerId_fkey";

-- DropIndex
DROP INDEX "activities_taskId_createdAt_idx";

-- DropIndex
DROP INDEX "attachments_taskId_idx";

-- DropIndex
DROP INDEX "comments_taskId_createdAt_idx";

-- AlterTable
ALTER TABLE "activities" DROP COLUMN "taskId",
ADD COLUMN     "ticketId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "attachments" DROP COLUMN "taskId",
ADD COLUMN     "ticketId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "comments" DROP COLUMN "taskId",
ADD COLUMN     "ticketId" TEXT NOT NULL;

-- DropTable
DROP TABLE "tasks";

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "key" TEXT,
    "createdById" TEXT NOT NULL,
    "assigneeId" TEXT,
    "sprintId" TEXT,
    "orgId" TEXT,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tickets_createdById_status_idx" ON "tickets"("createdById", "status");

-- CreateIndex
CREATE INDEX "tickets_createdById_dueDate_idx" ON "tickets"("createdById", "dueDate");

-- CreateIndex
CREATE INDEX "tickets_createdById_priority_idx" ON "tickets"("createdById", "priority");

-- CreateIndex
CREATE INDEX "tickets_createdById_createdAt_idx" ON "tickets"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "tickets_sprintId_status_idx" ON "tickets"("sprintId", "status");

-- CreateIndex
CREATE INDEX "tickets_sprintId_priority_idx" ON "tickets"("sprintId", "priority");

-- CreateIndex
CREATE INDEX "tickets_assigneeId_status_idx" ON "tickets"("assigneeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_orgId_key_key" ON "tickets"("orgId", "key");

-- CreateIndex
CREATE INDEX "activities_ticketId_createdAt_idx" ON "activities"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "attachments_ticketId_idx" ON "attachments"("ticketId");

-- CreateIndex
CREATE INDEX "comments_ticketId_createdAt_idx" ON "comments"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

