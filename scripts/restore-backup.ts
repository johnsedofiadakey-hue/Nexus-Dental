#!/usr/bin/env tsx
/**
 * STRICT restore drill: restore an encrypted backup into a NEW, LOCAL, THROWAWAY
 * database and check it. Never touches an existing database or a remote server.
 *
 *   TEST_DATABASE_ADMIN_URL=postgresql://you@127.0.0.1:5432/postgres \
 *   npm run backup:restore -- --file ./nexus-….dump.age --key-file ~/offline/backup.key \
 *        --sha256 <hex from the app's backup record or the .json manifest> [--min-rows tenants=1] [--keep] [--report]
 *
 * A drill passes only if: the file matches the expected SHA-256; it decrypts and restores;
 * exactly one clinic exists; migration history is present, nothing unknown and everything of
 * this release applied; and every foreign key recorded in the archive exists and is validated.
 *
 * The expected checksum is mandatory. Take it from --sha256 (the app's backup record - the
 * trusted source) or --manifest <file.json> (defaults to <file>.json beside the backup).
 *
 *   --unverified          DEVELOPER ONLY: restore without a checksum. Always exits 1, can never be reported.
 *   --older-backup        recovering a backup made by an older release: non-passing until
 *   --apply-migrations    `prisma migrate deploy` has been run on the restored copy and re-checked clean.
 *   --report              record the drill in the app (needs APP_URL + BACKUP_WEBHOOK_SECRET). Only a
 *                         passing, checksum-verified drill is recorded as completed; a failed one is recorded as failed.
 *
 * The private key is read from --key-file (a path outside the repository); it is never
 * printed, stored or sent. Output has table names and row counts only.
 * Exit 0 = drill passed; 1 = failed; 2 = bad usage.
 */
import fs from "fs";
import path from "path";
import { parseArgs } from "node:util";
import { SHA256_HEX } from "../src/lib/backup/constants";
import { BACKUP_FORMAT_VERSION, BackupError } from "../src/lib/backup/crypto";
import { restoreBackup, type RestoreReport } from "../src/lib/backup/restore";

const ROOT = path.resolve(__dirname, "..");

