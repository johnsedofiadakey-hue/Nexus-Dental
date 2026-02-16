// ============================================
// NEXUS DENTAL — Support Ticket Detail API
// GET   /api/support/tickets/[id] — Get ticket with messages
// PATCH /api/support/tickets/[id] — Update ticket (assign, status)
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    enforceTenantScope,
    requirePermission,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import { shouldEscalate } from "@/lib/support";
import { logAudit } from "@/lib/audit/logger";
import type { JWTPayload, PatientJWTPayload } from "@/lib/auth";
import type { TicketSeverity } from "@prisma/client";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const ticket = await prisma.supportTicket.findUnique({
            where: { id },
            include: {
                patient: {
                    select: { id: true, firstName: true, lastName: true, phone: true },
                },
                messages: {
                    orderBy: { timestamp: "asc" },
                    where: user.type === "PATIENT" ? { isInternal: false } : {},
                },
            },
        });

        if (!ticket) return apiError("Ticket not found", 404);

        const tenantCheck = enforceTenantScope(user, ticket.tenantId);
        if (tenantCheck) return tenantCheck;

        // Patients can only view their own tickets
        if (
            user.type === "PATIENT" &&
            ticket.patientId !== (user as PatientJWTPayload).patientId
        ) {
            return apiError("Access denied", 403);
        }

        // Check if escalation needed
        const escalation = shouldEscalate(
            ticket.severity as TicketSeverity,
            ticket.createdAt,
            ticket.messages.length,
            ticket.status
        );

        return apiSuccess({ ticket, escalation });
    } catch (error) {
        console.error("[Support] Detail error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.SUPPORT_RESPOND);
        if (permCheck) return permCheck;

        const staffUser = user as JWTPayload;
        const body = await request.json();
        const { status, assignedTo, severity } = body;

        const ticket = await prisma.supportTicket.findUnique({ where: { id } });
        if (!ticket) return apiError("Ticket not found", 404);

        const tenantCheck = enforceTenantScope(user, ticket.tenantId);
        if (tenantCheck) return tenantCheck;

        const data: Record<string, unknown> = {};
        if (status) data.status = status;
        if (assignedTo !== undefined) data.assignedTo = assignedTo;
        if (severity) data.severity = severity;
        if (status === "RESOLVED") data.resolvedAt = new Date();

        if (Object.keys(data).length === 0) {
            return apiError("No fields to update", 400);
        }

        const updated = await prisma.supportTicket.update({
            where: { id },
            data,
            include: {
                patient: {
                    select: { id: true, firstName: true, lastName: true },
                },
            },
        });

        await logAudit({
            tenantId: ticket.tenantId,
            userId: staffUser.userId,
            action: "SUPPORT_TICKET_UPDATED",
            entity: "SupportTicket",
            entityId: id,
            oldValue: { status: ticket.status, assignedTo: ticket.assignedTo },
            newValue: data,
        });

        return apiSuccess(updated);
    } catch (error) {
        console.error("[Support] Update error:", error);
        return apiError("Internal server error", 500);
    }
}
