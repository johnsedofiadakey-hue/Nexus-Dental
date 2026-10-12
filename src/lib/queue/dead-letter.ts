// ============================================
// NEXUS DENTAL — Dead-letter capture
//
// A job that has used all its retries is written to the database (failed_jobs).
// Redis can be flushed or evicted; this record cannot. Only a redacted error
// and the payload KEY NAMES are kept - never payload values, which can contain
// patient names, phone numbers or message text.
// ============================================

import prisma from "@/lib/db/prisma";
import { redactText } from "@/lib/utils/redact";

export interface JobLike {
    id?: string;
    name: string;
    data?: unknown;
    attemptsMade: number;
    opts?: { attempts?: number };
}

export function isExhausted(job: JobLike): boolean {
    return job.attemptsMade >= (job.opts?.attempts ?? 1);
}

/** Remove things that must not sit in a table: emails, phone numbers, long digit runs, tokens, URLs. */
export function redactError(message: string): string {
    return redactText(message, 500);
}

export async function recordDeadLetter(queue: string, job: JobLike, error: Error): Promise<void> {
    const payloadKeys = job.data && typeof job.data === "object" ? Object.keys(job.data as object).slice(0, 30) : [];
    const jobId = job.id ?? `${job.name}-unknown`;
    const data = {
        queue,
        jobId,
        name: job.name,
        attempts: job.attemptsMade,
        errorMessage: redactError(error.message || "unknown error"),
        payloadKeys,
        failedAt: new Date(),
    };
    await prisma.failedJob.upsert({
        where: { queue_jobId: { queue, jobId } },
        create: data,
        update: { attempts: data.attempts, errorMessage: data.errorMessage, failedAt: data.failedAt, retriedAt: null, retriedBy: null },
    });
}
