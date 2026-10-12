-- Packet C3.1: concurrency-safe operational alerts and dead-letter retries. Additive only.
--
-- ops_alert_states: one row per alert condition. The rate limit is decided by a single
-- atomic UPDATE on this row (not read-then-write); claimedAt/claimToken is a short lease
-- held while the e-mail is sent, so two replicas cannot both send and a failed send can
-- be retried.
--
-- failed_jobs.retry*: a lease taken BEFORE a dead-lettered job is re-queued in Redis, so
-- two simultaneous retries cannot both call Redis; plus the redacted reason a retry failed.

-- CreateTable
CREATE TABLE "ops_alert_states" (
    "condition" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "claimToken" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_alert_states_pkey" PRIMARY KEY ("condition")
);

-- AlterTable
ALTER TABLE "failed_jobs" ADD COLUMN     "retryAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retryClaimToken" TEXT,
ADD COLUMN     "retryClaimedAt" TIMESTAMP(3),
ADD COLUMN     "retryClaimedBy" TEXT,
ADD COLUMN     "retryError" TEXT;
