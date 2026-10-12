// ============================================
// NEXUS DENTAL — Reminder history for one appointment
// GET /api/appointments/[id]/reminders
//
// Staff with appointments:view (their own clinic) or the patient the appointment belongs to.
// Response data: { appointmentId, items: [{ id, offsetMinutes, scheduledFor, status, sentAt,
//   provider, providerMessageId (staff only), attempts, error }] }
// status: PENDING | PROCESSING | SENT | FAILED | CANCELLED.  SENT means "accepted by the SMS
// provider" - delivery to the handset is not tracked.
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, requirePermission, PERMISSIONS, apiError, apiSuccess, isPatientUser } from "@/lib/auth";
import type { PatientJWTPayload } from "@/lib/auth";

interface ReminderHistoryRow {
    id: string;
    offsetMinutes: number;
    scheduledFor: Date;
    status: string;
    sentAt: Date | null;
    provider: string | null;
    providerMessageId: string | null;
    attempts: number;
    lastError: string | null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = await requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const appointment = await prisma.appointment.findUnique({
            where: { id },
            select: { id: true, tenantId: true, patientId: true },
        });
        // Same answer for "missing" and "someone else's" so ids cannot be probed.
        if (!appointment || appointment.tenantId !== user.tenantId) return apiError("Appointment not found", 404);

        const patient = isPatientUser(user);
        if (patient) {
            if ((user as PatientJWTPayload).patientId !== appointment.patientId) return apiError("Appointment not found", 404);
        } else {
            const denied = requirePermission(user, PERMISSIONS.APPOINTMENTS_VIEW);
            if (denied) return denied;
        }

        const rows = await prisma.appointmentReminder.findMany({
            where: { appointmentId: id },
            orderBy: { scheduledFor: "asc" },
        });
        return apiSuccess({
            appointmentId: id,
            items: rows.map((r: ReminderHistoryRow) => ({
                id: r.id,
                offsetMinutes: r.offsetMinutes,
                scheduledFor: r.scheduledFor,
                status: r.status,
                sentAt: r.sentAt,
                provider: r.provider,
                ...(patient ? {} : { providerMessageId: r.providerMessageId }),
                attempts: r.attempts,
                error: patient ? null : r.lastError,
            })),
        });
    } catch (error) {
        console.error("[Reminders] history error:", error instanceof Error ? error.message : "unknown");
        return apiError("Internal server error", 500);
    }
}
