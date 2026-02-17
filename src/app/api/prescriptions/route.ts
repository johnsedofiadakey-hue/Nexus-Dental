import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/auth";
import { PharmacyService } from "@/lib/services/pharmacy.service";
import { JWTPayload } from "@/lib/auth/types";


/**
 * GET /api/prescriptions
 * List prescriptions for the clinic
 */
export async function GET(request: NextRequest) {
    try {
        const user = authenticateRequest(request);
        if (!user || !user.tenantId) {
            return apiError("Unauthorized", 401);
        }

        const { searchParams } = new URL(request.url);

        const status = searchParams.get("status") as any;
        const patientId = searchParams.get("patientId");

        if (patientId) {
            const history = await PharmacyService.getPatientHistory(patientId, user.tenantId);
            return apiSuccess(history);
        }

        const prescriptions = await PharmacyService.getPrescriptions(user.tenantId, status);
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
        const user = authenticateRequest(request);
        if (!user || !user.tenantId) {
            return apiError("Unauthorized", 401);
        }

        // Verify role (Doctor or Admin)
        const staffUser = user as JWTPayload;
        if (!["SYSTEM_OWNER", "CLINIC_OWNER", "DOCTOR", "ADMIN"].includes(staffUser.role)) {
            return apiError("Forbidden: Only clinical staff can issue prescriptions", 403);
        }

        const body = await request.json();
        const { patientId, medications, instructions, validUntil, appointmentId } = body;

        if (!patientId || !medications || !Array.isArray(medications)) {
            return apiError("Missing required fields", 400);
        }

        const prescription = await PharmacyService.createPrescription({
            tenantId: user.tenantId,
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
