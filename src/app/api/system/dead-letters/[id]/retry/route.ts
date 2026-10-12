// POST /api/system/dead-letters/[id]/retry — system owner re-queues a job that ran out of retries.
import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { retryDeadLetter } from "@/lib/queue/retry";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authResult = await requireAuth(request);
        if ("error" in authResult) return authResult.error;
        if (authResult.user.type !== "SYSTEM_OWNER") return apiError("System owner access required", 403);
        const actorId = (authResult.user as { userId: string }).userId;

        const { id } = await params;
        const outcome = await retryDeadLetter(id, actorId);
        if (outcome === "not-found") return apiError("Failed job not found", 404);
        if (outcome === "already-retried") return apiError("This job was already retried", 409);
        if (outcome === "in-progress") return apiError("A retry of this job is already in progress", 409);
        if (outcome === "failed") {
            // The claim was released and the redacted reason stored on the record, so a deliberate later retry is possible.
            await logAudit({ tenantId: null, userId: actorId, action: "DEAD_LETTER_RETRY_FAILED", entity: "FailedJob", entityId: id, ipAddress: getClientIP(request.headers), userAgent: getUserAgent(request.headers) });
            return apiError("The queue refused the retry. You can try again.", 502);
        }
        if (outcome === "payload-gone") return apiError("The original job is no longer in the queue, so it cannot be retried from here", 410);

        await logAudit({
            tenantId: null,
            userId: actorId,
            action: "DEAD_LETTER_RETRIED",
            entity: "FailedJob",
            entityId: id,
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });
        return apiSuccess({ retried: true });
    } catch (error) {
        console.error("[System] Dead-letter retry error:", error instanceof Error ? error.message : "unknown");
        return apiError("Internal server error", 500);
    }
}
