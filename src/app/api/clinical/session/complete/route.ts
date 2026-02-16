// ============================================
// NEXUS DENTAL — Session Complete API
// POST /api/clinical/session/complete
// ============================================

import { NextRequest } from "next/server";
import {
    requireAuth,
    requirePermission,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import { completeSession } from "@/lib/clinical";
import { getClientIP, getUserAgent } from "@/lib/audit/logger";
import type { JWTPayload } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        // Only doctors can complete sessions
        const permCheck = requirePermission(user, PERMISSIONS.APPOINTMENTS_UPDATE);
        if (permCheck) return permCheck;

        const staffUser = user as JWTPayload;
        if (staffUser.role !== "DOCTOR") {
            return apiError("Only doctors can complete sessions", 403);
        }

        const body = await request.json();
        const {
            appointmentId,
            clinicalNotes,
            medications,
            prescriptionInstructions,
            generateInvoice,
            discount,
            invoiceNotes,
        } = body;

        if (!appointmentId) {
            return apiError("appointmentId is required", 400);
        }

        const result = await completeSession(
            {
                appointmentId,
                tenantId: staffUser.tenantId!,
                doctorId: staffUser.userId,
                clinicalNotes,
                medications,
                prescriptionInstructions,
                generateInvoice,
                discount,
                invoiceNotes,
            },
            getClientIP(request.headers),
            getUserAgent(request.headers)
        );

        return apiSuccess(result);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Internal server error";
        console.error("[Session] Complete error:", error);
        return apiError(message, message.includes("not found") ? 404 : 500);
    }
}
