import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/auth";
import { getPlatformStats, getTenantStats } from "@/lib/services/analytics.service";

/**
 * GET /api/analytics/platform - Platform-wide statistics for System Owner
 */
export async function GET(request: NextRequest) {
    try {
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
