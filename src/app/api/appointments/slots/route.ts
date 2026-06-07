// ============================================
// NEXUS DENTAL — Available Slots API
// GET /api/appointments/slots
// ============================================

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/auth";
import { getAvailableSlots, getWeekAvailability } from "@/lib/booking";
import { getClinicId } from "@/lib/clinic";

export async function GET(request: NextRequest) {
    try {
        const tenantId = getClinicId();
        const { searchParams } = new URL(request.url);
        const doctorId = searchParams.get("doctorId");
        const date = searchParams.get("date");
        const mode = searchParams.get("mode") || "day"; // "day" | "week"
        const duration = parseInt(searchParams.get("duration") || "30");

        if (!doctorId || !date) {
            return apiError("doctorId and date are required", 400);
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return apiError("Date must be in YYYY-MM-DD format", 400);
        }

        if (mode === "week") {
            const daysToFetch = parseInt(searchParams.get("days") || "7");
            const schedules = await getWeekAvailability(
                tenantId,
                doctorId,
                date,
                daysToFetch,
                duration
            );
            return apiSuccess({ schedules });
        }

        const schedule = await getAvailableSlots(
            tenantId,
            doctorId,
            date,
            duration
        );
        return apiSuccess({ schedule });
    } catch (error) {
        console.error("[Slots] Error fetching slots:", error);
        return apiError("Internal server error", 500);
    }
}
