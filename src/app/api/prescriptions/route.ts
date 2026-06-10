import { NextRequest, NextResponse } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { PharmacyService } from "@/lib/services/pharmacy.service";
import { JWTPayload } from "@/lib/auth/types";
import { getClinicId } from "@/lib/clinic";


/**
 * GET /api/prescriptions
 * List prescriptions for the clinic
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const user = authResult.user as JWTPayload;

        const { searchParams } = new URL(request.url);

        const status = searchParams.get("status") as any;
        const patientId = searchParams.get("patientId");

        if (patientId) {
            const history = await PharmacyService.getPatientHistory(patientId, getClinicId());
            return apiSuccess(history);
        }

        const prescriptions = await PharmacyService.getPrescriptions(getClinicId(), status);
        return apiSuccess(prescriptions);

    } catch (error: any) {
        console.error("[Prescriptions API] GET Error:", error);
        return apiError(error.message || "Internal Server Error", 500);
    }
}

/**
 * POST /api/prescriptions
 * Create a new prescription (Doctor only)
 */
export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const user = authResult.user as JWTPayload;

        // Verify role (Doctor or Admin)
        const staffUser = user as JWTPayload;
        if (!staffUser.roles.some(r => ["SYSTEM_OWNER", "CLINIC_OWNER", "DOCTOR", "ADMIN"].includes(r as any))) {
            return apiError("Forbidden: Only clinical staff can issue prescriptions", 403);
        }

        const body = await request.json();
        const { patientId, medications, instructions, validUntil, appointmentId } = body;

        if (!patientId || !medications || !Array.isArray(medications)) {
            return apiError("Missing required fields", 400);
        }

        const prescription = await PharmacyService.createPrescription({
            tenantId: getClinicId(),
            patientId,
            doctorId: staffUser.userId,

            appointmentId,
            medications,
            instructions,
            validUntil: validUntil ? new Date(validUntil) : undefined,
        });

        return apiSuccess(prescription, 201);
    } catch (error: any) {
        console.error("[Prescriptions API] POST Error:", error);
        return apiError(error.message || "Internal Server Error", 500);
    }
}
