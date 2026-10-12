#!/usr/bin/env tsx
/**
 * Encrypted nightly backup (run by .github/workflows/backup.yml).
 *
 *   pg_dump -> validate -> age-encrypt (public key) -> checksum -> upload -> verify -> report
 *
 * Required: DATABASE_URL, BACKUP_AGE_RECIPIENT (age public key(s)),
 *           and a destination: BACKUP_BUCKET + BACKUP_GCS_SERVICE_ACCOUNT
 *           (or BACKUP_LOCAL_DIR for a local rehearsal).
 * Reporting: APP_URL + BACKUP_WEBHOOK_SECRET (optional for local rehearsal).
 *
 * Never uploads an unencrypted dump. Exit 0 = backup stored and verified; 1 = failed.
 */
import { BACKUP_FORMAT_VERSION } from "../src/lib/backup/crypto";
import { GcsDestination, LocalDestination, type BackupDestination } from "../src/lib/backup/destinations";
import { runBackup, type BackupResult } from "../src/lib/backup/pipeline";

function destination(env: NodeJS.ProcessEnv): BackupDestination | null {
    if (env.BACKUP_LOCAL_DIR) return new LocalDestination(env.BACKUP_LOCAL_DIR);
    if (env.BACKUP_BUCKET && env.BACKUP_GCS_SERVICE_ACCOUNT) return new GcsDestination(env.BACKUP_BUCKET, env.BACKUP_GCS_SERVICE_ACCOUNT);
    return null;
}

async function report(env: NodeJS.ProcessEnv, result: BackupResult) {
    if (!env.APP_URL || !env.BACKUP_WEBHOOK_SECRET) {
        console.log("[Backup] APP_URL/BACKUP_WEBHOOK_SECRET not set: outcome not reported to the app.");
        return;
    }
    const res = await fetch(`${env.APP_URL}/api/system/backups/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Backup-Secret": env.BACKUP_WEBHOOK_SECRET },
        body: JSON.stringify({
            type: "FULL",
            status: result.status,
            filePath: result.key,
            fileSize: result.size,
            sha256: result.sha256,
            encrypted: result.status === "COMPLETED",
            formatVersion: BACKUP_FORMAT_VERSION,
            startedAt: result.startedAt.toISOString(),
            completedAt: result.completedAt.toISOString(),
            errorMessage: result.errorMessage,
        }),
    });
    if (!res.ok) throw new Error(`the app answered ${res.status}`);
}

async function main(): Promise<number> {
    const env = process.env;
    const dest = destination(env);
    if (!dest) {
        console.error("[Backup] No destination configured (BACKUP_BUCKET + BACKUP_GCS_SERVICE_ACCOUNT, or BACKUP_LOCAL_DIR).");
        return 1;
    }
    const result = await runBackup({
        env,
        destination: dest,
        log: (line) => console.log(`[Backup] ${line}`),
        report: (r) => report(env, r),
    });
    if (result.status === "COMPLETED") {
        console.log(`[Backup] Stored ${result.key} (${result.size} bytes, sha256 ${result.sha256?.slice(0, 12)}…)`);
        return 0;
    }
    console.error(`[Backup] FAILED (${result.errorCode}): ${result.errorMessage}`);
    return 1;
}

main().then((code) => process.exit(code), (error) => {
    console.error("[Backup] FAILED:", error instanceof Error ? error.message : "unknown");
    process.exit(1);
});
