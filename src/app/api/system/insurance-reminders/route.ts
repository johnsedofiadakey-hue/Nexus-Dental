import { NextRequest } from "next/server";
import { requireAuth, requireSystemOwner, apiError, apiSuccess } from "@/lib/auth";
import { insuranceQueue } from "@/lib/queue/queues";
import prisma from "@/lib/db/prisma";

/**
 * POST /api/system/insurance-reminders — trigger insurance claim follow-up
 * reminders for all active tenants. Called by a daily cron job or manually
 * by system owner.
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
                insuranceQueue.add("stale-claims", { tenantId: t.id }).catch(() => null)
            )
        );

        return apiSuccess({ queued: jobs.filter(Boolean).length, totalTenants: tenants.length });
    } catch (error) {
        console.error("[Insurance Reminders] Trigger error:", error);
        return apiError("Internal server error", 500);
    }
}
