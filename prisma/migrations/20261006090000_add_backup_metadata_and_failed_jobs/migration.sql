-- Packet C3: encrypted-backup metadata on backup_logs and a durable dead-letter table. Additive only.

-- AlterTable
ALTER TABLE "backup_logs" ADD COLUMN     "encrypted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "formatVersion" INTEGER,
ADD COLUMN     "sha256" TEXT;

-- CreateTable
CREATE TABLE "failed_jobs" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "payloadKeys" TEXT[],
    "failedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retriedAt" TIMESTAMP(3),
    "retriedBy" TEXT,

    CONSTRAINT "failed_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "failed_jobs_failedAt_idx" ON "failed_jobs"("failedAt");

-- CreateIndex
CREATE UNIQUE INDEX "failed_jobs_queue_jobId_key" ON "failed_jobs"("queue", "jobId");

-- CreateIndex
CREATE INDEX "backup_logs_type_status_completedAt_idx" ON "backup_logs"("type", "status", "completedAt");
