import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, requireSystemOwner, apiError, apiSuccess } from "@/lib/auth";

/**
 * GET /api/system/stats - Get platform-wide statistics
 */
export async function GET(request: NextRequest) {
    try {
        // Platform-wide counts: system owner only (the edge middleware does not
        // verify the session, only that a cookie exists).
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const ownerCheck = requireSystemOwner(authResult.user);
        if (ownerCheck) return ownerCheck;

        // Fetch all stats in parallel
        const [totalTenants, activeTenants, totalUsers, totalPatients] = await Promise.all([
            prisma.tenant.count(),
            prisma.tenant.count({ where: { status: "ACTIVE" } }),
            prisma.user.count(),
            prisma.patient.count(),
        ]);

        // Determine system health (simplified logic)
        const systemHealth = activeTenants === totalTenants ? "healthy" : "degraded";

        return apiSuccess({
            totalTenants,
            activeTenants,
            totalUsers,
            totalPatients,
            systemHealth,
        });
    } catch (error) {
        console.error("[System API] Stats fetch error:", error);
        return apiError("Failed to fetch system statistics", 500);
    }
}
