// ============================================
// NEXUS DENTAL — Support Tickets API
// GET  /api/support/tickets — List tickets
// POST /api/support/tickets — Create ticket (with triage)
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    enforceTenantScope,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import { triageTicket } from "@/lib/support";
import { logAudit } from "@/lib/audit/logger";
import type { JWTPayload, PatientJWTPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");
        const status = searchParams.get("status");
        const severity = searchParams.get("severity");
        const assignedTo = searchParams.get("assignedTo");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        if (!tenantId) return apiError("tenantId is required", 400);

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const where: Record<string, unknown> = { tenantId };

        // Patients only see their own tickets
        if (user.type === "PATIENT") {
            where.patientId = (user as PatientJWTPayload).patientId;
        }

        if (status) where.status = status;
        if (severity) where.severity = severity;
        if (assignedTo) where.assignedTo = assignedTo;

        const [tickets, total] = await Promise.all([
            prisma.supportTicket.findMany({
                where,
                include: {
                    patient: {
                        select: { id: true, firstName: true, lastName: true, phone: true },
                    },
                    _count: { select: { messages: true } },
                },
                orderBy: [
                    { severity: "desc" },
                    { createdAt: "desc" },
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.supportTicket.count({ where }),
        ]);

        return apiSuccess({
            tickets,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error("[Support] List error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const body = await request.json();
        const { tenantId, subject, description, issueType, patientId: bodyPatientId } = body;

        if (!tenantId || !subject || !description) {
            return apiError("tenantId, subject, and description are required", 400);
        }

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        // Determine patient ID
        let patientId: string;
        if (user.type === "PATIENT") {
            patientId = (user as PatientJWTPayload).patientId;
        } else if (bodyPatientId) {
            patientId = bodyPatientId;
        } else {
            return apiError("patientId is required when staff creates a ticket", 400);
        }

        // Run triage
        const triage = triageTicket(subject, description);

        const ticket = await prisma.supportTicket.create({
            data: {
                tenantId,
                patientId,
                subject,
                description,
                issueType: issueType || triage.suggestedIssueType,
                severity: triage.severity,
                status: triage.shouldAutoEscalate ? "ESCALATED" : "OPEN",
            },
            include: {
                patient: {
                    select: { id: true, firstName: true, lastName: true },
                },
            },
        });

        // Audit
        const userId = user.type === "PATIENT"
            ? (user as PatientJWTPayload).patientId
            : (user as JWTPayload).userId;

        await logAudit({
            tenantId,
            userId,
            action: "SUPPORT_TICKET_CREATED",
            entity: "SupportTicket",
            entityId: ticket.id,
            newValue: {
                severity: triage.severity,
                matchedKeywords: triage.matchedKeywords,
                autoEscalated: triage.shouldAutoEscalate,
                slaMinutes: triage.responseTimeMinutes,
            },
        });

        return apiSuccess(
            {
                ticket,
                triage: {
                    severity: triage.severity,
                    matchedKeywords: triage.matchedKeywords,
                    autoEscalated: triage.shouldAutoEscalate,
                    responseTimeMinutes: triage.responseTimeMinutes,
                },
            },
            201
        );
    } catch (error) {
        console.error("[Support] Create error:", error);
        return apiError("Internal server error", 500);
    }
}
