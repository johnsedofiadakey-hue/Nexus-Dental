// ============================================
// NEXUS DENTAL — System: Backups API
// GET  /api/system/backups — List backups
// POST /api/system/backups — Trigger backup
// ============================================

import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { triggerBackup, listBackups } from "@/lib/system";

function requireSystemOwner(request: NextRequest) {
    const authResult = requireAuth(request);
    if ("error" in authResult) return { error: authResult.error };
    if (authResult.user.type !== "SYSTEM_OWNER") {
        return { error: apiError("System owner access required", 403) };
    }
    return { user: authResult.user };
}

export async function GET(request: NextRequest) {
    try {
        const auth = requireSystemOwner(request);
        if ("error" in auth && auth.error) return auth.error;

        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type") as "FULL" | "INCREMENTAL" | "TENANT" | null;
        const status = searchParams.get("status") || undefined;
        const tenantId = searchParams.get("tenantId") || undefined;
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        const result = listBackups({
            type: type || undefined,
            status,
            tenantId,
            page,
            limit,
        });

        return apiSuccess(result);
    } catch (error) {
        console.error("[System] Backup list error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = requireSystemOwner(request);
        if ("error" in auth && auth.error) return auth.error;

        const body = await request.json();
        const { type, tenantId, retention } = body;

        if (!type || !["FULL", "INCREMENTAL", "TENANT"].includes(type)) {
            return apiError("type must be FULL, INCREMENTAL, or TENANT", 400);
        }

        if (type === "TENANT" && !tenantId) {
            return apiError("tenantId is required for TENANT backups", 400);
        }

        const backup = await triggerBackup(
            type,
            auth.user!.userId,
            tenantId,
            retention
        );

        return apiSuccess(backup, 201);
    } catch (error) {
        console.error("[System] Backup trigger error:", error);
        return apiError("Internal server error", 500);
    }
}
