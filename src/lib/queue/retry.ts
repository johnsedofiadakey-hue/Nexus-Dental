// ============================================
// NEXUS DENTAL — Manual retry of a dead-lettered job
//
// Re-queues the ORIGINAL job (with its original payload) if it is still in Redis. If
// Redis no longer has it we say so: the payload was deliberately not copied into the
// database, so it cannot be reconstructed from the record.
//
// CONCURRENCY: the retry is CLAIMED with one conditional UPDATE *before* Redis is
// called. Two simultaneous requests cannot both claim, so Redis sees exactly one
// job.retry(). The claim is a short lease (no database transaction is held open
// across the Redis call): it is released if the retry fails, so a deliberate later
// retry is possible, and it expires by itself if the caller dies mid-way.
// ============================================

import { randomUUID } from "crypto";
import prisma from "@/lib/db/prisma";
import { redactError } from "./dead-letter";
import { getQueue, type QueueName } from "./queues";

export const RETRY_LEASE_MS = 2 * 60_000;

export type RetryOutcome =
    | "retried"
    | "not-found"
    | "payload-gone"
    | "already-retried"
    | "in-progress" // someone else holds the claim right now
    | "failed"; // Redis refused the retry; the claim was released and the reason recorded

export async function retryDeadLetter(id: string, actorId: string, now: Date = new Date()): Promise<RetryOutcome> {
    const row = await prisma.failedJob.findUnique({ where: { id } });
    if (!row) return "not-found";
    if (row.retriedAt) return "already-retried";

    // 1. Claim - atomic, decided by the database. Exactly one concurrent caller matches.
    const token = randomUUID();
    const claim = await prisma.failedJob.updateMany({
        where: {
            id,
            retriedAt: null,
            OR: [{ retryClaimedAt: null }, { retryClaimedAt: { lte: new Date(now.getTime() - RETRY_LEASE_MS) } }],
        },
        data: { retryClaimedAt: now, retryClaimToken: token, retryClaimedBy: actorId, retryAttempts: { increment: 1 } },
    });
    if (claim.count !== 1) {
        const latest = await prisma.failedJob.findUnique({ where: { id }, select: { retriedAt: true } });
        return latest?.retriedAt ? "already-retried" : "in-progress";
    }

    const release = (retryError: string | null) =>
        prisma.failedJob.updateMany({
            where: { id, retryClaimToken: token },
            data: { retryClaimedAt: null, retryClaimToken: null, retryError },
        });

    // 2. Call Redis with no transaction open.
    try {
        const job = await getQueue(row.queue as QueueName).getJob(row.jobId);
        if (!job) {
            await release("The original job is no longer in Redis.");
            return "payload-gone";
        }
        await job.retry();
    } catch (error) {
        await release(redactError(error instanceof Error ? error.message : "retry failed")).catch(() => {});
        return "failed";
    }

    // 3. Record success. The lease is dropped in the same statement.
    await prisma.failedJob.updateMany({
        where: { id, retryClaimToken: token },
        data: { retriedAt: now, retriedBy: actorId, retryClaimedAt: null, retryClaimToken: null, retryError: null },
    });
    return "retried";
}
