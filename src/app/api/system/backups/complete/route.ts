// ============================================
// NEXUS DENTAL — System: Backup Completion Callback
// POST /api/system/backups/complete
//
// Called only by .github/workflows/backup.yml (via scripts/run-backup.ts) after each
// nightly/manual backup run, and by scripts/restore-backup.ts --report after a strict
// restore drill. Authenticated by a shared secret, not a user JWT — there is no
// logged-in user on the other end.
//
// Fails closed: a COMPLETED backup that lacks any piece of proof (encrypted, current
// format, SHA-256, object path, plausible size, sane timestamps) is rejected with 400
// and NOTHING is written. See src/lib/backup/callback.ts for the rules.
// ============================================

import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/auth";
import { recordBackup, BackupProofError } from "@/lib/system/backups";
import { parseBackupCallback } from "@/lib/backup/callback";
import { isUsableSecret, secretMatches } from "@/lib/system/secret";

export async function POST(request: NextRequest) {
    try {
        const secret = process.env.BACKUP_WEBHOOK_SECRET;
        const provided = request.headers.get("x-backup-secret");

        if (!isUsableSecret(secret)) {
            console.error("[System] BACKUP_WEBHOOK_SECRET is not configured (or is a placeholder) — rejecting backup callback");
            return apiError("Not configured", 503);
        }
        if (!secretMatches(provided, secret)) {
            return apiError("Unauthorized", 401);
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return apiError("The body must be valid JSON.", 400);
        }

        const parsed = parseBackupCallback(body);
        if (!parsed.ok) return apiError(parsed.error, 400);
        const v = parsed.value;

        try {
            const backup = await recordBackup({
                type: v.type,
                status: v.status,
                filePath: v.filePath,
                fileSize: v.fileSize,
                sha256: v.sha256,
                encrypted: v.encrypted,
                formatVersion: v.formatVersion,
                triggeredBy: v.type === "RESTORE_DRILL" ? "restore-drill" : "github-actions",
                startedAt: v.startedAt,
                completedAt: v.completedAt,
                errorMessage: v.errorMessage,
                drill: v.drill,
            });
            return apiSuccess(backup, 201);
        } catch (error) {
            if (error instanceof BackupProofError) return apiError(error.message, 400);
            throw error;
        }
    } catch (error) {
        console.error("[System] Backup completion callback error:", error instanceof Error ? error.message : "unknown");
        return apiError("Internal server error", 500);
    }
}
