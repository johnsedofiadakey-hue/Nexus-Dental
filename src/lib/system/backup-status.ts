// ============================================
// NEXUS DENTAL — Backup freshness (dead-man check)
//
// A backup that silently stops running is the failure that ends clinics, so
// freshness is judged from what the database RECORDS, independently of whether
// the backup job ever managed to report a failure.
//
// Only a VALID record counts (src/lib/backup/validity.ts): a recent FULL row,
// COMPLETED, encrypted, current format, with a SHA-256, an object path, a plausible
// size and sane timestamps. Legacy / plaintext / metadata-incomplete rows stay in
// the history but never make backup health "ok".
// ============================================

import prisma from "@/lib/db/prisma";
import { BACKUP_FORMAT_VERSION } from "@/lib/backup/constants";
import { isValidCompletedDrill, isValidCompletedFullBackup, type BackupRowLike } from "@/lib/backup/validity";
import { sendOpsAlert, type AlertOutcome } from "./alerts";

export const BACKUP_MAX_AGE_HOURS = 26;
export const DRILL_MAX_AGE_DAYS = 35;

/** How many of the newest candidate rows to examine when looking for the latest VALID one. */
const CANDIDATES = 25;

export type BackupState = "ok" | "stale" | "failed" | "never";
export type DrillState = "ok" | "overdue" | "never";

export interface BackupStatus {
    backup: BackupState;
    drill: DrillState;
    /** Completion time of the newest VALID backup, never of a legacy/incomplete row. */
    lastBackupAt: string | null;
    /** Completion time of the newest VALID strict restore drill. */
    lastDrillAt: string | null;
}

const newestValid = (rows: BackupRowLike[], valid: (r: BackupRowLike, now: Date) => boolean, now: Date) =>
    rows
        .filter((r) => valid(r, now))
        .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))[0] ?? null;

export async function getBackupStatus(now: Date = new Date()): Promise<BackupStatus> {
    // The SQL pre-filter only narrows the candidates; the shared predicate decides.
    const proofFilter = { status: "COMPLETED" as const, encrypted: true, formatVersion: BACKUP_FORMAT_VERSION, sha256: { not: null }, completedAt: { not: null } };
    const [latestTerminal, fullCandidates, drillCandidates] = await Promise.all([
        prisma.backupLog.findFirst({ where: { type: "FULL", status: { in: ["COMPLETED", "FAILED"] } }, orderBy: { startedAt: "desc" } }),
        prisma.backupLog.findMany({ where: { type: "FULL", ...proofFilter, filePath: { not: null } }, orderBy: { completedAt: "desc" }, take: CANDIDATES }),
        prisma.backupLog.findMany({ where: { type: "RESTORE_DRILL", ...proofFilter }, orderBy: { completedAt: "desc" }, take: CANDIDATES }),
    ]);

    const lastGoodFull = newestValid(fullCandidates, isValidCompletedFullBackup, now);
    const lastGoodDrill = newestValid(drillCandidates, isValidCompletedDrill, now);

    let backup: BackupState;
    if (latestTerminal?.status === "FAILED") backup = "failed";
    else if (!lastGoodFull?.completedAt) backup = "never"; // includes "only legacy / incomplete rows exist"
    else if (now.getTime() - lastGoodFull.completedAt.getTime() > BACKUP_MAX_AGE_HOURS * 3600_000) backup = "stale";
    else backup = "ok";

    let drill: DrillState;
    if (!lastGoodDrill?.completedAt) drill = "never";
    else drill = now.getTime() - lastGoodDrill.completedAt.getTime() > DRILL_MAX_AGE_DAYS * 86400_000 ? "overdue" : "ok";

    return {
        backup,
        drill,
        lastBackupAt: lastGoodFull?.completedAt?.toISOString() ?? null,
        lastDrillAt: lastGoodDrill?.completedAt?.toISOString() ?? null,
    };
}

export interface BackupAlertOutcomes {
    backup?: AlertOutcome;
    drill?: AlertOutcome;
}

/** Raise an alert for each unhealthy condition. Safe to run as often as you like (alerts are rate-limited). */
export async function checkBackupsAndAlert(now: Date = new Date(), status?: BackupStatus): Promise<BackupStatus & { alerts: BackupAlertOutcomes }> {
    const s = status ?? (await getBackupStatus(now));
    const alerts: BackupAlertOutcomes = {};
    if (s.backup === "failed") {
        alerts.backup = await sendOpsAlert("backup-failed", "The latest database backup FAILED", `The most recent backup run failed. Last valid backup: ${s.lastBackupAt ?? "none recorded"}. Check the Nightly Database Backup workflow.`, { now });
    } else if (s.backup === "stale") {
        alerts.backup = await sendOpsAlert("backup-stale", "No recent database backup", `No valid encrypted backup has been recorded in the last ${BACKUP_MAX_AGE_HOURS} hours (last: ${s.lastBackupAt ?? "none"}). The backup job may not be running.`, { now });
    } else if (s.backup === "never") {
        alerts.backup = await sendOpsAlert("backup-never", "No valid database backup has ever been recorded", "No complete, encrypted backup record exists for this clinic (older plaintext or incomplete records do not count). Backups are not protecting this data yet.", { now });
    }
    if (s.drill === "overdue" || s.drill === "never") {
        alerts.drill = await sendOpsAlert("restore-drill-overdue", "Restore drill overdue", `No successful strict restore drill has been recorded in the last ${DRILL_MAX_AGE_DAYS} days (last: ${s.lastDrillAt ?? "never"}). An untested backup is not a backup.`, { now, minIntervalHours: 24 });
    }
    return { ...s, alerts };
}
