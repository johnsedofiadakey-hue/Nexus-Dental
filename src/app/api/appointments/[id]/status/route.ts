// ============================================
// NEXUS DENTAL — Appointment Status Transition API
// PATCH /api/appointments/[id]/status
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    enforceTenantScope,
    requirePermission,
    PERMISSIONS,
    VALID_APPOINTMENT_TRANSITIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import type { JWTPayload } from "@/lib/auth";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Authenticate
        const authResult = requireAuth(request);
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

        // Enforce tenant scope
        const tenantCheck = enforceTenantScope(user, appointment.tenantId);
        if (tenantCheck) return tenantCheck;

        // Validate state transition
        const currentStatus = appointment.status;
        const allowedTransitions = VALID_APPOINTMENT_TRANSITIONS[currentStatus];

        if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
            return apiError(
                `Invalid transition: ${currentStatus} → ${newStatus}. Allowed: ${(allowedTransitions || []).join(", ") || "none"}`,
                422
            );
        }

        // Execute transition atomically
        const updated = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
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
                        select: { id: true, name: true },
                    },
                },
            });

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

            return updatedAppointment;
        });

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
