// ============================================
// NEXUS DENTAL — System: Queues API
// GET /api/system/queues — Monitor queue health
// POST /api/system/queues — Trigger manual jobs
// ============================================

import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { getQueue, QueueName } from "@/lib/queue/queues";
import { logAudit } from "@/lib/audit/logger";
import { getSystemHealth } from "@/lib/system/health";
import prisma from "@/lib/db/prisma";

async function requireSystemOwner(request: NextRequest) {
    const authResult = await requireAuth(request);
    if ("error" in authResult) return { error: authResult.error };
    if (authResult.user.type !== "SYSTEM_OWNER") {
        return { error: apiError("System owner access required", 403) };
    }
    return { user: authResult.user };
}

export async function GET(request: NextRequest) {
    try {
        const auth = await requireSystemOwner(request);
        if ("error" in auth && auth.error) return auth.error;

        // Time-bounded: an unreachable Redis yields an answer (empty queues, workers DOWN/UNKNOWN), not a hang.
        const health = await getSystemHealth();
        const recent = await prisma.failedJob.findMany({ orderBy: { failedAt: "desc" }, take: 50 });

        return apiSuccess({
            queues: health.queues,
            workers: health.workers,
            deadLetters: { unresolved: health.deadLetters.unresolved, recent },
        });
    } catch (error) {
        console.error("[System] Queue stats error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = await requireSystemOwner(request);
        if ("error" in auth && auth.error) return auth.error;

        const body = await request.json();
        const { queueName, jobName, data } = body;

        if (!queueName || !jobName) {
            return apiError("queueName and jobName are required", 400);
        }

        const queue = getQueue(queueName as QueueName);
        const job = await queue.add(jobName, data);

        await logAudit({
            tenantId: null,
            userId: auth.user!.userId,
            action: "MANUAL_JOB_TRIGGERED",
            entity: "QueueJob",
            entityId: job.id || "unknown",
            newValue: { queueName, jobName, data },
        });

        return apiSuccess({
            message: "Job enqueued successfully",
            jobId: job.id,
        });
    } catch (error) {
        console.error("[System] Queue trigger error:", error);
        return apiError("Internal server error", 500);
    }
}
