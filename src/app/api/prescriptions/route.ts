import { NextRequest, NextResponse } from "next/server";
import {
    requireAuth,
    requirePermission,
    isPatientUser,
    isStaffUser,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import prisma from "@/lib/db/prisma";
import { PharmacyService } from "@/lib/services/pharmacy.service";
import { JWTPayload, PatientJWTPayload } from "@/lib/auth/types";
import { getTenantIdFromUser } from "@/lib/clinic";


/**
 * GET /api/prescriptions
 * List prescriptions for the clinic
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const user = authResult.user;

        const { searchParams } = new URL(request.url);

        const status = searchParams.get("status") as any;
        const requestedPatientId = searchParams.get("patientId");

        if (isPatientUser(user)) {
            const patientId = (user as PatientJWTPayload).patientId;
            const history = await PharmacyService.getPatientHistory(patientId, getTenantIdFromUser(user));
            return apiSuccess(history);
        }

        if (!isStaffUser(user)) return apiError("Staff access required", 403);
        const permissionError = requirePermission(user, PERMISSIONS.PRESCRIPTIONS_VIEW);
        if (permissionError) return permissionError;

        if (requestedPatientId) {
            const history = await PharmacyService.getPatientHistory(requestedPatientId, getTenantIdFromUser(user));
            return apiSuccess(history);
        }

        const prescriptions = await PharmacyService.getPrescriptions(getTenantIdFromUser(user), status);
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
        const user = authResult.user;

        if (!isStaffUser(user)) return apiError("Staff access required", 403);

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

        const tenantId = getTenantIdFromUser(user);

        if (typeof patientId !== "string") return apiError("patientId must be a string", 400);
        if (medications.length === 0 || medications.length > 50) {
            return apiError("Provide between 1 and 50 medications", 400);
        }
        for (const med of medications) {
            if (typeof med?.name !== "string" || !med.name.trim()) {
                return apiError("Each medication needs a name", 400);
            }
            if (med.quantity !== undefined && (!Number.isFinite(Number(med.quantity)) || Number(med.quantity) <= 0)) {
                return apiError("Medication quantity must be greater than 0", 400);
            }
        }

        // The patient (and appointment, if given) must belong to this clinic.
        // Without this a staff user could attach a prescription to — and read back
        // the full record of — a patient from another clinic.
        const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId }, select: { id: true } });
        if (!patient) return apiError("Patient not found", 404);
        if (appointmentId) {
            const appointment = await prisma.appointment.findFirst({
                where: { id: appointmentId, tenantId, patientId },
                select: { id: true },
            });
            if (!appointment) return apiError("Appointment not found for this patient", 404);
        }

        const prescription = await PharmacyService.createPrescription({
            tenantId,
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