async function postDrill(body: Record<string, unknown>) {
    const { APP_URL, BACKUP_WEBHOOK_SECRET } = process.env;
    if (!APP_URL || !BACKUP_WEBHOOK_SECRET) throw new Error("APP_URL and BACKUP_WEBHOOK_SECRET are required for --report");
    const res = await fetch(`${APP_URL}/api/system/backups/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Backup-Secret": BACKUP_WEBHOOK_SECRET },
        body: JSON.stringify({ type: "RESTORE_DRILL", ...body }),
    });
    if (!res.ok) throw new Error(`the app answered ${res.status}`);
}

/** The expected checksum: --sha256, else the manifest beside the backup. */
function expectedChecksum(values: { sha256?: string; manifest?: string }, file: string): string | undefined {
    if (values.sha256) return values.sha256.toLowerCase();
    const manifestPath = values.manifest ?? `${file}.json`;
    if (!fs.existsSync(manifestPath)) return undefined;
    try {
        const m = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { sha256?: unknown };
        return typeof m.sha256 === "string" ? m.sha256.toLowerCase() : undefined;
    } catch {
        return undefined;
    }
}

async function main(): Promise<number> {
    let values;
    try {
        values = parseArgs({
            options: {
                file: { type: "string" }, "key-file": { type: "string" }, sha256: { type: "string" }, manifest: { type: "string" },
                "min-rows": { type: "string", multiple: true }, keep: { type: "boolean" }, report: { type: "boolean" },
                unverified: { type: "boolean" }, "older-backup": { type: "boolean" }, "apply-migrations": { type: "boolean" },
            },
            allowPositionals: false,
        }).values;
    } catch (e) {
        console.error(`Error: ${(e as Error).message}`);
        return 2;
    }
    const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
    if (!values.file || !values["key-file"] || !adminUrl) {
        console.error("Usage: need --file, --key-file and TEST_DATABASE_ADMIN_URL (a local postgres URL). See the header of this script.");
        return 2;
    }
    if (values.unverified && values.report) {
        console.error("Refusing: an unverified restore can never be recorded as a drill (--unverified and --report are mutually exclusive).");
        return 2;
    }
    if (values["apply-migrations"] && !values["older-backup"]) {
        console.error("--apply-migrations only makes sense with --older-backup.");
        return 2;
    }
    const keyPath = path.resolve(values["key-file"]);
    if (keyPath.startsWith(ROOT + path.sep)) {
        console.error("Refusing: the private key must live outside the repository.");
        return 2;
    }
    const file = path.resolve(values.file);
    const expected = expectedChecksum(values, file);
    if (expected !== undefined && !SHA256_HEX.test(expected)) {
        console.error("Refusing: the expected SHA-256 is not a valid 64-character lowercase hex value.");
        return 2;
    }
    if (expected === undefined && !values.unverified) {
        console.error("Refusing: no expected SHA-256. Pass --sha256 (from the app's backup record) or keep the backup's .json manifest beside it. A drill without one proves nothing.");
        return 2;
    }
    const minRows: Record<string, number> = {};
    for (const spec of values["min-rows"] ?? []) {
        const [table, n] = spec.split("=");
        if (!table || !Number.isInteger(Number(n))) { console.error(`Bad --min-rows "${spec}" (use table=number)`); return 2; }
        minRows[table] = Number(n);
    }

    const started = new Date();
    let report: RestoreReport | undefined;
    let failure = "";
    try {
        report = await restoreBackup({
            encryptedPath: file,
            identity: fs.readFileSync(keyPath, "utf8"),
            adminUrl,
            expectedSha256: expected,
            allowUnverified: values.unverified,
            migrationsDir: path.join(ROOT, "prisma/migrations"),
            minRows,
            allowOlderBackup: values["older-backup"],
            applyMigrations: values["apply-migrations"],
            keep: values.keep,
        });
    } catch (error) {
        failure = error instanceof BackupError ? `${error.code}: ${error.message}` : "unexpected error";
    }

    if (report) {
        for (const c of report.checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name} - ${c.detail}`);
        console.log(`tables: ${Object.entries(report.tables).map(([t, n]) => `${t}=${n}`).join(" ")}`);
        console.log(`timing: decrypt ${report.durationMs.decrypt}ms, restore ${report.durationMs.restore}ms, total ${report.durationMs.total}ms`);
        console.log(report.kept ? `kept database ${report.database}` : "temporary database dropped");
        if (!report.ok) failure = "one or more integrity checks failed";
        console.log(report.reportable ? "RESULT: strict drill PASSED" : "RESULT: NOT a passing drill");
    } else {
        console.error(`Restore drill FAILED - ${failure}`);
    }

    if (values.report) {
        try {
            if (report?.reportable) {
                await postDrill({
                    status: "COMPLETED",
                    startedAt: started.toISOString(),
                    completedAt: new Date().toISOString(),
                    sha256: report.verifiedSha256,
                    encrypted: true,
                    formatVersion: BACKUP_FORMAT_VERSION,
                    drill: { strict: true, tenants: 1, tables: Object.keys(report.tables).length, checks: report.checks.length },
                });
                console.log("drill recorded in the app");
            } else {
                await postDrill({ status: "FAILED", startedAt: started.toISOString(), completedAt: new Date().toISOString(), errorMessage: failure.slice(0, 400) });
                console.log("failed drill recorded in the app");
            }
        } catch (e) {
            console.error(`Could not record the drill: ${(e as Error).message}`);
            return 1;
        }
    }
    return report?.reportable ? 0 : 1;
}

main().then((c) => process.exit(c), () => { console.error("Restore drill FAILED - unexpected error"); process.exit(1); });
