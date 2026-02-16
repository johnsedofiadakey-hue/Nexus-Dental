// ============================================
// NEXUS DENTAL — Override Engine
// Authorized overrides with ActionControlLog
// ============================================

import prisma from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit/logger";
import type { OverrideAction } from "@prisma/client";

export interface OverrideRequest {
    tenantId: string;
    userId: string;
    action: OverrideAction;
    entity: string;
    entityId: string;
    reason: string;
    oldValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

/**
 * Execute an override action with full audit trail.
 *
 * Override actions require explicit justification and are logged
 * to the ActionControlLog for compliance review.
 */
export async function executeOverride(
    override: OverrideRequest,
    ipAddress?: string,
    userAgent?: string
): Promise<{ logId: string; success: boolean }> {
    // Create the override log entry
    const log = await prisma.actionControlLog.create({
        data: {
            tenantId: override.tenantId,
            userId: override.userId,
            action: override.action,
            entity: override.entity,
            entityId: override.entityId,
            reason: override.reason,
            oldValue: override.oldValue ? JSON.parse(JSON.stringify(override.oldValue)) : undefined,
            newValue: override.newValue ? JSON.parse(JSON.stringify(override.newValue)) : undefined,
            metadata: override.metadata ? JSON.parse(JSON.stringify(override.metadata)) : undefined,
        },
    });

    // Also create an audit log entry
    await logAudit({
        tenantId: override.tenantId,
        userId: override.userId,
        action: `OVERRIDE_${override.action}`,
        entity: override.entity,
        entityId: override.entityId,
        oldValue: override.oldValue,
        newValue: override.newValue,
        ipAddress,
        userAgent,
    });

    return { logId: log.id, success: true };
}

/**
 * Override an appointment status outside normal state machine transitions.
 * Requires APPOINTMENTS_OVERRIDE permission.
 */
export async function overrideAppointmentStatus(
    tenantId: string,
    appointmentId: string,
    newStatus: string,
    reason: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
) {
    const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, tenantId },
    });

    if (!appointment) {
        throw new Error("Appointment not found");
    }

    const oldStatus = appointment.status;

    // Execute the override
    const updated = await prisma.$transaction(
        async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
            const result = await tx.appointment.update({
                where: { id: appointmentId },
                data: { status: newStatus as never },
            });

            await tx.appointmentTransition.create({
                data: {
                    appointmentId,
                    fromStatus: oldStatus,
                    toStatus: newStatus as never,
                    triggeredBy: userId,
                    reason: `[OVERRIDE] ${reason}`,
                },
            });

            return result;
        }
    );

    // Log the override
    await executeOverride(
        {
            tenantId,
            userId,
            action: "APPOINTMENT_STATUS_CHANGE",
            entity: "Appointment",
            entityId: appointmentId,
            reason,
            oldValue: { status: oldStatus },
            newValue: { status: newStatus },
        },
        ipAddress,
        userAgent
    );

    return updated;
}

/**
 * Override the sanitization buffer for a specific appointment.
 * Allows booking during buffer time with justification.
 */
export async function overrideBuffer(
    tenantId: string,
    appointmentId: string,
    reason: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
) {
    const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, tenantId },
    });

    if (!appointment) {
        throw new Error("Appointment not found");
    }

    const updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: { bufferMinutes: 0 },
    });

    await executeOverride(
        {
            tenantId,
            userId,
            action: "BUFFER_REMOVAL",
            entity: "Appointment",
            entityId: appointmentId,
            reason,
            oldValue: { bufferMinutes: appointment.bufferMinutes },
            newValue: { bufferMinutes: 0 },
        },
        ipAddress,
        userAgent
    );

    return updated;
}

/**
 * Get override history for compliance review.
 */
export async function getOverrideHistory(
    tenantId: string,
    filters?: {
        action?: OverrideAction;
        userId?: string;
        entity?: string;
        dateFrom?: Date;
        dateTo?: Date;
        page?: number;
        limit?: number;
    }
) {
    const where: Record<string, unknown> = { tenantId };
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    if (filters?.action) where.action = filters.action;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.entity) where.entity = filters.entity;

    if (filters?.dateFrom || filters?.dateTo) {
        where.timestamp = {};
        if (filters?.dateFrom) {
            (where.timestamp as Record<string, unknown>).gte = filters.dateFrom;
        }
        if (filters?.dateTo) {
            (where.timestamp as Record<string, unknown>).lte = filters.dateTo;
        }
    }

    const [logs, total] = await Promise.all([
        prisma.actionControlLog.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                    },
                },
            },
            orderBy: { timestamp: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.actionControlLog.count({ where }),
    ]);

    return {
        logs,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
