import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import type { JWTPayload, PatientJWTPayload } from "@/lib/auth";
import { PatientService } from "@/lib/services/patient.service";
import { getClinicId } from "@/lib/clinic";

/**
 * GET /api/patients/[id]/history
 * Get a patient's medical history timeline
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const user = authResult.user;

        const patientId = (await params).id;
        const tenantId = getClinicId();

        // Security Check: 
        // 1. Staff can view any patient in their tenant
        // 2. Patient can only view their own history
        if (user.type === "PATIENT") {
            if ((user as PatientJWTPayload).patientId !== patientId) {
                return apiError("Forbidden", 403);
            }
        } else if (!tenantId) {
            return apiError("Tenant ID is required for staff", 400);
        }

        const history = await PatientService.getTimelineHistory(patientId, tenantId || "");

        return apiSuccess(history);
    } catch (error: any) {
        console.error("[Patient History API] GET Error:", error);
        return apiError(error.message || "Internal Server Error", 500);
    }
}
