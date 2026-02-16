// ============================================
// NEXUS DENTAL — Override Actions API
// POST /api/clinical/overrides — Execute override
// GET  /api/clinical/overrides — Override history
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
import {
    overrideAppointmentStatus,
    overrideBuffer,
    getOverrideHistory,
} from "@/lib/clinical";
import { getClientIP, getUserAgent } from "@/lib/audit/logger";
import type { JWTPayload } from "@/lib/auth";
import type { OverrideAction } from "@prisma/client";

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const staffUser = user as JWTPayload;
        const body = await request.json();
        const { tenantId, action, entityId, newStatus, reason } = body;

        if (!tenantId || !action || !entityId || !reason) {
            return apiError(
                "tenantId, action, entityId, and reason are required",
                400
            );
        }

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const ip = getClientIP(request.headers);
        const ua = getUserAgent(request.headers);

        switch (action as OverrideAction) {
            case "APPOINTMENT_STATUS_CHANGE": {
                const permCheck = requirePermission(
                    user,
                    PERMISSIONS.APPOINTMENTS_OVERRIDE
                );
                if (permCheck) return permCheck;

                if (!newStatus) {
                    return apiError("newStatus is required for status overrides", 400);
                }

                const result = await overrideAppointmentStatus(
                    tenantId,
                    entityId,
                    newStatus,
                    reason,
                    staffUser.userId,
                    ip,
                    ua
                );
                return apiSuccess(result);
            }

            case "BUFFER_REMOVAL": {
                const permCheck = requirePermission(
                    user,
                    PERMISSIONS.APPOINTMENTS_OVERRIDE
                );
                if (permCheck) return permCheck;

                const result = await overrideBuffer(
                    tenantId,
                    entityId,
                    reason,
                    staffUser.userId,
                    ip,
                    ua
                );
                return apiSuccess(result);
            }

            case "INVENTORY_ADJUST": {
                const permCheck = requirePermission(
                    user,
                    PERMISSIONS.INVENTORY_OVERRIDE
                );
                if (permCheck) return permCheck;

                return apiError(
                    "Use /api/clinical/inventory/adjust for inventory adjustments",
                    400
                );
            }

            default:
                return apiError(`Unsupported override action: ${action}`, 400);
        }
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Internal server error";
        console.error("[Override] Error:", error);
        return apiError(message, 400);
    }
}

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.AUDIT_VIEW);
        if (permCheck) return permCheck;

        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");
        const action = searchParams.get("action") as OverrideAction | null;
        const userId = searchParams.get("userId");
        const entity = searchParams.get("entity");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        if (!tenantId) return apiError("tenantId is required", 400);

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const result = await getOverrideHistory(tenantId, {
            action: action || undefined,
            userId: userId || undefined,
            entity: entity || undefined,
            dateFrom: dateFrom ? new Date(dateFrom) : undefined,
            dateTo: dateTo ? new Date(dateTo) : undefined,
            page,
            limit,
        });

        return apiSuccess(result);
    } catch (error) {
        console.error("[Override] History error:", error);
        return apiError("Internal server error", 500);
    }
}
