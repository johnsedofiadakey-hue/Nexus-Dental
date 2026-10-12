// ============================================
// NEXUS DENTAL — System Owner: Backup records
// Real backups run nightly via .github/workflows/backup.yml
// (scripts/run-backup.ts), which calls POST /api/system/backups/complete
// to record each run here. This module only reads/writes BackupLog —
// it does not perform the dump itself (see scripts/run-backup.ts).
//
// What a record must contain to COUNT as a backup is defined once, in
// src/lib/backup/validity.ts; the callback route enforces it before anything is written.
// ============================================

import prisma from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit/logger";
import { isValidCompletedFullBackup, type BackupRowLike } from "@/lib/backup/validity";
import type { DrillSummary } from "@/lib/backup/callback";
import { sendOpsAlert } from "./alerts";

/** The reported proof is well-formed but does not describe a real, recorded backup. The route answers 400. */
export class BackupProofError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BackupProofError";
    }
}

export interface BackupRecordInput {
    type: "FULL" | "INCREMENTAL" | "TENANT" | "RESTORE_DRILL";
    tenantId?: string | null;
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
    filePath?: string;
    fileSize?: number;
    sha256?: string;
    encrypted?: boolean;
    formatVersion?: number;
    triggeredBy: string;
    startedAt: Date;
    completedAt?: Date;
    errorMessage?: string;
    /** Strict-drill summary; recorded in the audit trail (there is no column for it). */
    drill?: DrillSummary;
}

/**
 * Record the outcome of a backup run (called from
 * POST /api/system/backups/complete, authenticated by shared secret —
 * this is the only writer of BackupLog).
 */
export async function recordBackup(input: BackupRecordInput) {
    // A completed drill must be about a backup we actually have a valid record of.
    if (input.type === "RESTORE_DRILL" && input.status === "COMPLETED") {
        const candidates = await prisma.backupLog.findMany({
            where: { type: "FULL", status: "COMPLETED", sha256: input.sha256 ?? "" },
            take: 5,
        });
        if (!input.sha256 || !candidates.some((row: BackupRowLike) => isValidCompletedFullBackup(row))) {
            throw new BackupProofError("The drill does not correspond to a recorded, valid, encrypted full backup.");
        }
    }

    const backup = await prisma.backupLog.create({
        data: {
            type: input.type,
            tenantId: input.tenantId ?? undefined,
            status: input.status,
            filePath: input.filePath,
            fileSize: input.fileSize ? BigInt(input.fileSize) : undefined,
            sha256: input.sha256,
            encrypted: input.encrypted ?? false,
            formatVersion: input.formatVersion,
            triggeredBy: input.triggeredBy,
            startedAt: input.startedAt,
            completedAt: input.completedAt,
            errorMessage: input.errorMessage,
        },
    });

    await logAudit({
        tenantId: null,
        userId: null,
        action: input.type === "RESTORE_DRILL"
            ? (input.status === "FAILED" ? "RESTORE_DRILL_FAILED" : "RESTORE_DRILL_COMPLETED")
            : (input.status === "FAILED" ? "BACKUP_FAILED" : "BACKUP_COMPLETED"),
        entity: "Backup",
        entityId: backup.id,
        newValue: {
            type: input.type,
            status: input.status,
            fileSize: input.fileSize,
            filePath: input.filePath,
            sha256: input.sha256,
            drill: input.drill,
        },
    });

    // Tell a human immediately; the hourly watchdog is the backstop if this never runs.
    if (input.status === "FAILED") {
        await sendOpsAlert(
            input.type === "RESTORE_DRILL" ? "restore-drill-failed" : "backup-failed",
            input.type === "RESTORE_DRILL" ? "Restore drill FAILED" : "Database backup FAILED",
            `A ${input.type === "RESTORE_DRILL" ? "restore drill" : "backup"} failed: ${(input.errorMessage ?? "no detail").slice(0, 200)}`
        );
    }

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
    type?: "FULL" | "INCREMENTAL" | "TENANT" | "RESTORE_DRILL";
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
    sha256?: string | null;
    encrypted?: boolean;
    formatVersion?: number | null;
}) {
    return {
        ...row,
        fileSize: row.fileSize !== null ? Number(row.fileSize) : null,
    };
}
