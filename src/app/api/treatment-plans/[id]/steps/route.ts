import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    requirePermission,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";

import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import type { JWTPayload } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = await requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permissionError = requirePermission(user, PERMISSIONS.PATIENTS_UPDATE);
        if (permissionError) return permissionError;

        const tenantId = user.tenantId;
        if (!tenantId) return apiError("No tenant associated with user", 400);

        const { id } = await params;
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") return apiError("A JSON body is required", 400);
        const { title, description, estimatedCost, appointmentId } = body as Record<string, unknown>;

        // Validate everything the caller controls.
        if (typeof title !== "string" || title.trim().length === 0 || title.trim().length > 200) {
            return apiError("title is required (1-200 characters)", 400);
        }
        if (description !== undefined && description !== null && (typeof description !== "string" || description.length > 2000)) {
            return apiError("description must be text of at most 2000 characters", 400);
        }
        if (estimatedCost !== undefined && estimatedCost !== null) {
            if (typeof estimatedCost !== "number" || !Number.isFinite(estimatedCost) || estimatedCost < 0 || estimatedCost > 10_000_000) {
                return apiError("estimatedCost must be a number between 0 and 10,000,000", 400);
            }
        }
        if (appointmentId !== undefined && appointmentId !== null && typeof appointmentId !== "string") {
            return apiError("appointmentId must be a string", 400);
        }

        const plan = await prisma.treatmentPlan.findFirst({
            where: { id, tenantId, deletedAt: null },
            select: { id: true, patientId: true, status: true },
        });
        if (!plan) return apiError("Treatment plan not found", 404);
        if (plan.status === "COMPLETED" || plan.status === "CANCELLED") {
            return apiError(`Steps cannot be added to a ${plan.status.toLowerCase()} plan`, 409);
        }

        // A linked appointment must be THIS patient's, in THIS clinic, and not already used by another step.
        if (appointmentId) {
            const appointment = await prisma.appointment.findFirst({
                where: { id: appointmentId, tenantId, patientId: plan.patientId, deletedAt: null },
                select: { id: true },
            });
            if (!appointment) return apiError("Appointment not found for this patient", 404);
            const linked = await prisma.treatmentStep.findFirst({ where: { appointmentId }, select: { id: true } });
            if (linked) return apiError("That appointment is already linked to another step", 409);
        }

        // Step numbers are allocated under a per-plan lock so two people adding steps at once cannot get the same number.
        const step = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"treatment-plan:" + id}))`;
            const last = await tx.treatmentStep.findFirst({ where: { planId: id }, select: { stepNumber: true }, orderBy: { stepNumber: "desc" } });
            return tx.treatmentStep.create({
                data: {
                    planId: id,
                    stepNumber: (last?.stepNumber ?? 0) + 1,
                    title: title.trim(),
                    description: typeof description === "string" && description.trim() ? description.trim() : null,
                    estimatedCost: typeof estimatedCost === "number" ? estimatedCost : null,
                    status: "PENDING",
                    appointmentId: typeof appointmentId === "string" ? appointmentId : null,
                },
            });
        });

        await logAudit({
            tenantId,
            userId: "userId" in user ? (user as JWTPayload).userId : null,
            action: "TREATMENT_STEP_ADDED",
            entity: "TreatmentPlan",
            entityId: id,
            newValue: { stepId: step.id, stepNumber: step.stepNumber, hasCost: step.estimatedCost !== null },
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess({ step }, 201);
    } catch (error) {
        console.error("[TreatmentSteps] POST error:", error);
        return apiError("Internal server error", 500);
    }
}
