import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, requirePermission, enforceTenantScope, PERMISSIONS, apiError, apiSuccess } from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.SERVICES_MANAGE);
        if (permCheck) return permCheck;

        const staffUser = user as JWTPayload;
        const body = await request.json();

        const service = await prisma.service.findUnique({ where: { id } });
        if (!service) return apiError("Service not found", 404);

        const tenantCheck = enforceTenantScope(user, service.tenantId);
        if (tenantCheck) return tenantCheck;

        const updated = await prisma.service.update({
            where: { id },
            data: {
                ...(body.name !== undefined && { name: body.name }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.category !== undefined && { category: body.category }),
                ...(body.price !== undefined && { price: parseFloat(body.price) }),
                ...(body.duration !== undefined && { duration: parseInt(body.duration) }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
            },
        });

        return apiSuccess(updated);
    } catch (error) {
        console.error("[Services] PATCH error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.SERVICES_MANAGE);
        if (permCheck) return permCheck;

        const service = await prisma.service.findUnique({ where: { id } });
        if (!service) return apiError("Service not found", 404);

        const tenantCheck = enforceTenantScope(user, service.tenantId);
        if (tenantCheck) return tenantCheck;

        // Soft-delete: deactivate rather than hard delete (preserves appointment history)
        await prisma.service.update({ where: { id }, data: { isActive: false } });
        return apiSuccess({ deleted: true });
    } catch (error) {
        console.error("[Services] DELETE error:", error);
        return apiError("Internal server error", 500);
    }
}
