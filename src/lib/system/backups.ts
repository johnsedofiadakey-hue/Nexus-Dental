// ============================================
// NEXUS DENTAL — System Owner: Backup System
// Real backups run nightly via .github/workflows/backup.yml
// (scripts/run-backup.js), which calls POST /api/system/backups/complete
// to record each run here. This module only reads/writes BackupLog —
// it does not perform the dump itself (see scripts/run-backup.js).
// ============================================

import prisma from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit/logger";

export interface BackupRecordInput {
    type: "FULL" | "INCREMENTAL" | "TENANT";
    tenantId?: string | null;
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
    filePath?: string;
    fileSize?: number;
    triggeredBy: string;
    startedAt: Date;
    completedAt?: Date;
    errorMessage?: string;
}

/**
 * Record the outcome of a backup run (called from
 * POST /api/system/backups/complete, authenticated by shared secret —
 * this is the only writer of BackupLog).
 */
export async function recordBackup(input: BackupRecordInput) {
    const backup = await prisma.backupLog.create({
        data: {
            type: input.type,
            tenantId: input.tenantId ?? undefined,
            status: input.status,
            filePath: input.filePath,
            fileSize: input.fileSize ? BigInt(input.fileSize) : undefined,
            triggeredBy: input.triggeredBy,
            startedAt: input.startedAt,
            completedAt: input.completedAt,
            errorMessage: input.errorMessage,
        },
    });

    await logAudit({
        tenantId: null,
        userId: null,
        action: input.status === "FAILED" ? "BACKUP_FAILED" : "BACKUP_COMPLETED",
        entity: "Backup",
        entityId: backup.id,
        newValue: {
            type: input.type,
            status: input.status,
            fileSize: input.fileSize,
            filePath: input.filePath,
        },
    });

    return serializeBackup(backup);
}

/**
 * Dispatch a manual "run now" backup via the GitHub Actions workflow.
 * Does not write a BackupLog row itself — the workflow calls recordBackup()
 * via the /complete endpoint once it finishes. Requires GITHUB_ACTIONS_TOKEN
 * (a PAT with `actions:write` on this repo) and GITHUB_REPO to be set.
 */
export async function triggerManualBackup(systemOwnerId: string): Promise<{ dispatched: boolean; message: string }> {
    const token = process.env.GITHUB_ACTIONS_TOKEN;
    const repo = process.env.GITHUB_REPO; // "owner/name"

    if (!token || !repo) {
        return {
            dispatched: false,
            message:
                "Manual dispatch isn't configured (GITHUB_ACTIONS_TOKEN/GITHUB_REPO missing). " +
                "The nightly backup still runs automatically at 03:00 UTC — trigger it directly " +
                "from the Actions tab in GitHub if you need one right now.",
        };
    }

    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/backup.yml/dispatches`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`GitHub workflow dispatch failed (${res.status}): ${text}`);
    }

    await logAudit({
        tenantId: null,
        userId: systemOwnerId,
        action: "BACKUP_MANUAL_DISPATCH",
        entity: "Backup",
        entityId: "manual",
        newValue: { dispatchedAt: new Date().toISOString() },
    });

    return {
        dispatched: true,
        message: "Backup workflow dispatched — it takes a few minutes to appear in the list below once it completes.",
    };
}

/**
 * List backup history from BackupLog.
 */
export async function listBackups(filters?: {
    type?: "FULL" | "INCREMENTAL" | "TENANT";
    status?: string;
    tenantId?: string;
    page?: number;
    limit?: number;
}) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    const where = {
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.status ? { status: filters.status as "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" } : {}),
        ...(filters?.tenantId ? { tenantId: filters.tenantId } : {}),
    };

    const [rows, total] = await Promise.all([
        prisma.backupLog.findMany({
            where,
            orderBy: { startedAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.backupLog.count({ where }),
    ]);

    return {
        backups: rows.map(serializeBackup),
        pagination: { page, limit, total },
    };
}

/**
 * Get a single backup by ID.
 */
export async function getBackupById(id: string) {
    const row = await prisma.backupLog.findUnique({ where: { id } });
    return row ? serializeBackup(row) : null;
}

// BigInt isn't JSON-serializable — convert file size to a plain number for API responses.
function serializeBackup(row: {
    id: string;
    type: string;
    tenantId: string | null;
    status: string;
    filePath: string | null;
    fileSize: bigint | null;
    triggeredBy: string;
    startedAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
}) {
    return {
        ...row,
        fileSize: row.fileSize !== null ? Number(row.fileSize) : null,
    };
}
