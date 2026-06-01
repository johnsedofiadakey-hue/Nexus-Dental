import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, enforceTenantScope, apiError, apiSuccess } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const review = await prisma.review.findUnique({ where: { id } });
        if (!review) return apiError("Review not found", 404);

        // System owners can moderate any review; clinic staff moderate their own tenant
        if (user.type !== "SYSTEM_OWNER") {
            const check = enforceTenantScope(user, review.tenantId);
            if (check) return check;
        }

        const body = await request.json();
        const updated = await prisma.review.update({ where: { id }, data: { isApproved: body.isApproved } });
        return apiSuccess(updated);
    } catch (error) {
        return apiError("Internal server error", 500);
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const review = await prisma.review.findUnique({ where: { id } });
        if (!review) return apiError("Review not found", 404);

        if (user.type !== "SYSTEM_OWNER") {
            const check = enforceTenantScope(user, review.tenantId);
            if (check) return check;
        }

        await prisma.review.delete({ where: { id } });
        return apiSuccess({ deleted: true });
    } catch (error) {
        return apiError("Internal server error", 500);
    }
}
