// ============================================
// NEXUS DENTAL — Backup callback validation
//
// POST /api/system/backups/complete is how the nightly job (and a restore drill)
// tells the app what happened. This module decides, as a pure function, whether a
// body may be recorded. It fails closed:
//   * unknown fields are rejected, not silently dropped (a misspelled `sha_256` must
//     not produce a "completed" row that merely lacks its proof)
//   * a COMPLETED full backup must carry every piece of proof, or nothing is written
//   * proof fields are validated for type, bounds and consistency, never coerced
// ============================================

import {
    BACKUP_FORMAT_VERSION,
    BACKUP_OBJECT_KEY,
    CLOCK_SKEW_MS,
    MAX_ENCRYPTED_BACKUP_BYTES,
    MIN_BACKUP_BYTES,
    SHA256_HEX,
} from "./constants";

export interface DrillSummary {
    strict: true;
    tenants: 1;
    tables: number;
    checks: number;
}

export interface ParsedBackupCallback {
    type: "FULL" | "RESTORE_DRILL";
    status: "COMPLETED" | "FAILED";
    startedAt: Date;
    completedAt?: Date;
    filePath?: string;
    fileSize?: number;
    sha256?: string;
    encrypted: boolean;
    formatVersion?: number;
    errorMessage?: string;
    drill?: DrillSummary;
}

export type CallbackParse = { ok: true; value: ParsedBackupCallback } | { ok: false; error: string };

const ALLOWED_KEYS = new Set(["type", "status", "startedAt", "completedAt", "filePath", "fileSize", "sha256", "encrypted", "formatVersion", "errorMessage", "drill"]);
const DRILL_KEYS = new Set(["strict", "tenants", "tables", "checks"]);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

/** A reported run is recorded right after it ends; anything older than this is not a report of "now". */
export const CALLBACK_MAX_AGE_MS = 24 * 3600_000;
/** Longest plausible run (the workflow itself times out at 30 minutes). */
export const CALLBACK_MAX_DURATION_MS = 6 * 3600_000;
export const ERROR_MESSAGE_MAX = 500;

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);

