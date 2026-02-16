// ============================================
// NEXUS DENTAL — System: Health & Analytics API
// GET /api/system/health — System health report
// GET /api/system/analytics — Global or tenant analytics
// ============================================

import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { getSystemHealth } from "@/lib/system/health";
import { getTenantAnalytics } from "@/lib/system/analytics";

function requireSystemOwner(request: NextRequest) {
    const authResult = requireAuth(request);
    if ("error" in authResult) return { error: authResult.error };
    if (authResult.user.type !== "SYSTEM_OWNER") {
        return { error: apiError("System owner access required", 403) };
    }
    return { user: authResult.user };
}

export async function GET(request: NextRequest) {
    const { pathname } = new URL(request.url);

    try {
        const auth = requireSystemOwner(request);
        if ("error" in auth && auth.error) return auth.error;

        if (pathname.includes("/health")) {
            const health = await getSystemHealth();
            return apiSuccess(health);
        }

        if (pathname.includes("/analytics")) {
            const { searchParams } = new URL(request.url);
            const tenantId = searchParams.get("tenantId");
            const days = parseInt(searchParams.get("days") || "30");

            if (!tenantId) return apiError("tenantId is required", 400);

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const analytics = await getTenantAnalytics(tenantId, startDate, endDate);
            return apiSuccess(analytics);
        }

        return apiError("Not found", 404);
    } catch (error) {
        console.error("[System] API error:", error);
        return apiError("Internal server error", 500);
    }
}
