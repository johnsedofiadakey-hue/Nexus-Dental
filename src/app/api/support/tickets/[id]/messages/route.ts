// ============================================
// NEXUS DENTAL — Support Messages API
// POST /api/support/tickets/[id]/messages — Add message
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    enforceTenantScope,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import { notifySupportUpdate } from "@/lib/support";
import type { JWTPayload, PatientJWTPayload } from "@/lib/auth";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: ticketId } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const body = await request.json();
        const { content, isInternal } = body;

        if (!content) {
            return apiError("content is required", 400);
        }

        const ticket = await prisma.supportTicket.findUnique({
            where: { id: ticketId },
            include: {
                patient: { select: { id: true, firstName: true } },
            },
        });

        if (!ticket) return apiError("Ticket not found", 404);

        const tenantCheck = enforceTenantScope(user, ticket.tenantId);
        if (tenantCheck) return tenantCheck;

        // Determine sender
        let senderId: string;
        let senderRole: string;
        if (user.type === "PATIENT") {
            senderId = (user as PatientJWTPayload).patientId;
            senderRole = "PATIENT";

            // Patients can only message on their own tickets
            if (ticket.patientId !== senderId) {
                return apiError("Access denied", 403);
            }
        } else {
            const staffUser = user as JWTPayload;
            senderId = staffUser.userId;
            senderRole = staffUser.role;
        }

        // Patients cannot create internal notes
        if (isInternal && user.type === "PATIENT") {
            return apiError("Patients cannot create internal notes", 403);
        }

        const message = await prisma.supportMessage.create({
            data: {
                ticketId,
                senderId,
                senderRole,
                content,
                isInternal: isInternal || false,
            },
        });

        // Auto-update ticket status if patient responds
        if (user.type === "PATIENT" && ticket.status === "WAITING_ON_PATIENT") {
            await prisma.supportTicket.update({
                where: { id: ticketId },
                data: { status: "IN_PROGRESS" },
            });
        }

        // Auto-update ticket status if staff responds (set to waiting on patient)
        if (user.type !== "PATIENT" && !isInternal && ticket.status === "OPEN") {
            await prisma.supportTicket.update({
                where: { id: ticketId },
                data: {
                    status: "IN_PROGRESS",
                    assignedTo: senderId,
                },
            });
        }

        // Notify patient when staff responds (non-internal only)
        if (user.type !== "PATIENT" && !isInternal) {
            await notifySupportUpdate(
                ticket.tenantId,
                ticket.patientId,
                ticket.subject,
                `Staff responded to your ticket: "${content.slice(0, 100)}${content.length > 100 ? "..." : ""}"`
            );
        }

        return apiSuccess(message, 201);
    } catch (error) {
        console.error("[Support] Message error:", error);
        return apiError("Internal server error", 500);
    }
}
