import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/auth";
import { getClinicStats } from "@/lib/services/analytics.service";

/**
 * GET /api/analytics/clinic - Clinic-specific statistics
 */
export async function GET(request: NextRequest) {
    try {
        // TODO: Get tenantId from authenticated user's JWT
        const tenantId = "airport-hills-dental";

        const stats = await getClinicStats(tenantId);

        return apiSuccess({ clinic: stats });
    } catch (error) {
        console.error("[Analytics API] Clinic stats error:", error);
        return apiError("Failed to fetch clinic analytics", 500);
    }
}
