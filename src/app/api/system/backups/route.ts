// ============================================
// NEXUS DENTAL — System: Backups API
// GET  /api/system/backups — List real backup history (BackupLog)
// POST /api/system/backups — Manually dispatch the backup workflow
//
// Actual backups run nightly via .github/workflows/backup.yml, which
// records each run through POST /api/system/backups/complete. This
// route never performs a backup itself.
// ============================================

import { NextRequest } from "next/server";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { triggerManualBackup, listBackups } from "@/lib/system";

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

        const result = await listBackups({
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

        const result = await triggerManualBackup(auth.user!.userId);
        return apiSuccess(result, result.dispatched ? 202 : 200);
    } catch (error) {
        console.error("[System] Backup dispatch error:", error);
        const msg = error instanceof Error ? error.message : "Internal server error";
        return apiError(msg, 500);
    }
}
