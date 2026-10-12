/* eslint-disable @typescript-eslint/no-explicit-any -- request captures and fixtures are intentionally loosely typed */
// Database-backed backup/restore tests: REAL pg_dump, REAL encryption, REAL pg_restore
// into a second throwaway database. Synthetic data only.
//
// Run through `npm run test:provision` (it creates the disposable database, applies the
// committed migrations and sets TEST_DATABASE_URL). Skipped without it.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, spawnSync } from "child_process";
import http from "http";
import fs from "fs";
import os from "os";
import path from "path";
import pg from "pg";
import { BackupError, generateKeyPair, sha256Hex } from "@/lib/backup/crypto";
import { foreignKeysInToc } from "@/lib/backup/restore";
import { archiveToc } from "@/lib/backup/pipeline";
import { LocalDestination } from "@/lib/backup/destinations";
import { runBackup } from "@/lib/backup/pipeline";
import { restoreBackup, RESTORE_DB_PREFIX } from "@/lib/backup/restore";

const URL_UNDER_TEST = process.env.TEST_DATABASE_URL;
if (URL_UNDER_TEST) {
    const u = new URL(URL_UNDER_TEST);
    if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname) || !u.pathname.replace(/^\//, "").startsWith("nexus_c1_test_")) {
        throw new Error("Refusing to run: TEST_DATABASE_URL must be a LOCAL nexus_c1_test_* database.");
    }
}
const suite = URL_UNDER_TEST ? describe : describe.skip;

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "prisma/migrations");
const MARKER = "SYNTHETIC-MARKER-Kofi-Test-0200000099";

