// ============================================
// NEXUS DENTAL — Inventory Management API
// GET  /api/clinical/inventory — List items
// POST /api/clinical/inventory — Create item
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
        const lowStockOnly = searchParams.get("lowStock") === "true";
        const search = searchParams.get("search");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");

        if (!tenantId) return apiError("tenantId is required", 400);

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const where: Record<string, unknown> = { tenantId };

        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
            ];
        }

        const [items, total] = await Promise.all([
            prisma.inventoryItem.findMany({
                where,
                orderBy: { name: "asc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.inventoryItem.count({ where }),
        ]);

        // Filter low-stock in-memory if requested
        const result = lowStockOnly
            ? items.filter((item) => item.quantity <= item.threshold)
            : items;

        return apiSuccess({
            items: result,
            pagination: {
                page,
                limit,
                total: lowStockOnly ? result.length : total,
                totalPages: Math.ceil((lowStockOnly ? result.length : total) / limit),
            },
        });
    } catch (error) {
        console.error("[Inventory] List error:", error);
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
        const { tenantId, name, sku, quantity, threshold, unit, cost, supplier, expiresAt } = body;

        if (!tenantId || !name) {
            return apiError("tenantId and name are required", 400);
        }

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const item = await prisma.inventoryItem.create({
            data: {
                tenantId,
                name,
                sku: sku || null,
                quantity: quantity || 0,
                threshold: threshold || 10,
                unit: unit || "units",
                cost: cost || null,
                supplier: supplier || null,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
        });

        // Audit
        await prisma.auditLog.create({
            data: {
                tenantId,
                userId: staffUser.userId,
                action: "INVENTORY_ITEM_CREATED",
                entity: "InventoryItem",
                entityId: item.id,
                newValue: { name, quantity, threshold },
            },
        });

        return apiSuccess(item, 201);
    } catch (error) {
        console.error("[Inventory] Create error:", error);
        return apiError("Internal server error", 500);
    }
}
