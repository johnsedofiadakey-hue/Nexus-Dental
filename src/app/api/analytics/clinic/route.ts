import { NextRequest } from "next/server";
import { requireAuth, isStaffUser, getUserTenantId, apiError, apiSuccess } from "@/lib/auth";
import { getClinicStats } from "@/lib/services/analytics.service";
import type { JWTPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        if (!isStaffUser(user)) {
            return apiError("Staff access required", 403);
        }

        const tenantId = (user as JWTPayload).tenantId;
        if (!tenantId) {
            return apiError("No tenant associated with this account", 400);
        }

        const stats = await getClinicStats(tenantId);
        return apiSuccess({ clinic: stats });
    } catch (error) {
        console.error("[Analytics API] Clinic stats error:", error);
        return apiError("Failed to fetch clinic analytics", 500);
    }
}
