// ============================================
// NEXUS DENTAL — Purchase Orders API
// GET  /api/purchase-orders — List POs
// POST /api/purchase-orders — Create PO
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

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.INVENTORY_VIEW);
        if (permCheck) return permCheck;

        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");
        const status = searchParams.get("status") ?? undefined;

        if (!tenantId) return apiError("tenantId is required", 400);

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const where: Record<string, unknown> = { tenantId };
        if (status) where.status = status;

        const orders = await prisma.purchaseOrder.findMany({
            where,
            include: {
                supplier: { select: { id: true, name: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return apiSuccess(orders);
    } catch (error) {
        console.error("[PurchaseOrders] List error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.INVENTORY_CREATE);
        if (permCheck) return permCheck;

        const staffUser = user as JWTPayload;
        const body = await request.json();
        const { tenantId, supplierId, items, notes, expectedAt } = body;

        if (!tenantId || !supplierId || !Array.isArray(items) || items.length === 0) {
            return apiError("tenantId, supplierId, and items are required", 400);
        }

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        // Auto-generate orderNo: PO-YYYY-NNN
        const year = new Date().getFullYear();
        const count = await prisma.purchaseOrder.count({ where: { tenantId } });
        const seq = String(count + 1).padStart(3, "0");
        const orderNo = `PO-${year}-${seq}`;

        // Calculate total from items
        const totalAmount = (items as { name: string; qty: number; unitPrice: number; unit: string }[]).reduce(
            (sum, item) => sum + item.qty * item.unitPrice,
            0
        );

        const po = await prisma.purchaseOrder.create({
            data: {
                tenantId,
                supplierId,
                createdById: staffUser.userId,
                orderNo,
                items,
                totalAmount,
                notes: notes ?? null,
                expectedAt: expectedAt ? new Date(expectedAt) : null,
            },
            include: {
                supplier: { select: { id: true, name: true } },
            },
        });

        await prisma.auditLog.create({
            data: {
                tenantId,
                userId: staffUser.userId,
                action: "PURCHASE_ORDER_CREATED",
                entity: "PurchaseOrder",
                entityId: po.id,
                newValue: { orderNo, supplierId, totalAmount },
            },
        });

        return apiSuccess(po, 201);
    } catch (error) {
        console.error("[PurchaseOrders] Create error:", error);
        return apiError("Internal server error", 500);
    }
}
