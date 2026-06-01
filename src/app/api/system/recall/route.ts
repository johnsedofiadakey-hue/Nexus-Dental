import { NextRequest } from "next/server";
import { requireAuth, requireSystemOwner, apiError, apiSuccess } from "@/lib/auth";
import { recallQueue } from "@/lib/queue/queues";
import prisma from "@/lib/db/prisma";

/**
 * POST /api/system/recall — trigger recall jobs for all active tenants.
 * Called by a cron job or manually by system owner.
 */
export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const ownerCheck = requireSystemOwner(user);
        if (ownerCheck) return ownerCheck;

        const tenants = await prisma.tenant.findMany({
            where: { status: "ACTIVE" },
            select: { id: true },
        });

        const jobs = await Promise.all(
            tenants.map((t: any) =>
                recallQueue.add("routine-checkup", { tenantId: t.id, recallType: "ROUTINE_CHECKUP" }).catch(() => null)
            )
        );

        return apiSuccess({ queued: jobs.filter(Boolean).length, totalTenants: tenants.length });
    } catch (error) {
        console.error("[Recall] Trigger error:", error);
        return apiError("Internal server error", 500);
    }
}
