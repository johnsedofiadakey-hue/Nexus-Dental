// ============================================
// NEXUS DENTAL — What counts as a backup
//
// ONE definition, used in two places that must never disagree:
//   * the callback route, to decide whether a reported run may be recorded at all
//   * the health/watchdog checks, to decide whether a recorded run proves anything
//
// A backup record satisfies the dead-man check only if it carries every piece of
// proof the current backup job produces: encrypted, current format, SHA-256 of the
// stored object, the object's path, a plausible size and sane timestamps. Legacy
// plaintext rows and rows with missing metadata stay visible in history but can
// never make the system report "healthy".
// ============================================

import {
    BACKUP_FORMAT_VERSION,
    BACKUP_OBJECT_KEY,
    CLOCK_SKEW_MS,
    MAX_ENCRYPTED_BACKUP_BYTES,
    MIN_BACKUP_BYTES,
    SHA256_HEX,
} from "./constants";

export interface BackupRowLike {
    type: string;
    status: string;
    encrypted: boolean;
    formatVersion: number | null;
    sha256: string | null;
    filePath: string | null;
    fileSize: bigint | number | null;
    startedAt: Date | null;
    completedAt: Date | null;
}

const validDate = (d: unknown): d is Date => d instanceof Date && !Number.isNaN(d.getTime());

function sizeProblem(size: bigint | number | null): string | null {
    if (size === null || size === undefined) return "no file size";
    const n = typeof size === "bigint" ? Number(size) : size;
    if (!Number.isSafeInteger(n) || n <= 0) return "file size is not a positive integer";
    if (n < MIN_BACKUP_BYTES) return "file size is implausibly small";
    if (n > MAX_ENCRYPTED_BACKUP_BYTES) return "file size is implausibly large";
    return null;
}

function timeProblems(row: BackupRowLike, now: Date): string[] {
    const out: string[] = [];
    if (!validDate(row.startedAt)) out.push("no valid start time");
    if (!validDate(row.completedAt)) out.push("no valid completion time");
    if (validDate(row.startedAt) && validDate(row.completedAt)) {
        if (row.completedAt.getTime() < row.startedAt.getTime()) out.push("completed before it started");
    }
    if (validDate(row.completedAt) && row.completedAt.getTime() > now.getTime() + CLOCK_SKEW_MS) out.push("completion time is in the future");
    return out;
}

/** Reasons a record is NOT a valid completed encrypted full backup. Empty list = valid. */
export function fullBackupProblems(row: BackupRowLike, now: Date = new Date()): string[] {
    const out: string[] = [];
    if (row.type !== "FULL") out.push("not a full backup");
    if (row.status !== "COMPLETED") out.push("not completed");
    if (row.encrypted !== true) out.push("not marked encrypted");
    if (row.formatVersion !== BACKUP_FORMAT_VERSION) out.push("not the current backup format");
    if (typeof row.sha256 !== "string" || !SHA256_HEX.test(row.sha256)) out.push("no valid SHA-256");
    if (typeof row.filePath !== "string" || !BACKUP_OBJECT_KEY.test(row.filePath)) out.push("no valid object path");
    const size = sizeProblem(row.fileSize);
    if (size) out.push(size);
    out.push(...timeProblems(row, now));
    return out;
}

export function isValidCompletedFullBackup(row: BackupRowLike, now: Date = new Date()): boolean {
    return fullBackupProblems(row, now).length === 0;
}

/**
 * A restore drill counts only if it names the encrypted backup it restored (by SHA-256),
 * in the current format, and was recorded as completed with sane timestamps. The route
 * additionally requires that SHA-256 to belong to a valid recorded full backup.
 */
export function drillProblems(row: BackupRowLike, now: Date = new Date()): string[] {
    const out: string[] = [];
    if (row.type !== "RESTORE_DRILL") out.push("not a restore drill");
    if (row.status !== "COMPLETED") out.push("not completed");
    if (row.encrypted !== true) out.push("did not restore an encrypted backup");
    if (row.formatVersion !== BACKUP_FORMAT_VERSION) out.push("not the current backup format");
    if (typeof row.sha256 !== "string" || !SHA256_HEX.test(row.sha256)) out.push("does not name the backup it restored");
    out.push(...timeProblems(row, now));
    return out;
}

export function isValidCompletedDrill(row: BackupRowLike, now: Date = new Date()): boolean {
    return drillProblems(row, now).length === 0;
}
