// ============================================
// NEXUS DENTAL — Available Doctors API
// GET /api/appointments/doctors
// ============================================

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/auth";
import { getAvailableDoctors } from "@/lib/booking";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");
        const specialty = searchParams.get("specialty");

        if (!tenantId) {
            return apiError("tenantId is required", 400);
        }

        const doctors = await getAvailableDoctors(
            tenantId,
            specialty || undefined
        );

        return apiSuccess({ doctors });
    } catch (error) {
        console.error("[Doctors] Error fetching doctors:", error);
        return apiError("Internal server error", 500);
    }
}
