// ============================================
// NEXUS DENTAL — Telehealth API
// POST /api/telehealth/start    — Start session
// POST /api/telehealth/summary  — Generate consultation summary
// ============================================

import { NextRequest } from "next/server";
import {
    requireAuth,
    requirePermission,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import { createTelehealthSession, generateConsultationSummary } from "@/lib/support";
import type { JWTPayload } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.APPOINTMENTS_UPDATE);
        if (permCheck) return permCheck;

        const staffUser = user as JWTPayload;
        if (staffUser.role !== "DOCTOR") {
            return apiError("Only doctors can manage telehealth sessions", 403);
        }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");
        const body = await request.json();

        switch (action) {
            case "start": {
                const { appointmentId } = body;
                if (!appointmentId) {
                    return apiError("appointmentId is required", 400);
                }

                const session = await createTelehealthSession(
                    staffUser.tenantId!,
                    appointmentId,
                    staffUser.userId
                );

                return apiSuccess(session, 201);
            }

            case "summary": {
                const {
                    appointmentId,
                    chiefComplaint,
                    findings,
                    recommendations,
                    followUpDate,
                } = body;

                if (
                    !appointmentId ||
                    !chiefComplaint ||
                    !findings ||
                    !recommendations
                ) {
                    return apiError(
                        "appointmentId, chiefComplaint, findings, and recommendations are required",
                        400
                    );
                }

                const summary = await generateConsultationSummary(
                    staffUser.tenantId!,
                    appointmentId,
                    staffUser.userId,
                    { chiefComplaint, findings, recommendations, followUpDate }
                );

                return apiSuccess(summary);
            }

            default:
                return apiError(
                    "Invalid action. Use ?action=start or ?action=summary",
                    400
                );
        }
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Internal server error";
        console.error("[Telehealth] Error:", error);
        return apiError(message, message.includes("not found") ? 404 : 500);
    }
}
