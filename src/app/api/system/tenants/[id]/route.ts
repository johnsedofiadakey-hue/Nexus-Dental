// ============================================
// NEXUS DENTAL — System: Tenant Detail API
// GET   /api/system/tenants/[id] — Get tenant with stats
// PATCH /api/system/tenants/[id] — Update tenant (status, settings)
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { getTenantStats, changeTenantStatus, killSwitch } from "@/lib/system";
import { enableMaintenance, disableMaintenance } from "@/lib/system";
import type { TenantStatus } from "@prisma/client";

function requireSystemOwner(request: NextRequest) {
    const authResult = requireAuth(request);
    if ("error" in authResult) return { error: authResult.error };
    if (authResult.user.type !== "SYSTEM_OWNER") {
        return { error: apiError("System owner access required", 403) };
    }
    return { user: authResult.user };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = requireSystemOwner(request);
        if ("error" in auth && auth.error) return auth.error;

        const tenant = await prisma.tenant.findUnique({ where: { id } });
        if (!tenant) return apiError("Tenant not found", 404);

        const stats = await getTenantStats(id);

        return apiSuccess({ tenant, stats });
    } catch (error) {
        console.error("[System] Tenant detail error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = requireSystemOwner(request);
        if ("error" in auth && auth.error) return auth.error;

        const body = await request.json();
        const { action, reason, status, estimatedDuration, ...updateData } = body;

        // Action-based operations
        switch (action) {
            case "kill_switch": {
                if (!reason) return apiError("reason is required for kill switch", 400);
                const result = await killSwitch(id, reason, auth.user!.userId);
                return apiSuccess({ ...result, action: "kill_switch" });
            }

            case "enable_maintenance": {
                if (!reason) return apiError("reason is required", 400);
                const result = await enableMaintenance(
                    id,
                    reason,
                    estimatedDuration || "Unknown",
                    auth.user!.userId
                );
                return apiSuccess({ ...result, action: "maintenance_enabled" });
            }

            case "disable_maintenance": {
                const result = await disableMaintenance(id, auth.user!.userId);
                return apiSuccess({ ...result, action: "maintenance_disabled" });
            }

            case "change_status": {
                if (!status || !reason) {
                    return apiError("status and reason are required", 400);
                }
                const result = await changeTenantStatus(
                    id,
                    status as TenantStatus,
                    reason,
                    auth.user!.userId
                );
                return apiSuccess(result);
            }

            default: {
                // Regular field updates
                const allowedFields = ["name", "email", "phone", "address", "timezone", "logo", "website"];
                const data: Record<string, unknown> = {};
                for (const field of allowedFields) {
                    if (updateData[field] !== undefined) {
                        data[field] = updateData[field];
                    }
                }

                if (Object.keys(data).length === 0) {
                    return apiError("No valid fields or action specified", 400);
                }

                const updated = await prisma.tenant.update({
                    where: { id },
                    data,
                });

                return apiSuccess(updated);
            }
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Internal server error";
        console.error("[System] Tenant update error:", error);
        return apiError(message, message.includes("not found") ? 404 : 500);
    }
}
