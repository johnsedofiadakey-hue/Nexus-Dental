// ============================================
// NEXUS DENTAL — Inventory Adjust API
// POST /api/clinical/inventory/adjust
// ============================================

import { NextRequest } from "next/server";
import {
    requireAuth,
    enforceTenantScope,
    requirePermission,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import { adjustInventory } from "@/lib/clinical";
import type { JWTPayload } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.INVENTORY_ADJUST);
        if (permCheck) return permCheck;

        const staffUser = user as JWTPayload;
        const body = await request.json();
        const { tenantId, itemId, adjustment, reason } = body;

        if (!tenantId || !itemId || adjustment === undefined || !reason) {
            return apiError(
                "tenantId, itemId, adjustment, and reason are required",
                400
            );
        }

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const result = await adjustInventory(
            tenantId,
            itemId,
            adjustment,
            reason,
            staffUser.userId
        );

        return apiSuccess(result);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Internal server error";
        console.error("[Inventory] Adjust error:", error);
        return apiError(message, 400);
    }
}
