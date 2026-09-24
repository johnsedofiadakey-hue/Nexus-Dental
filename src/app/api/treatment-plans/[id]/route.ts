import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    requirePermission,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";

const PLAN_STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED", "ON_HOLD"];
const STEP_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED"];

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permissionError = requirePermission(user, PERMISSIONS.PATIENTS_VIEW);
        if (permissionError) return permissionError;

        const tenantId = user.tenantId;
        if (!tenantId) return apiError("No tenant associated with user", 400);

        const { id } = await params;

        const plan = await prisma.treatmentPlan.findFirst({
            where: { id, tenantId, deletedAt: null },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, phone: true, dateOfBirth: true } },
                steps: { orderBy: { stepNumber: "asc" } },
                doctor: { select: { id: true, firstName: true, lastName: true } },
            },
        });

        if (!plan) return apiError("Treatment plan not found", 404);

        return apiSuccess({ plan });
    } catch (error) {
        console.error("[TreatmentPlans] GET single error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permissionError = requirePermission(user, PERMISSIONS.PATIENTS_UPDATE);
        if (permissionError) return permissionError;

        const tenantId = user.tenantId;
        if (!tenantId) return apiError("No tenant associated with user", 400);

        const { id } = await params;
        const body = await request.json();
        const { status, title, description, notes } = body;

        if (status && !PLAN_STATUSES.includes(status)) {
            return apiError(`status must be one of: ${PLAN_STATUSES.join(", ")}`, 400);
        }

        const existing = await prisma.treatmentPlan.findFirst({
            where: { id, tenantId, deletedAt: null },
        });
        if (!existing) return apiError("Treatment plan not found", 404);

        const plan = await prisma.treatmentPlan.update({
            where: { id },
            data: {
                ...(status && { status }),
                ...(title && { title }),
                ...(description !== undefined && { description }),
                ...(notes !== undefined && { notes }),
            },
        });

        return apiSuccess({ plan });
    } catch (error) {
        console.error("[TreatmentPlans] PATCH error:", error);
        return apiError("Internal server error", 500);
    }
}
