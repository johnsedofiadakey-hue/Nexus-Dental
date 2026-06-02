import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    apiError,
    apiSuccess,
} from "@/lib/auth";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; stepId: string }> }
) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const tenantId = user.tenantId;
        if (!tenantId) return apiError("No tenant associated with user", 400);

        const { id, stepId } = await params;
        const body = await request.json();
        const { status, notes } = body;

        const plan = await prisma.treatmentPlan.findFirst({
            where: { id, tenantId, deletedAt: null },
        });
        if (!plan) return apiError("Treatment plan not found", 404);

        const existing = await prisma.treatmentStep.findFirst({
            where: { id: stepId, planId: id },
        });
        if (!existing) return apiError("Step not found", 404);

        const step = await prisma.treatmentStep.update({
            where: { id: stepId },
            data: {
                ...(status && { status }),
                ...(notes !== undefined && { notes }),
                ...(status === "COMPLETED" && { completedAt: new Date() }),
            },
        });

        return apiSuccess({ step });
    } catch (error) {
        console.error("[TreatmentSteps] PATCH error:", error);
        return apiError("Internal server error", 500);
    }
}