suite("backup -> restore round trip against a real PostgreSQL", () => {
    let pool: pg.Pool;
    let adminUrl: string;
    let keys: { identity: string; recipient: string };
    let work: string;
    let dest: string;
    let stored: { file: string; sha256: string };
    const timings = { backupMs: 0 };
    let baselineRestoreDbs: string[] = []; // other restore-drill databases that already existed on this server

    const q = (sql: string, args: unknown[] = []) => pool.query(sql, args);
    // Async: the fake app server lives in THIS process, so a blocking spawnSync would deadlock it.
    const tsxAsync = (script: string, args: string[], env: Record<string, string>) =>
        new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
            const child = spawn("npx", ["tsx", script, ...args], { cwd: ROOT, env: { PATH: process.env.PATH!, HOME: process.env.HOME!, ...env } as unknown as NodeJS.ProcessEnv });
            let stdout = "", stderr = "";
            child.stdout.on("data", (d) => (stdout += d));
            child.stderr.on("data", (d) => (stderr += d));
            child.on("close", (status) => resolve({ status, stdout, stderr }));
        });


    const contentHash = async (client: pg.Client | pg.Pool, table: string) =>
        (await client.query(`select md5(coalesce(string_agg(t::text, '|' order by t.id), '')) h from "${table}" t`)).rows[0].h as string;
    const leftovers = async () =>
        (await q(`select datname from pg_database where datname like '${RESTORE_DB_PREFIX}%'`)).rows.map((r) => r.datname);

    beforeAll(async () => {
        const u = new URL(URL_UNDER_TEST!);
        u.pathname = "/postgres";
        adminUrl = u.toString();
        pool = new pg.Pool({ connectionString: URL_UNDER_TEST });
        baselineRestoreDbs = await leftovers();
        keys = await generateKeyPair();
        work = fs.mkdtempSync(path.join(os.tmpdir(), "bk-int-work-"));
        dest = fs.mkdtempSync(path.join(os.tmpdir(), "bk-int-dest-"));

        await q(`TRUNCATE tenants, users, patients CASCADE`);
        await q(`insert into tenants (id,name,slug,"updatedAt") values ('t1','Synthetic Clinic','synthetic-clinic',now())`);
        await q(`insert into users (id,email,"passwordHash","firstName","lastName","tenantId","updatedAt") values ('u1','owner@synthetic.test','x','O','Wner','t1',now())`);
        for (let i = 0; i < 50; i++) {
            await q(`insert into patients (id,"tenantId",phone,"firstName","lastName","medicalNotes","updatedAt") values ($1,'t1',$2,'P'||$1,'Test',$3,now())`, [`p${i}`, `+23320000${String(i).padStart(4, "0")}`, MARKER]);
        }

        const t0 = Date.now();
        const result = await runBackup({
            env: { DATABASE_URL: URL_UNDER_TEST, BACKUP_AGE_RECIPIENT: keys.recipient },
            destination: new LocalDestination(dest),
            tmpRoot: work,
        });
        timings.backupMs = Date.now() - t0;
        if (result.status !== "COMPLETED") throw new Error(`backup setup failed: ${result.errorCode} ${result.errorMessage}`);
        stored = { file: path.join(dest, result.key!), sha256: result.sha256! };
    });
    afterAll(async () => {
        await pool?.end();
        fs.rmSync(work, { recursive: true, force: true });
        fs.rmSync(dest, { recursive: true, force: true });
    });

    it("the stored backup is ciphertext: neither the synthetic patient data nor a PostgreSQL archive header is visible", () => {
        const bytes = fs.readFileSync(stored.file);
        expect(bytes.includes(Buffer.from(MARKER))).toBe(false);
        expect(bytes.subarray(0, 5).toString()).not.toBe("PGDMP");
        expect(sha256Hex(bytes)).toBe(stored.sha256);
    });

    it("restores into a brand-new database with identical table counts and identical content, then drops it", async () => {
        const report = await restoreBackup({
            encryptedPath: stored.file, identity: keys.identity, adminUrl, expectedSha256: stored.sha256,
            migrationsDir: path.join(ROOT, "prisma/migrations"), minRows: { tenants: 1, patients: 50 }, keep: true,
        });
        try {
            expect(report.ok, JSON.stringify(report.checks.filter((c) => !c.ok))).toBe(true);
            expect(report.database.startsWith(RESTORE_DB_PREFIX)).toBe(true);

            // table-by-table equality with the source
            const source = await q(`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`);
            for (const { table_name } of source.rows) {
                const c = (await q(`select count(*)::int c from "${table_name}"`)).rows[0].c;
                expect(report.tables[table_name], table_name).toBe(c);
            }
            // content equality for the data tables
            const u = new URL(adminUrl);
            u.pathname = `/${report.database}`;
            const restored = new pg.Client({ connectionString: u.toString() });
            await restored.connect();
            try {
                for (const t of ["patients", "users", "tenants"]) expect(await contentHash(restored, t), t).toBe(await contentHash(pool, t));
            } finally {
                await restored.end();
            }
            // migration history carried over and matches this release
            expect(report.checks.find((c) => c.name.startsWith("migrations: none unknown"))?.ok).toBe(true);
            console.log(`[drill] synthetic 50-patient clinic: backup ${timings.backupMs}ms, decrypt ${report.durationMs.decrypt}ms, restore ${report.durationMs.restore}ms, total ${report.durationMs.total}ms`);
        } finally {
            await q(`DROP DATABASE IF EXISTS "${report.database}" WITH (FORCE)`);
        }
    });

    it("the report contains table names and counts only - never row data", async () => {
        const report = await restoreBackup({ encryptedPath: stored.file, identity: keys.identity, adminUrl, expectedSha256: stored.sha256 });
        expect(JSON.stringify(report)).not.toContain(MARKER);
        expect(JSON.stringify(report)).not.toContain("synthetic.test");
    });

    describe("damaged or wrong inputs are rejected and restore nothing", () => {
        const expectRejected = async (file: string, identity: string, code: string, extra: object = {}) => {
            const before = await leftovers();
            // The recorded checksum describes the file we hand over, so decryption problems are what gets tested.
            const expectedSha256 = sha256Hex(fs.readFileSync(file));
            await expect(restoreBackup({ encryptedPath: file, identity, adminUrl, expectedSha256, ...extra })).rejects.toMatchObject({ code });
            expect(await leftovers()).toEqual(before); // no database created, none left behind
        };
        const copy = (mutate: (b: Buffer) => Buffer) => {
            const f = path.join(work, `mut-${Math.random().toString(16).slice(2)}.age`);
            fs.writeFileSync(f, mutate(Buffer.from(fs.readFileSync(stored.file))));
            return f;
        };

        it("a flipped byte", async () => expectRejected(copy((b) => { b[Math.floor(b.length / 2)] ^= 0xff; return b; }), keys.identity, "DECRYPT_FAILED"));
        it("a truncated file", async () => expectRejected(copy((b) => b.subarray(0, Math.floor(b.length / 2))), keys.identity, "DECRYPT_FAILED"));
        it("the wrong key", async () => expectRejected(stored.file, (await generateKeyPair()).identity, "DECRYPT_FAILED"));
        it("a malformed key file", async () => expectRejected(stored.file, "not a key", "BAD_IDENTITY"));
        it("a checksum that does not match", async () => expectRejected(stored.file, keys.identity, "CHECKSUM_MISMATCH", { expectedSha256: "0".repeat(64) }));

        it("a validly encrypted file that is not a PostgreSQL archive", async () => {
            const { encryptBytes } = await import("@/lib/backup/crypto");
            const f = path.join(work, "garbage.age");
            fs.writeFileSync(f, await encryptBytes(Buffer.from("this is not a dump".repeat(200)), [keys.recipient]));
            await expectRejected(f, keys.identity, "DUMP_INVALID");
        });

        it("unmet minimum row expectations fail the drill", async () => {
            const report = await restoreBackup({ encryptedPath: stored.file, identity: keys.identity, adminUrl, expectedSha256: stored.sha256, migrationsDir: MIGRATIONS_DIR, minRows: { patients: 1000 } });
            expect(report.ok).toBe(false);
            expect(report.checks.find((c) => c.name === "rows: patients")?.ok).toBe(false);
        });
    });


    // ─────────────── C3.1: the drill is strict, attributable and complete ───────────────
    describe("strict drill", () => {
        let variantSeq = 0;
        const committed = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
        const migrationRows = (names: string[]) => names.map((n) => `insert into _prisma_migrations values ('${n}', now(), null);`).join("\n");

        /** A small, self-contained database the app's checks can be pointed at, then dropped. */
        const variantBackup = async (parts: { tenants?: number; migrations?: string[] | null; fk?: "valid" | "none" | "not-valid" }) => {
            const name = `nexus_c1_test_variant_${Date.now()}_${variantSeq++}`;
            await q(`create database "${name}"`);
            const u = new URL(adminUrl);
            u.pathname = `/${name}`;
            const c = new pg.Client({ connectionString: u.toString() });
            await c.connect();
            try {
                await c.query(`create table tenants (id text primary key, name text)`);
                const fk = parts.fk ?? "valid";
                await c.query(`create table patients (id text primary key, "tenantId" text ${fk === "valid" ? `references tenants(id)` : ""}, notes text)`);
                if (fk === "not-valid") await c.query(`alter table patients add constraint patients_tenant_fk foreign key ("tenantId") references tenants(id) not valid`);
                for (let i = 0; i < (parts.tenants ?? 1); i++) await c.query(`insert into tenants values ('t${i}','Clinic ${i}')`);
                if ((parts.tenants ?? 1) > 0) await c.query(`insert into patients select 'p'||g, 't0', md5(random()::text)||md5(random()::text) from generate_series(1,120) g`);
                const migrations = parts.migrations === undefined ? committed : parts.migrations;
                if (migrations !== null) {
                    await c.query(`create table _prisma_migrations (migration_name text, finished_at timestamptz, rolled_back_at timestamptz)`);
                    await c.query(migrationRows(migrations));
                }
                // incompressible padding so the dump clears the "implausibly small" floor
                await c.query(`create table pad as select md5(random()::text)||md5(random()::text)||md5(random()::text) as x from generate_series(1,200)`);
            } finally {
                await c.end();
            }
            const r = await runBackup({
                env: { DATABASE_URL: u.toString(), BACKUP_AGE_RECIPIENT: keys.recipient },
                destination: new LocalDestination(dest),
                tmpRoot: work,
                now: new Date(Date.now() + 5_000 + variantSeq * 1000),
            });
            await q(`drop database "${name}" with (force)`);
            if (r.status !== "COMPLETED") throw new Error(`variant backup failed: ${r.errorCode} ${r.errorMessage}`);
            return { file: path.join(dest, r.key!), sha256: r.sha256! };
        };
        const strictRestore = (b: { file: string; sha256: string }, extra: object = {}) =>
            restoreBackup({ encryptedPath: b.file, identity: keys.identity, adminUrl, expectedSha256: b.sha256, migrationsDir: MIGRATIONS_DIR, ...extra });
        const failing = (r: Awaited<ReturnType<typeof strictRestore>>) => r.checks.filter((c) => !c.ok).map((c) => c.name);

        it("sanity: a complete, healthy backup passes and is reportable", async () => {
            const r = await strictRestore(await variantBackup({}));
            expect(failing(r)).toEqual([]);
            expect(r).toMatchObject({ ok: true, reportable: true });
            expect(r.verifiedSha256).toMatch(/^[a-f0-9]{64}$/);
        });


        it("CLI: a drill that restores but FAILS an integrity check is reported to the app as FAILED, never COMPLETED", async () => {
            const zero = await variantBackup({ tenants: 0 });
            const out = fs.mkdtempSync(path.join(os.tmpdir(), "bk-cli3-"));
            const keyFile = path.join(out, "backup.key");
            fs.writeFileSync(keyFile, keys.identity, { mode: 0o600 });
            const posts: any[] = [];
            const server = http.createServer((req, res) => {
                let body = "";
                req.on("data", (d) => (body += d));
                req.on("end", () => { posts.push(JSON.parse(body)); res.writeHead(201); res.end("{}"); });
            });
            await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
            try {
                const run = await tsxAsync("scripts/restore-backup.ts", ["--file", zero.file, "--key-file", keyFile, "--sha256", zero.sha256, "--report"], {
                    TEST_DATABASE_ADMIN_URL: adminUrl, APP_URL: `http://127.0.0.1:${(server.address() as any).port}`, BACKUP_WEBHOOK_SECRET: "w".repeat(40),
                });
                expect(run.status).toBe(1);
                expect(run.stdout).toContain("FAIL  single clinic");
                expect(run.stdout).toContain("NOT a passing drill");
                expect(posts).toHaveLength(1);
                expect(posts[0]).toMatchObject({ type: "RESTORE_DRILL", status: "FAILED" });
                expect(posts[0].drill).toBeUndefined();
            } finally {
                await new Promise((r) => server.close(r));
                fs.rmSync(out, { recursive: true, force: true });
            }
        }, 180_000);

        it("the real application backup passes the strict drill too (checksum, one clinic, full migration history, validated foreign keys)", async () => {
            const r = await strictRestore(stored, { minRows: { tenants: 1, patients: 50 } });
            expect(failing(r)).toEqual([]);
            expect(r.reportable).toBe(true);
            expect(r.checks.map((c) => c.name)).toEqual(expect.arrayContaining(["checksum", "single clinic", "migrations: none unknown to this release", "migrations: up to date with this release", "foreign keys: all of the archive's are present", "foreign keys: all validated"]));
        });

        it("no checksum: refuses to run at all (nothing is created, nothing can be recorded)", async () => {
            const before = await leftovers();
            await expect(restoreBackup({ encryptedPath: stored.file, identity: keys.identity, adminUrl, migrationsDir: MIGRATIONS_DIR })).rejects.toMatchObject({ code: "CHECKSUM_MISMATCH" });
            expect(await leftovers()).toEqual(before);
        });

        it("a malformed checksum is refused; a wrong one is a mismatch", async () => {
            await expect(restoreBackup({ encryptedPath: stored.file, identity: keys.identity, adminUrl, expectedSha256: "not-hex" })).rejects.toMatchObject({ code: "CHECKSUM_MISMATCH" });
            await expect(restoreBackup({ encryptedPath: stored.file, identity: keys.identity, adminUrl, expectedSha256: "f".repeat(64) })).rejects.toMatchObject({ code: "CHECKSUM_MISMATCH" });
        });

        it("developer-only restore without a checksum is NEVER ok and NEVER reportable", async () => {
            const r = await restoreBackup({ encryptedPath: stored.file, identity: keys.identity, adminUrl, allowUnverified: true, migrationsDir: MIGRATIONS_DIR });
            expect(r.ok).toBe(false);
            expect(r.reportable).toBe(false);
            expect(r.verifiedSha256).toBeUndefined();
            expect(failing(r)).toContain("checksum");
            expect(r.checks.find((c) => c.name === "checksum")?.detail).toMatch(/NOT VERIFIED/);
        });

        it("zero clinics is a hard failure", async () => {
            const r = await strictRestore(await variantBackup({ tenants: 0 }));
            expect(r).toMatchObject({ ok: false, reportable: false });
            expect(failing(r)).toContain("single clinic");
        });

        it("two clinics is a hard failure", async () => {
            const r = await strictRestore(await variantBackup({ tenants: 2 }));
            expect(r).toMatchObject({ ok: false, reportable: false });
            expect(failing(r)).toContain("single clinic");
        });

        it("missing migration history is a failure", async () => {
            const r = await strictRestore(await variantBackup({ migrations: null }));
            expect(r).toMatchObject({ ok: false, reportable: false });
            expect(failing(r)).toContain("migrations: history present");
        });

        it("a migration unknown to this release is a failure", async () => {
            const r = await strictRestore(await variantBackup({ migrations: [...committed, "29990101000000_from_the_future"] }));
            expect(r).toMatchObject({ ok: false, reportable: false });
            expect(failing(r)).toContain("migrations: none unknown to this release");
        });

        it("a backup that predates this release is NON-PASSING, even with the older-backup flag, until migrations are applied and re-checked", async () => {
            const older = await variantBackup({ migrations: committed.slice(0, -1) });
            const plain = await strictRestore(older);
            expect(plain).toMatchObject({ ok: false, reportable: false });
            expect(failing(plain)).toContain("migrations: up to date with this release");
            const flagged = await strictRestore(older, { allowOlderBackup: true });
            expect(flagged).toMatchObject({ ok: false, reportable: false });
            expect(flagged.checks.find((c) => c.name === "migrations: up to date with this release")?.detail).toMatch(/NON-PASSING/);
        });

        it("no foreign keys at all in the archive is a failure", async () => {
            const r = await strictRestore(await variantBackup({ fk: "none" }));
            expect(r).toMatchObject({ ok: false, reportable: false });
            expect(failing(r)).toContain("foreign keys: all of the archive's are present");
        });

        it("an unvalidated foreign key is a failure", async () => {
            const r = await strictRestore(await variantBackup({ fk: "not-valid" }));
            expect(r).toMatchObject({ ok: false, reportable: false });
            expect(failing(r)).toContain("foreign keys: all validated");
        });

        it("counts the archive's own foreign keys from its table of contents", async () => {
            const b = await variantBackup({});
            const plain = path.join(work, "toc.dump");
            const { decryptBytes } = await import("@/lib/backup/crypto");
            fs.writeFileSync(plain, await decryptBytes(fs.readFileSync(b.file), keys.identity));
            expect(foreignKeysInToc(archiveToc(plain))).toBe(1);
            expect(foreignKeysInToc("")).toBe(0);
        });

        it("OLDER-BACKUP RECOVERY, end to end: a real backup from before the newest migration passes only after `prisma migrate deploy` is applied to the restored copy and re-checked", async () => {
            const name = `nexus_c1_test_older_${Date.now()}`;
            await q(`create database "${name}"`);
            const u = new URL(adminUrl);
            u.pathname = `/${name}`;
            try {
                const env = { PATH: process.env.PATH!, HOME: process.env.HOME!, DATABASE_URL: u.toString() } as unknown as NodeJS.ProcessEnv;
                const deploy = spawnSync("npx", ["prisma", "migrate", "deploy"], { cwd: ROOT, env, encoding: "utf8" });
                expect(deploy.status, deploy.stderr).toBe(0);
                const c = new pg.Client({ connectionString: u.toString() });
                await c.connect();
                const newest = committed[committed.length - 1];
                try {
                    await c.query(`insert into tenants (id,name,slug,"updatedAt") values ('t1','Older Clinic','older-clinic',now())`);
                    // Put the database back into the state it was in BEFORE the newest migration.
                    // Keep this assertion explicit so a future migration cannot silently turn this
                    // recovery test into a different or incomplete rollback fixture.
                    expect(newest).toMatch(/add_payment_attempts$/);
                    await c.query(`drop table payment_attempts`);
                    await c.query(`drop type "PaymentAttemptStatus"`);
                    await c.query(`delete from _prisma_migrations where migration_name = $1`, [newest]);
                } finally {
                    await c.end();
                }
                const r = await runBackup({ env: { DATABASE_URL: u.toString(), BACKUP_AGE_RECIPIENT: keys.recipient }, destination: new LocalDestination(dest), tmpRoot: work, now: new Date(Date.now() + 90_000) });
                expect(r.status, r.errorMessage).toBe("COMPLETED");
                const older = { file: path.join(dest, r.key!), sha256: r.sha256! };

                expect(await strictRestore(older)).toMatchObject({ ok: false, reportable: false });
                expect(await strictRestore(older, { allowOlderBackup: true })).toMatchObject({ ok: false, reportable: false });

                const recovered = await strictRestore(older, { allowOlderBackup: true, applyMigrations: true });
                expect(failing(recovered)).toEqual([]);
                expect(recovered).toMatchObject({ ok: true, reportable: true });
                expect(recovered.checks.find((c) => c.name === "migrations: up to date with this release")?.detail).toMatch(/brought up to date.*re-checked/);
                expect(recovered.tables["payment_attempts"]).toBe(0); // the newest migration really was applied
            } finally {
                await q(`drop database "${name}" with (force)`);
            }
        }, 180_000);
    });

    describe("target guards", () => {
        it("refuses any server that is not on localhost - before connecting to it", async () => {
            for (const remote of ["postgresql://u:p@db.example.com:5432/postgres", "postgresql://u:p@10.0.0.5:5432/postgres", "postgresql://u:p@ep-x.neon.tech/neondb"]) {
                await expect(restoreBackup({ encryptedPath: stored.file, identity: keys.identity, adminUrl: remote, expectedSha256: stored.sha256 })).rejects.toMatchObject({ code: "UNSAFE_TARGET" });
            }
            await expect(restoreBackup({ encryptedPath: stored.file, identity: keys.identity, adminUrl: "garbage", expectedSha256: stored.sha256 })).rejects.toBeInstanceOf(BackupError);
        });

        it("only ever creates nexus_restore_test_* databases and leaves none behind", async () => {
            expect(await leftovers()).toEqual(baselineRestoreDbs);
        });
    });

    describe("the real command-line scripts", () => {
        const tsx = (script: string, args: string[], env: Record<string, string>) =>
            spawnSync("npx", ["tsx", script, ...args], { cwd: ROOT, env: { PATH: process.env.PATH!, HOME: process.env.HOME!, ...env } as unknown as NodeJS.ProcessEnv, encoding: "utf8" });

        it("backup:run then backup:restore work end to end, and the key cannot live inside the repo", async () => {
            const out = fs.mkdtempSync(path.join(os.tmpdir(), "bk-cli-"));
            const keyFile = path.join(out, "backup.key");
            fs.writeFileSync(keyFile, keys.identity, { mode: 0o600 });
            try {
                const backup = tsx("scripts/run-backup.ts", [], { DATABASE_URL: URL_UNDER_TEST!, BACKUP_AGE_RECIPIENT: keys.recipient, BACKUP_LOCAL_DIR: path.join(out, "store") });
                expect(backup.status, backup.stderr).toBe(0);
                const file = fs.readdirSync(path.join(out, "store/daily"), { recursive: true }).map(String).find((f) => f.endsWith(".dump.age"))!;

                const restore = tsx("scripts/restore-backup.ts", ["--file", path.join(out, "store/daily", file), "--key-file", keyFile, "--min-rows", "patients=50"], { TEST_DATABASE_ADMIN_URL: adminUrl });
                expect(restore.status, restore.stdout + restore.stderr).toBe(0);
                expect(restore.stdout).toContain("PASS  restore");
                expect(restore.stdout).not.toContain(MARKER);
                expect(restore.stdout).not.toContain(keys.identity);

                // refuses a key stored inside the repository
                const inRepo = path.join(ROOT, "tmp-test-key.key");
                fs.writeFileSync(inRepo, keys.identity);
                try {
                    const refused = tsx("scripts/restore-backup.ts", ["--file", path.join(out, "store/daily", file), "--key-file", inRepo], { TEST_DATABASE_ADMIN_URL: adminUrl });
                    expect(refused.status).toBe(2);
                } finally {
                    fs.rmSync(inRepo, { force: true });
                }

                // no recipient => the real script exits 1 and stores nothing
                const none = path.join(out, "store2");
                const bad = tsx("scripts/run-backup.ts", [], { DATABASE_URL: URL_UNDER_TEST!, BACKUP_LOCAL_DIR: none });
                expect(bad.status).toBe(1);
                expect(fs.existsSync(none)).toBe(false);
            } finally {
                fs.rmSync(out, { recursive: true, force: true });
            }
        }, 120_000);

        it("strict CLI: a drill without a checksum is refused; --unverified can never report; a passing drill reports COMPLETED with its summary; a failing one reports FAILED", async () => {
            const out = fs.mkdtempSync(path.join(os.tmpdir(), "bk-cli2-"));
            const keyFile = path.join(out, "backup.key");
            fs.writeFileSync(keyFile, keys.identity, { mode: 0o600 });
            const posts: any[] = [];
            const server = http.createServer((req, res) => {
                let body = "";
                req.on("data", (d) => (body += d));
                req.on("end", () => { posts.push({ url: req.url, secret: req.headers["x-backup-secret"], body: JSON.parse(body) }); res.writeHead(201); res.end("{}"); });
            });
            await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
            const appUrl = `http://127.0.0.1:${(server.address() as any).port}`;
            const common = { TEST_DATABASE_ADMIN_URL: adminUrl, APP_URL: appUrl, BACKUP_WEBHOOK_SECRET: "w".repeat(40) };
            try {
                // a copy of the backup WITHOUT its manifest beside it
                const bare = path.join(out, "bare.dump.age");
                fs.copyFileSync(stored.file, bare);

                const noSum = await tsxAsync("scripts/restore-backup.ts", ["--file", bare, "--key-file", keyFile, "--report"], common);
                expect(noSum.status).toBe(2);
                expect(noSum.stderr).toMatch(/no expected SHA-256/);

                const unverifiedReport = await tsxAsync("scripts/restore-backup.ts", ["--file", bare, "--key-file", keyFile, "--unverified", "--report"], common);
                expect(unverifiedReport.status).toBe(2);

                const unverified = await tsxAsync("scripts/restore-backup.ts", ["--file", bare, "--key-file", keyFile, "--unverified"], common);
                expect(unverified.status).toBe(1);
                expect(unverified.stdout).toContain("NOT a passing drill");
                expect(posts).toHaveLength(0); // none of the above told the app anything

                const badSum = await tsxAsync("scripts/restore-backup.ts", ["--file", bare, "--key-file", keyFile, "--sha256", "0".repeat(64), "--report"], common);
                expect(badSum.status).toBe(1);
                expect(posts).toHaveLength(1);
                expect(posts[0].body).toMatchObject({ type: "RESTORE_DRILL", status: "FAILED" });
                expect(posts[0].body.drill).toBeUndefined();
                expect(JSON.stringify(posts[0])).not.toContain(keys.identity);

                posts.length = 0;
                const ok = await tsxAsync("scripts/restore-backup.ts", ["--file", bare, "--key-file", keyFile, "--sha256", stored.sha256, "--min-rows", "tenants=1", "--report"], common);
                expect(ok.status, ok.stdout + ok.stderr).toBe(0);
                expect(ok.stdout).toContain("strict drill PASSED");
                expect(posts).toHaveLength(1);
                expect(posts[0].url).toBe("/api/system/backups/complete");
                expect(posts[0].body).toMatchObject({ type: "RESTORE_DRILL", status: "COMPLETED", sha256: stored.sha256, encrypted: true, formatVersion: 1 });
                expect(posts[0].body.drill).toMatchObject({ strict: true, tenants: 1 });
                expect(posts[0].body.filePath).toBeUndefined(); // no timing text smuggled into filePath
                expect(posts[0].body.errorMessage).toBeUndefined();
            } finally {
                await new Promise((r) => server.close(r));
                fs.rmSync(out, { recursive: true, force: true });
            }
        }, 180_000);
    });
});
