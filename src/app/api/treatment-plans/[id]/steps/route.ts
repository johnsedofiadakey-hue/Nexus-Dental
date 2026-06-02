import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    apiError,
    apiSuccess,
} from "@/lib/auth";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const tenantId = user.tenantId;
        if (!tenantId) return apiError("No tenant associated with user", 400);

        const { id } = await params;
        const body = await request.json();
        const { title, description, estimatedCost, scheduledDate, appointmentId } = body;

        if (!title) return apiError("title is required", 400);

        const plan = await prisma.treatmentPlan.findFirst({
            where: { id, tenantId, deletedAt: null },
            include: { steps: { select: { stepNumber: true }, orderBy: { stepNumber: "desc" }, take: 1 } },
        });
        if (!plan) return apiError("Treatment plan not found", 404);

        const nextStep = (plan.steps[0]?.stepNumber ?? 0) + 1;

        const step = await prisma.treatmentStep.create({
            data: {
                planId: id,
                stepNumber: nextStep,
                title,
                description: description ?? null,
                estimatedCost: estimatedCost ?? null,
                status: "PENDING",
                appointmentId: appointmentId ?? null,
            },
        });

        return apiSuccess({ step }, 201);
    } catch (error) {
        console.error("[TreatmentSteps] POST error:", error);
        return apiError("Internal server error", 500);
    }
}
