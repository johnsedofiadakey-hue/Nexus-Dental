import { NextRequest } from "next/server";
import { requireAuth, requireSystemOwner, apiError, apiSuccess } from "@/lib/auth";
import { getPlatformStats, getTenantStats } from "@/lib/services/analytics.service";

/**
 * GET /api/analytics/platform - Platform-wide statistics for System Owner
 */
export async function GET(request: NextRequest) {
    try {
        // Cross-clinic revenue and counts: platform (system owner) access only. The
        // edge middleware merely checks that SOME cookie is present, so the real
        // session and role must be verified here.
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const ownerCheck = requireSystemOwner(authResult.user);
        if (ownerCheck) return ownerCheck;

        const stats = await getPlatformStats();
        const tenantStats = await getTenantStats();

        return apiSuccess({
            platform: stats,
            tenants: tenantStats,
        });
    } catch (error) {
        console.error("[Analytics API] Platform stats error:", error);
        return apiError("Failed to fetch analytics", 500);
    }
}
