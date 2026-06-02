// ============================================
// NEXUS DENTAL — Available Doctors API
// GET /api/appointments/doctors
// ============================================

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/auth";
import { getAvailableDoctors } from "@/lib/booking";
import { getClinicId } from "@/lib/clinic";

export async function GET(request: NextRequest) {
    try {
        const tenantId = getClinicId();
        const { searchParams } = new URL(request.url);
        const specialty = searchParams.get("specialty");

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
