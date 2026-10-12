// ============================================
// NEXUS DENTAL — Appointment Status Transition API
// PATCH /api/appointments/[id]/status
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    requirePermission,
    PERMISSIONS,
    VALID_APPOINTMENT_TRANSITIONS,
    REOPENABLE_STATUSES,
    REOPEN_ALLOWED_ROLES,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import type { JWTPayload } from "@/lib/auth";
import { cancelPendingReminders, enqueueAndSummarise, removeQueuedJobs, scheduleAppointmentReminders } from "@/lib/reminders/schedule";
import { smsRemindersState } from "@/lib/reminders/settings";
import { clinicTimeZone } from "@/lib/utils/timezone";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Authenticate
        const authResult = await requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        // Only staff can transition statuses
        const permCheck = requirePermission(user, PERMISSIONS.APPOINTMENTS_UPDATE);
        if (permCheck) return permCheck;

        const staffUser = user as JWTPayload;
        const body = await request.json();
        const { status: newStatus, reason } = body;

        if (!newStatus) {
            return apiError("New status is required", 400);
        }

        // Find the appointment
        const appointment = await prisma.appointment.findUnique({
            where: { id },
        });

        if (!appointment) {
            return apiError("Appointment not found", 404);
        }

        if (appointment.tenantId !== staffUser.tenantId) {
            return apiError("Appointment not found", 404);
        }

        // Validate state transition
        const currentStatus = appointment.status;
        const allowedTransitions = VALID_APPOINTMENT_TRANSITIONS[currentStatus];

        if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
            return apiError(
                `Invalid transition: ${currentStatus} → ${newStatus}. Allowed: ${(allowedTransitions || []).join(", ") || "none"}`,
                422
            );
        }

        // Reopening a terminal status (CHECKOUT/CANCELLED/NO_SHOW back to
        // SCHEDULED) is restricted to elevated roles — a mis-click shouldn't
        // be silently reversible by just anyone with APPOINTMENTS_UPDATE.
        if (
            (REOPENABLE_STATUSES as readonly string[]).includes(currentStatus) &&
            !(REOPEN_ALLOWED_ROLES as readonly string[]).includes(staffUser.role)
        ) {
            return apiError(
                `Only ${REOPEN_ALLOWED_ROLES.join("/")} can reopen an appointment from ${currentStatus}`,
                403
            );
        }

        // Reminders that are still pending belong to an appointment that is no longer "SCHEDULED":
        // cancel them in the same transaction as the status change.
        let cancelledReminderRows: Array<{ id: string; generation: number }> = [];

        // Execute transition atomically
        const updated = await prisma.$transaction(async (tx: any) => {
            // Update appointment status
            const updatedAppointment = await tx.appointment.update({
                where: { id },
                data: {
                    status: newStatus,
                    ...(newStatus === "COMPLETED" || newStatus === "CHECKOUT"
                        ? { completedAt: new Date() }
                        : {}),
                },
                include: {
                    patient: {
                        select: { id: true, firstName: true, lastName: true },
                    },
                    doctor: {
                        select: { id: true, firstName: true, lastName: true },
                    },
                    service: {
                        select: { name: true, duration: true },
                    },
                    additionalServices: {
                        select: { name: true, duration: true },
                    },
                },
            });

            if (newStatus !== "SCHEDULED") {
                cancelledReminderRows = (await tx.appointmentReminder.findMany({
                    where: { appointmentId: id, status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
                    select: { id: true, generation: true },
                })) ?? [];
                await cancelPendingReminders(tx, id, `Appointment is now ${newStatus}.`);
            }

            // Record transition
            await tx.appointmentTransition.create({
                data: {
                    appointmentId: id,
                    fromStatus: currentStatus,
                    toStatus: newStatus,
                    triggeredBy: staffUser.userId,
                    reason: reason || null,
                },
            });

            const { service, additionalServices, ...rest } = updatedAppointment;
            return { ...rest, services: [service, ...(additionalServices || [])].filter(Boolean) };
        });

        // After commit: drop the now-pointless queue jobs (best effort: the worker re-checks status anyway),
        // or, when an appointment is REOPENED, recreate its reminders from the durable rows.
        if (cancelledReminderRows.length > 0) {
            // Imported lazily: the queue module opens a Redis connection when loaded.
            const { appointmentQueue } = await import("@/lib/queue/queues");
            await removeQueuedJobs(appointmentQueue, cancelledReminderRows).catch(() => {});
        }
        if (newStatus === "SCHEDULED") {
            try {
                const state = await smsRemindersState(appointment.tenantId);
                if (state.enabled) {
                    const { appointmentQueue } = await import("@/lib/queue/queues");
                    const rows = await scheduleAppointmentReminders(prisma, appointment);
                    const tenant = await prisma.tenant.findUnique({ where: { id: appointment.tenantId }, select: { timezone: true } });
                    await enqueueAndSummarise({ rows, appointmentAt: appointment.dateTime, queue: appointmentQueue, timeZone: clinicTimeZone(tenant?.timezone) });
                }
            } catch (error) {
                // The status change is already committed; the reconciler will queue the rows.
                console.error("[Appointment] Could not recreate reminders on reopen:", error instanceof Error ? error.message : "unknown");
            }
        }

        // Audit log
        await logAudit({
            tenantId: appointment.tenantId,
            userId: staffUser.userId,
            action: "APPOINTMENT_STATUS_CHANGED",
            entity: "Appointment",
            entityId: id,
            oldValue: { status: currentStatus },
            newValue: { status: newStatus, reason },
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess(updated);
    } catch (error) {
        console.error("[Appointment] Status transition error:", error);
        return apiError("Internal server error", 500);
    }
}
