// ============================================
// NEXUS DENTAL — Supplier [id] API
// PATCH /api/suppliers/[id] — Update supplier
// DELETE /api/suppliers/[id] — Soft delete
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
import type { JWTPayload } from "@/lib/auth";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.INVENTORY_UPDATE);
        if (permCheck) return permCheck;

        const { id } = await params;
        const body = await request.json();
        const { tenantId, ...fields } = body;

        if (!tenantId) return apiError("tenantId is required", 400);

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const existing = await prisma.supplier.findFirst({ where: { id, tenantId } });
        if (!existing) return apiError("Supplier not found", 404);

        const updated = await prisma.supplier.update({
            where: { id },
            data: {
                name: fields.name ?? undefined,
                contactPerson: fields.contactPerson ?? undefined,
                email: fields.email ?? undefined,
                phone: fields.phone ?? undefined,
                address: fields.address ?? undefined,
                category: fields.category ?? undefined,
                paymentTerms: fields.paymentTerms ?? undefined,
                leadTimeDays: fields.leadTimeDays ?? undefined,
                notes: fields.notes ?? undefined,
                isActive: fields.isActive ?? undefined,
            },
        });

        const staffUser = user as JWTPayload;
        await prisma.auditLog.create({
            data: {
                tenantId,
                userId: staffUser.userId,
                action: "SUPPLIER_UPDATED",
                entity: "Supplier",
                entityId: id,
                oldValue: existing as Record<string, unknown>,
                newValue: fields as Record<string, unknown>,
            },
        });

        return apiSuccess(updated);
    } catch (error) {
        console.error("[Suppliers] Update error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.INVENTORY_UPDATE);
        if (permCheck) return permCheck;

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");

        if (!tenantId) return apiError("tenantId is required", 400);

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const existing = await prisma.supplier.findFirst({ where: { id, tenantId } });
        if (!existing) return apiError("Supplier not found", 404);

        await prisma.supplier.update({ where: { id }, data: { isActive: false } });

        const staffUser = user as JWTPayload;
        await prisma.auditLog.create({
            data: {
                tenantId,
                userId: staffUser.userId,
                action: "SUPPLIER_DEACTIVATED",
                entity: "Supplier",
                entityId: id,
            },
        });

        return apiSuccess({ message: "Supplier deactivated" });
    } catch (error) {
        console.error("[Suppliers] Delete error:", error);
        return apiError("Internal server error", 500);
    }
}
