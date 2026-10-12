// ============================================
// NEXUS DENTAL — Guarded, STRICT restore drill
//
// Restores an encrypted backup into a BRAND-NEW, LOCAL, THROWAWAY database and
// checks it. It can never restore onto an existing database or a remote server:
//   * the admin connection must be on localhost
//   * the database it creates is always named nexus_restore_test_<time>_<random>
//
// A drill is REPORTABLE (may be recorded as completed, may reset the drill clock)
// only when ALL of these hold - there is no softer success state:
//   1. the file matches an expected SHA-256 from the stored manifest / trusted record
//   2. it decrypts and is a valid PostgreSQL archive, and restores without error
//   3. exactly ONE clinic row exists
//   4. migration history is present, nothing unknown to this release, and every
//      migration of this release is applied
//   5. every foreign key recorded in the archive exists in the restored database and is validated
// Anything else - including a developer-only restore without a checksum, or an older
// backup that has not been brought up to date and re-checked - is ok:false and
// reportable:false.
//
// The report contains table names and row COUNTS only - never row data.
// ============================================

import { execFileSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import pg from "pg";
import { SHA256_HEX } from "./constants";
import { BackupError, decryptBytes, sha256Hex } from "./crypto";
import { archiveToc, scrub } from "./pipeline";

export const RESTORE_DB_PREFIX = "nexus_restore_test_";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export interface RestoreCheck {
    name: string;
    ok: boolean;
    detail: string;
}

export interface RestoreReport {
    /** Every integrity check passed. */
    ok: boolean;
    /** Strict, attributable and complete: the only kind of drill that may be recorded as completed. */
    reportable: boolean;
    database: string;
    kept: boolean;
    /** SHA-256 of the encrypted file that was verified (only when verification actually happened). */
    verifiedSha256?: string;
    durationMs: { decrypt: number; restore: number; total: number };
    checks: RestoreCheck[];
    tables: Record<string, number>;
}

export interface RestoreOptions {
    /** Path to the encrypted backup (.dump.age). */
    encryptedPath: string;
    /** The age private key text (AGE-SECRET-KEY-…). Supplied by the operator, never stored. */
    identity: string;
    /** Postgres URL allowed to CREATE DATABASE, on localhost. */
    adminUrl: string;
    /**
     * SHA-256 (hex) the file MUST have, taken from the stored manifest or the app's backup record.
     * Required for a reportable drill. If absent, the restore still runs only when
     * `allowUnverified` is set, and is then never ok and never reportable.
     */
    expectedSha256?: string;
    /** Developer-only: restore without a checksum. The result is always ok:false, reportable:false. */
    allowUnverified?: boolean;
    /** Directory of committed Prisma migrations of THIS release. Required for a reportable drill. */
    migrationsDir?: string;
    /** Table → minimum rows the restored data must have (e.g. { tenants: 1 }). */
    minRows?: Record<string, number>;
    /**
     * Operator flag for recovering from a backup made by an OLDER release (missing newer migrations).
     * Such a restore is non-passing until `applyMigrations` has brought it up to date and it re-checks clean.
     */
    allowOlderBackup?: boolean;
    /** With allowOlderBackup: run `prisma migrate deploy` against the RESTORED throwaway database, then re-check. */
    applyMigrations?: boolean;
    /** Keep the restored database for inspection instead of dropping it. */
    keep?: boolean;
    tmpRoot?: string;
}

export function assertLocalAdminUrl(adminUrl: string): URL {
    let url: URL;
    try {
        url = new URL(adminUrl);
    } catch {
        throw new BackupError("UNSAFE_TARGET", "The restore server URL is not valid.");
    }
    if (!LOCAL_HOSTS.has(url.hostname)) {
        throw new BackupError(
            "UNSAFE_TARGET",
            "Refusing to restore: the target server is not on localhost. Restore drills only ever run on a local, disposable database."
        );
    }
    return url;
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** Count the foreign-key constraints the archive says it contains. */
export function foreignKeysInToc(toc: string): number {
    return toc.split("\n").filter((line) => /\sFK CONSTRAINT\s/.test(line)).length;
}

function committedMigrations(dir: string): Set<string> {
    return new Set(fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name));
}

async function migrationState(db: pg.Client, dir: string) {
    const exists = (await db.query(`select to_regclass('public._prisma_migrations') as t`)).rows[0].t !== null;
    if (!exists) return { exists: false as const };
    const { rows } = await db.query(`select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null`);
    const applied = new Set<string>(rows.map((r: { migration_name: string }) => r.migration_name));
    const committed = committedMigrations(dir);
    return {
        exists: true as const,
        unknown: [...applied].filter((n) => !committed.has(n)),
        missing: [...committed].filter((n) => !applied.has(n)),
    };
}

export async function restoreBackup(opts: RestoreOptions): Promise<RestoreReport> {
    const t0 = Date.now();
    const admin = assertLocalAdminUrl(opts.adminUrl);
    const checks: RestoreCheck[] = [];
    const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

    // ── 1. attributable to its manifest ─────────────────────────────────────────────
    const expected = opts.expectedSha256?.toLowerCase();
    if (expected !== undefined && !SHA256_HEX.test(expected)) {
        throw new BackupError("CHECKSUM_MISMATCH", "The expected SHA-256 is not a valid 64-character hex value.");
    }
    if (expected === undefined && !opts.allowUnverified) {
        throw new BackupError("CHECKSUM_MISMATCH", "A restore drill needs the expected SHA-256 from the backup's manifest or the app's backup record; refusing to continue without it.");
    }
    const encrypted = fs.readFileSync(opts.encryptedPath);
    const actual = sha256Hex(encrypted);
    if (expected !== undefined && actual !== expected) {
        throw new BackupError("CHECKSUM_MISMATCH", "The file does not match its recorded checksum; it is damaged or not the backup it claims to be.");
    }
    add("checksum", expected !== undefined, expected !== undefined ? "matches the recorded SHA-256" : "NOT VERIFIED (developer-only restore): this result can never be reported as a drill");

    const tDecrypt = Date.now();
    const plain = await decryptBytes(encrypted, opts.identity);
    const decryptMs = Date.now() - tDecrypt;

    const tmp = fs.mkdtempSync(path.join(opts.tmpRoot ?? os.tmpdir(), "nexus-restore-"));
    fs.chmodSync(tmp, 0o700);
    const dumpPath = path.join(tmp, "restore.dump");
    const dbName = `${RESTORE_DB_PREFIX}${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const target = new URL(admin.toString());
    target.pathname = `/${dbName}`;

    let created = false;
    const adminClient = new pg.Client({ connectionString: admin.toString() });
    let restoreMs = 0;
    const tables: Record<string, number> = {};
    let olderBackupRecovered = false;
    try {
        fs.writeFileSync(dumpPath, plain, { mode: 0o600 });
        const toc = archiveToc(dumpPath);
        const archiveForeignKeys = foreignKeysInToc(toc);
        add("archive", true, "valid PostgreSQL archive");

        await adminClient.connect();
        await adminClient.query(`CREATE DATABASE ${quote(dbName)}`);
        created = true;

        const tRestore = Date.now();
        try {
            execFileSync("pg_restore", ["--no-owner", "--no-acl", "--exit-on-error", "-d", target.toString(), dumpPath], { stdio: ["ignore", "ignore", "pipe"] });
        } catch (error) {
            const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? "";
            throw new BackupError("RESTORE_FAILED", `pg_restore failed: ${scrub(stderr)}`);
        }
        restoreMs = Date.now() - tRestore;
        add("restore", true, `restored into ${dbName}`);

        const db = new pg.Client({ connectionString: target.toString() });
        await db.connect();
        try {
            const countTables = async () => {
                const { rows: tableRows } = await db.query(
                    `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1`
                );
                for (const k of Object.keys(tables)) delete tables[k];
                for (const { table_name } of tableRows) {
                    const { rows } = await db.query(`select count(*)::int as c from ${quote(table_name)}`);
                    tables[table_name] = rows[0].c;
                }
                return tableRows.length;
            };
            const tableCount = await countTables();
            add("tables", tableCount > 0, `${tableCount} tables`);

            // ── 3. exactly one clinic ───────────────────────────────────────────────
            if (tables["tenants"] === undefined) add("single clinic", false, "the tenants table is missing");
            else add("single clinic", tables["tenants"] === 1, `${tables["tenants"]} clinic row(s); exactly 1 is required`);

            for (const [table, min] of Object.entries(opts.minRows ?? {})) {
                add(`rows: ${table}`, (tables[table] ?? 0) >= min, `${tables[table] ?? 0} (need ≥ ${min})`);
            }

            // ── 4. migration history ────────────────────────────────────────────────
            if (!opts.migrationsDir) {
                add("migrations", false, "no migrations directory supplied; cannot compare against this release");
            } else {
                let state = await migrationState(db, opts.migrationsDir);
                if (!state.exists) {
                    add("migrations: history present", false, "the backup has no _prisma_migrations table (it was built with db push). Baseline the database before relying on it.");
                } else {
                    add("migrations: none unknown to this release", state.unknown.length === 0, state.unknown.length ? `unknown: ${state.unknown.join(", ")}` : "ok");
                    if (state.missing.length > 0 && opts.allowOlderBackup && opts.applyMigrations) {
                        try {
                            execFileSync("npx", ["prisma", "migrate", "deploy"], {
                                cwd: path.resolve(opts.migrationsDir, "../.."),
                                env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", DATABASE_URL: target.toString() } as unknown as NodeJS.ProcessEnv,
                                stdio: ["ignore", "ignore", "pipe"],
                            });
                        } catch (error) {
                            throw new BackupError("RESTORE_FAILED", `prisma migrate deploy failed on the restored copy: ${scrub((error as { stderr?: Buffer }).stderr?.toString() ?? "")}`);
                        }
                        olderBackupRecovered = true;
                        state = await migrationState(db, opts.migrationsDir);
                        await countTables();
                    }
                    if (state.exists) {
                        const behind = state.missing.length > 0;
                        add(
                            "migrations: up to date with this release",
                            !behind,
                            behind
                                ? `backup predates ${state.missing.length} migration(s): ${state.missing.join(", ")}${opts.allowOlderBackup ? " - NON-PASSING until prisma migrate deploy has been applied and re-checked (--apply-migrations)" : ""}`
                                : olderBackupRecovered ? "brought up to date by prisma migrate deploy, then re-checked" : "all applied"
                        );
                    }
                }
            }

            // ── 5. foreign keys present and validated ──────────────────────────────
            const fk = (await db.query(
                `select count(*)::int as total, count(*) filter (where not convalidated)::int as unvalidated from pg_constraint where contype='f' and connamespace='public'::regnamespace`
            )).rows[0] as { total: number; unvalidated: number };
            add("foreign keys: all of the archive's are present", fk.total >= archiveForeignKeys && archiveForeignKeys > 0,
                `${fk.total} in the restored database, ${archiveForeignKeys} recorded in the archive`);
            add("foreign keys: all validated", fk.unvalidated === 0, `${fk.unvalidated} not validated`);
        } finally {
            await db.end();
        }
    } catch (error) {
        if (error instanceof BackupError) throw error;
        throw new BackupError("RESTORE_FAILED", scrub(error instanceof Error ? error.message : String(error)));
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
        if (created && !opts.keep && dbName.startsWith(RESTORE_DB_PREFIX)) {
            await adminClient.query(`DROP DATABASE IF EXISTS ${quote(dbName)} WITH (FORCE)`).catch(() => {});
        }
        await adminClient.end().catch(() => {});
    }

    const ok = checks.every((c) => c.ok);
    return {
        ok,
        // Strictness is structural: ok already requires the checksum check to have passed.
        reportable: ok && expected !== undefined,
        database: dbName,
        kept: Boolean(opts.keep),
        verifiedSha256: expected,
        durationMs: { decrypt: decryptMs, restore: restoreMs, total: Date.now() - t0 },
        checks,
        tables,
    };
}
