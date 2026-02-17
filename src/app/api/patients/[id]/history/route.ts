import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/auth";
import { PatientService } from "@/lib/services/patient.service";

/**
 * GET /api/patients/[id]/history
 * Get a patient's medical history timeline
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = authenticateRequest(request);
        if (!user) {
            return apiError("Unauthorized", 401);
        }

        const patientId = params.id;
        const tenantId = user.tenantId;

        // Security Check: 
        // 1. Staff can view any patient in their tenant
        // 2. Patient can only view their own history
        if (user.type === "PATIENT") {
            const tokenPatientId = (user as any).patientId;
            if (tokenPatientId !== patientId) {
                return apiError("Forbidden: You can only view your own history", 403);
            }
        } else if (!tenantId) {
            return apiError("Staff must have an associated tenant", 400);
        }

        const history = await PatientService.getTimelineHistory(patientId, tenantId || "");

        return apiSuccess(history);
    } catch (error: any) {
        console.error("[Patient History API] GET Error:", error);
        return apiError(error.message || "Internal Server Error", 500);
    }
}
