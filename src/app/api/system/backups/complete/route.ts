// ============================================
// NEXUS DENTAL — System: Backup Completion Callback
// POST /api/system/backups/complete
//
// Called only by .github/workflows/backup.yml (via scripts/run-backup.js)
// after each nightly/manual backup run. Authenticated by a shared secret,
// not a user JWT — there is no logged-in user on the other end.
// ============================================

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/auth";
import { recordBackup } from "@/lib/system";

export async function POST(request: NextRequest) {
    try {
        const secret = process.env.BACKUP_WEBHOOK_SECRET;
        const provided = request.headers.get("x-backup-secret");

        if (!secret) {
            console.error("[System] BACKUP_WEBHOOK_SECRET is not configured — rejecting backup callback");
            return apiError("Not configured", 503);
        }
        if (!provided || provided !== secret) {
            return apiError("Unauthorized", 401);
        }

        const body = await request.json();
        const { type, tenantId, status, filePath, fileSize, startedAt, completedAt, errorMessage } = body;

        if (!type || !["FULL", "INCREMENTAL", "TENANT"].includes(type)) {
            return apiError("type must be FULL, INCREMENTAL, or TENANT", 400);
        }
        if (!status || !["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"].includes(status)) {
            return apiError("status must be PENDING, IN_PROGRESS, COMPLETED, or FAILED", 400);
        }
        if (!startedAt) {
            return apiError("startedAt is required", 400);
        }

        const backup = await recordBackup({
            type,
            tenantId: tenantId || null,
            status,
            filePath,
            fileSize,
            triggeredBy: "github-actions",
            startedAt: new Date(startedAt),
            completedAt: completedAt ? new Date(completedAt) : undefined,
            errorMessage,
        });

        return apiSuccess(backup, 201);
    } catch (error) {
        console.error("[System] Backup completion callback error:", error);
        return apiError("Internal server error", 500);
    }
}