function parseDate(v: unknown): Date | null {
    if (typeof v !== "string" || !ISO.test(v)) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

const fail = (error: string): CallbackParse => ({ ok: false, error });

export function parseBackupCallback(body: unknown, now: Date = new Date()): CallbackParse {
    if (!isPlainObject(body)) return fail("The body must be a JSON object.");
    for (const key of Object.keys(body)) {
        if (!ALLOWED_KEYS.has(key)) return fail(`Unexpected field "${key.slice(0, 40)}".`);
    }

    const { type, status } = body;
    if (type !== "FULL" && type !== "RESTORE_DRILL") return fail("type must be FULL or RESTORE_DRILL.");
    if (status !== "COMPLETED" && status !== "FAILED") return fail("status must be COMPLETED or FAILED.");

    const startedAt = parseDate(body.startedAt);
    if (!startedAt) return fail("startedAt must be an ISO-8601 timestamp.");
    if (startedAt.getTime() > now.getTime() + CLOCK_SKEW_MS) return fail("startedAt is in the future.");
    if (now.getTime() - startedAt.getTime() > CALLBACK_MAX_AGE_MS + CALLBACK_MAX_DURATION_MS) return fail("startedAt is too old to be a report of a run that just ended.");

    let completedAt: Date | undefined;
    if (body.completedAt !== undefined && body.completedAt !== null) {
        const d = parseDate(body.completedAt);
        if (!d) return fail("completedAt must be an ISO-8601 timestamp.");
        if (d.getTime() < startedAt.getTime()) return fail("completedAt is before startedAt.");
        if (d.getTime() > now.getTime() + CLOCK_SKEW_MS) return fail("completedAt is in the future.");
        if (d.getTime() - startedAt.getTime() > CALLBACK_MAX_DURATION_MS) return fail("The run is implausibly long.");
        if (now.getTime() - d.getTime() > CALLBACK_MAX_AGE_MS) return fail("completedAt is too old to be a report of a run that just ended.");
        completedAt = d;
    }

    const errorMessage = body.errorMessage;
    if (errorMessage !== undefined && errorMessage !== null && typeof errorMessage !== "string") return fail("errorMessage must be a string.");

    // Optional proof fields: when present they must be well-formed whatever the status.
    const { filePath, fileSize, sha256, encrypted, formatVersion, drill } = body;
    if (filePath !== undefined && filePath !== null && (typeof filePath !== "string" || filePath.length > 512)) return fail("filePath must be a short string.");
    if (fileSize !== undefined && fileSize !== null && (!isInt(fileSize) || fileSize <= 0)) return fail("fileSize must be a positive integer.");
    if (sha256 !== undefined && sha256 !== null && (typeof sha256 !== "string" || !SHA256_HEX.test(sha256))) return fail("sha256 must be 64 lowercase hex characters.");
    if (encrypted !== undefined && encrypted !== null && typeof encrypted !== "boolean") return fail("encrypted must be true or false.");
    if (formatVersion !== undefined && formatVersion !== null && !isInt(formatVersion)) return fail("formatVersion must be an integer.");

    const value: ParsedBackupCallback = {
        type,
        status,
        startedAt,
        completedAt,
        filePath: typeof filePath === "string" ? filePath : undefined,
        fileSize: typeof fileSize === "number" ? fileSize : undefined,
        sha256: typeof sha256 === "string" ? sha256 : undefined,
        encrypted: encrypted === true,
        formatVersion: typeof formatVersion === "number" ? formatVersion : undefined,
        errorMessage: typeof errorMessage === "string" ? errorMessage.slice(0, ERROR_MESSAGE_MAX) : undefined,
    };

    if (status === "FAILED") {
        if (drill !== undefined && drill !== null) return fail("A failed run does not carry a drill summary.");
        return { ok: true, value };
    }

    // ---- COMPLETED: every piece of proof, or nothing is written ----
    if (!completedAt) return fail("A completed run needs completedAt.");
    if (value.errorMessage) return fail("A completed run cannot carry an error message.");
    if (value.encrypted !== true) return fail("A completed backup must be encrypted (encrypted: true).");
    if (value.formatVersion !== BACKUP_FORMAT_VERSION) return fail(`formatVersion must be ${BACKUP_FORMAT_VERSION}.`);
    if (!value.sha256) return fail("A completed run needs the SHA-256 of the stored backup.");

    if (type === "FULL") {
        if (drill !== undefined && drill !== null) return fail("A full backup does not carry a drill summary.");
        if (!value.filePath || !BACKUP_OBJECT_KEY.test(value.filePath)) return fail("filePath must be the backup's object key (daily/… or monthly/….dump.age).");
        if (value.fileSize === undefined) return fail("A completed backup needs its stored size.");
        if (value.fileSize < MIN_BACKUP_BYTES) return fail("The stored backup is implausibly small.");
        if (value.fileSize > MAX_ENCRYPTED_BACKUP_BYTES) return fail("The stored backup is implausibly large.");
        return { ok: true, value };
    }

    // RESTORE_DRILL: names the encrypted backup it restored, and says it was a strict drill.
    if (value.filePath !== undefined) return fail("A restore drill must not carry a file path.");
    if (value.fileSize !== undefined) return fail("A restore drill must not carry a file size.");
    if (!isPlainObject(drill)) return fail("A completed restore drill needs its drill summary.");
    for (const key of Object.keys(drill)) {
        if (!DRILL_KEYS.has(key)) return fail(`Unexpected drill field "${key.slice(0, 40)}".`);
    }
    if (drill.strict !== true) return fail("Only a strict restore drill can be recorded as completed.");
    if (drill.tenants !== 1) return fail("A restored clinic database must contain exactly one clinic.");
    if (!isInt(drill.tables) || drill.tables < 1 || drill.tables > 5000) return fail("drill.tables is out of range.");
    if (!isInt(drill.checks) || drill.checks < 1 || drill.checks > 200) return fail("drill.checks is out of range.");
    value.drill = { strict: true, tenants: 1, tables: drill.tables, checks: drill.checks };
    return { ok: true, value };
}
