// ============================================
// NEXUS DENTAL — Backup pipeline
//
// pg_dump → validate → encrypt → checksum → upload → verify → record.
//
// Fail closed at every step: with no recipient, a bad dump, a failed encryption,
// a failed upload or a failed verification the run is recorded as FAILED and
// NOTHING readable is ever uploaded. The plaintext dump exists only inside a
// private temp directory and is removed as soon as it has been encrypted (and
// again in `finally`).
// ============================================

import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {
    BACKUP_FORMAT_VERSION,
    BackupError,
    MAX_BACKUP_BYTES,
    encryptBytes,
    parseRecipients,
    recipientFingerprint,
    sha256Hex,
} from "./crypto";
import type { BackupDestination } from "./destinations";

/** A real clinic dump is never this small; a smaller file means pg_dump produced nothing useful. */
export const MIN_DUMP_BYTES = 2048;

export type Dumper = (databaseUrl: string, outPath: string) => Promise<void>;
export type DumpValidator = (dumpPath: string) => Promise<void>;

export interface BackupResult {
    status: "COMPLETED" | "FAILED";
    key?: string;
    size?: number;
    sha256?: string;
    startedAt: Date;
    completedAt: Date;
    errorCode?: string;
    errorMessage?: string;
}

export interface RunBackupOptions {
    env: Record<string, string | undefined>;
    destination: BackupDestination;
    dump?: Dumper;
    validateDump?: DumpValidator;
    now?: Date;
    tmpRoot?: string;
    /** Called once with the outcome, success or failure. Errors from it are logged, never thrown. */
    report?: (result: BackupResult) => Promise<void>;
    log?: (line: string) => void;
}

/** Strip anything URL-shaped so a driver error cannot leak a connection string. */
export function scrub(message: string): string {
    return message.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi, "<url>").slice(0, 300);
}

export const pgDump: Dumper = async (databaseUrl, outPath) => {
    try {
        execFileSync("pg_dump", [databaseUrl, "-Fc", "--no-owner", "--no-acl", "-f", outPath], { stdio: ["ignore", "ignore", "pipe"] });
    } catch (error) {
        const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? "";
        throw new BackupError("DUMP_FAILED", `pg_dump failed: ${scrub(stderr || (error as Error).message)}`);
    }
};

/** The archive's table of contents. `pg_restore --list` parses the whole TOC: a truncated or non-dump file fails here. */
export function archiveToc(dumpPath: string): string {
    try {
        return execFileSync("pg_restore", ["--list", dumpPath], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).toString();
    } catch {
        throw new BackupError("DUMP_INVALID", "The dump is not a valid PostgreSQL archive.");
    }
}

export const pgRestoreList: DumpValidator = async (dumpPath) => {
    archiveToc(dumpPath);
};

export function backupKeys(now: Date): { daily: string; monthly: string | null; fileName: string } {
    const day = now.toISOString().slice(0, 10);
    const fileName = `nexus-${day}-${now.getTime()}.dump.age`;
    return {
        fileName,
        daily: `daily/${day}/${fileName}`,
        monthly: day.endsWith("-01") ? `monthly/${day.slice(0, 7)}/${fileName}` : null,
    };
}

export async function runBackup(opts: RunBackupOptions): Promise<BackupResult> {
    const log = opts.log ?? (() => {});
    const startedAt = opts.now ?? new Date();
    const dump = opts.dump ?? pgDump;
    const validate = opts.validateDump ?? pgRestoreList;
    let tmp: string | null = null;

    const finish = async (result: BackupResult) => {
        if (opts.report) {
            try {
                await opts.report(result);
            } catch (error) {
                log(`report failed: ${scrub((error as Error).message)}`);
            }
        }
        return result;
    };

    try {
        // Check the recipient FIRST so a misconfigured run never even creates a plaintext dump.
        const recipients = parseRecipients(opts.env.BACKUP_AGE_RECIPIENT);
        const databaseUrl = opts.env.DATABASE_URL;
        if (!databaseUrl) throw new BackupError("DUMP_FAILED", "DATABASE_URL is not set.");

        tmp = fs.mkdtempSync(path.join(opts.tmpRoot ?? os.tmpdir(), "nexus-backup-"));
        fs.chmodSync(tmp, 0o700);
        const plainPath = path.join(tmp, "plain.dump");
        const encPath = path.join(tmp, "backup.dump.age");

        log("dumping database");
        await dump(databaseUrl, plainPath);
        if (!fs.existsSync(plainPath)) throw new BackupError("DUMP_FAILED", "pg_dump produced no file.");
        const plainSize = fs.statSync(plainPath).size;
        if (plainSize < MIN_DUMP_BYTES) throw new BackupError("DUMP_TOO_SMALL", `Dump is only ${plainSize} bytes; refusing to treat it as a backup.`);
        if (plainSize > MAX_BACKUP_BYTES) throw new BackupError("DUMP_TOO_LARGE", "Dump exceeds the supported size; streaming encryption is required.");
        await validate(plainPath);

        log("encrypting");
        const cipher = await encryptBytes(fs.readFileSync(plainPath), recipients);
        fs.writeFileSync(encPath, cipher, { mode: 0o600 });
        fs.rmSync(plainPath, { force: true }); // plaintext gone before anything is uploaded
        const sha256 = sha256Hex(cipher);
        const size = cipher.byteLength;

        const keys = backupKeys(startedAt);
        const manifest = {
            formatVersion: BACKUP_FORMAT_VERSION,
            createdAt: startedAt.toISOString(),
            sha256,
            size,
            recipients: recipients.map(recipientFingerprint),
            encryption: "age",
        };
        const manifestPath = path.join(tmp, "manifest.json");
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { mode: 0o600 });

        log(`uploading to ${opts.destination.describe()}`);
        const targets = [keys.daily, ...(keys.monthly ? [keys.monthly] : [])];
        const confirmed: number[] = [];
        try {
            for (const key of targets) {
                confirmed.push((await opts.destination.put(key, encPath)).size);
                await opts.destination.put(`${key}.json`, manifestPath);
            }
        } catch (error) {
            throw new BackupError("UPLOAD_FAILED", `Upload failed: ${scrub((error as Error).message)}`);
        }
        // Integrity comes from what the STORE reported for each upload (no read access needed).
        if (confirmed.some((stored) => stored !== size)) {
            throw new BackupError("VERIFY_FAILED", "The store's confirmed size does not match what was uploaded.");
        }

        return await finish({ status: "COMPLETED", key: keys.daily, size, sha256, startedAt, completedAt: new Date() });
    } catch (error) {
        const code = error instanceof BackupError ? error.code : "DUMP_FAILED";
        const message = scrub(error instanceof Error ? error.message : String(error));
        return await finish({ status: "FAILED", startedAt, completedAt: new Date(), errorCode: code, errorMessage: message });
    } finally {
        if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    }
}
