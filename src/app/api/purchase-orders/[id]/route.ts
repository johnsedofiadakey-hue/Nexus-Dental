// ============================================
// NEXUS DENTAL — Purchase Order [id] API
// PATCH /api/purchase-orders/[id] — Update status
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

interface POItem {
    name: string;
    qty: number;
    unitPrice: number;
    unit: string;
}

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
        const { tenantId, status, notes, expectedAt } = body;

        if (!tenantId) return apiError("tenantId is required", 400);

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const existing = await prisma.purchaseOrder.findFirst({ where: { id, tenantId } });
        if (!existing) return apiError("Purchase order not found", 404);

        const updateData: Record<string, unknown> = {};
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;
        if (expectedAt !== undefined) updateData.expectedAt = expectedAt ? new Date(expectedAt) : null;

        // When status becomes RECEIVED, stamp receivedAt and update inventory
        if (status === "RECEIVED") {
            updateData.receivedAt = new Date();

            // Best-effort inventory update: match by name within tenant
            const items = existing.items as POItem[];
            for (const item of items) {
                try {
                    await prisma.inventoryItem.updateMany({
                        where: { tenantId, name: { equals: item.name, mode: "insensitive" } },
                        data: { quantity: { increment: item.qty } },
                    });
                } catch {
                    // Best effort — continue even if individual item update fails
                }
            }
        }

        const updated = await prisma.purchaseOrder.update({
            where: { id },
            data: updateData,
            include: {
                supplier: { select: { id: true, name: true } },
            },
        });

        const staffUser = user as JWTPayload;
        await prisma.auditLog.create({
            data: {
                tenantId,
                userId: staffUser.userId,
                action: "PURCHASE_ORDER_UPDATED",
                entity: "PurchaseOrder",
                entityId: id,
                oldValue: { status: existing.status } as Record<string, unknown>,
                newValue: { status } as Record<string, unknown>,
            },
        });

        return apiSuccess(updated);
    } catch (error) {
        console.error("[PurchaseOrders] Update error:", error);
        return apiError("Internal server error", 500);
    }
}
