/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures are intentionally loosely typed */
// Database-backed demo provisioning tests (run by `npm run test:provision`; skipped without TEST_DATABASE_URL).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "@/lib/auth/password";
import { DEMO_IDS, DemoError, demoReadiness, generateDemoPassword, provisionDemo } from "@/lib/demo/provision";
import { validatePasswordStrength } from "@/lib/auth/password";

const URL_UNDER_TEST = process.env.TEST_DATABASE_URL;
if (URL_UNDER_TEST) {
    const u = new URL(URL_UNDER_TEST);
    if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname) || !u.pathname.replace(/^\//, "").startsWith("nexus_c1_test_")) {
        throw new Error("Refusing to run: TEST_DATABASE_URL must be a LOCAL nexus_c1_test_* database. These tests truncate tables.");
    }
}
const suite = URL_UNDER_TEST ? describe : describe.skip;

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS = path.join(ROOT, "prisma/migrations");
const CLINIC = "demo-clinic";
const DEMO_PHONE = "+233200000099";
const ENV = {
    NODE_ENV: "test", DEMO_MODE: "true", CLINIC_ID: CLINIC, DEMO_PATIENT_PHONE: "0200000099", DEMO_SMS_ALLOWLIST: DEMO_PHONE,
    SMS_PROVIDER: "mnotify", MNOTIFY_API_KEY: "k".repeat(20), MNOTIFY_SENDER_ID: "Demo",
    NEXT_PUBLIC_FIREBASE_API_KEY: "x", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "x", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "x", NEXT_PUBLIC_FIREBASE_APP_ID: "x",
} as Record<string, string>;

suite("synthetic demo provisioning against a real, freshly migrated database", () => {
    let pool: pg.Pool;
    let prisma: PrismaClient;
    let tmp: string;
    let seq = 0;
    const credsFile = () => path.join(tmp, `creds-${seq++}.txt`);
    const tables = ["users", "patients", "services", "appointments", "prescriptions", "invoices", "treatment_plans", "treatment_steps", "tooth_records", "appointment_reminders", "notifications", "audit_logs", "user_roles_mapping"];
    const counts = async () => Object.fromEntries(await Promise.all(tables.map(async (t) => [t, (await pool.query(`select count(*)::int c from "${t}"`)).rows[0].c])));
    const run = (over: Record<string, unknown> = {}, env: Record<string, string> = ENV) =>
        provisionDemo({ prisma, env, confirmClinic: CLINIC, credentialsOut: credsFile(), migrationsDir: MIGRATIONS, ...over } as any);

    beforeAll(async () => {
        pool = new pg.Pool({ connectionString: URL_UNDER_TEST });
        prisma = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: URL_UNDER_TEST })) });
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), "demo-test-"));
    });
    afterAll(async () => {
        await prisma?.$disconnect();
        await pool?.end();
        fs.rmSync(tmp, { recursive: true, force: true });
    });
    beforeEach(async () => {
        await pool.query(`TRUNCATE tenants, users, patients, system_config, audit_logs CASCADE`);
        await pool.query(`insert into tenants (id,name,slug,timezone,"updatedAt") values ($1,'Demo Clinic','demo-clinic','Africa/Accra',now())`, [CLINIC]);
    });

    describe("refusals (nothing is written)", () => {
        const refused = async (operation: () => Promise<unknown>, code: string) => {
            const before = await counts();
            // Start the operation only after the baseline counts are ready. Creating an
            // already-rejected promise before attaching `expect(...).rejects` makes Node
            // report a transient unhandled rejection on fast, synchronous guard failures.
            await expect(operation()).rejects.toMatchObject({ name: "DemoError", code });
            expect(await counts()).toEqual(before);
        };
        it("not in demo mode", () => refused(() => run({}, { ...ENV, DEMO_MODE: "false" }), "NOT_DEMO_MODE"));
        it("DEMO_MODE unset", () => refused(() => run({}, { ...ENV, DEMO_MODE: "" }), "NOT_DEMO_MODE"));
        it("no clinic confirmation", () => refused(() => run({ confirmClinic: undefined }), "CONFIRMATION_REQUIRED"));
        it("a wrong clinic confirmation (a typo or a different clinic)", () => refused(() => run({ confirmClinic: "other-clinic" }), "CONFIRMATION_REQUIRED"));
        it("no demo patient phone is invented", () => refused(() => run({}, { ...ENV, DEMO_PATIENT_PHONE: "" }), "PHONE_REQUIRED"));
        it("an invalid demo patient phone", () => refused(() => run({}, { ...ENV, DEMO_PATIENT_PHONE: "banana" }), "PHONE_REQUIRED"));
        it("a demo phone that is not on the SMS allowlist", () => refused(() => run({}, { ...ENV, DEMO_SMS_ALLOWLIST: "+233200000001" }), "PHONE_NOT_ALLOWLISTED"));
        it("the clinic in the database is not the confirmed CLINIC_ID", async () => {
            await pool.query(`update tenants set id='different-id'`);
            await refused(() => run(), "CLINIC_MISSING");
        });
        it("no clinic at all", async () => {
            await pool.query(`TRUNCATE tenants CASCADE`);
            await refused(() => run(), "CLINIC_MISSING");
        });
        it("a second clinic exists", async () => {
            await pool.query(`insert into tenants (id,name,slug,"updatedAt") values ('second','Second','second',now())`);
            await refused(() => run(), "SECOND_CLINIC");
        });
        it("a credentials file inside the repository", () => refused(() => run({ credentialsOut: path.join(ROOT, "demo-creds.txt") }), "CREDENTIALS_FILE_INVALID"));
        it("a credentials file that already exists (never overwritten)", async () => {
            const f = credsFile();
            fs.writeFileSync(f, "precious");
            await refused(() => run({ credentialsOut: f }), "CREDENTIALS_FILE_INVALID");
            expect(fs.readFileSync(f, "utf8")).toBe("precious");
        });
        it("no credentials file although new accounts need one", () => refused(() => run({ credentialsOut: undefined }), "CREDENTIALS_FILE_INVALID"));
        it("migrations not applied", async () => {
            const before = await counts();
            await pool.query(`update _prisma_migrations set finished_at = null where migration_name = (select migration_name from _prisma_migrations order by migration_name desc limit 1)`);
            try { await expect(run()).rejects.toMatchObject({ code: "MIGRATIONS_NOT_APPLIED" }); }
            finally { await pool.query(`update _prisma_migrations set finished_at = now() where finished_at is null`); }
            expect(await counts()).toEqual(before);
        });
        it("a real patient already has the controlled phone", async () => {
            await pool.query(`insert into patients (id,"tenantId",phone,"firstName","lastName","updatedAt") values ('real-1',$1,$2,'Kofi','Real',now())`, [CLINIC, DEMO_PHONE]);
            const before = await counts();
            await expect(run()).rejects.toMatchObject({ code: "REAL_RECORD_COLLISION" });
            expect(await counts()).toEqual(before); // the transaction rolled back every demo row it had started
        });
        it("a different account already uses a demo e-mail address", async () => {
            await pool.query(`insert into users (id,email,"passwordHash","firstName","lastName","tenantId","updatedAt") values ('real-user','owner@demo.invalid','x','R','U',$1,now())`, [CLINIC]);
            const before = await counts();
            await expect(run()).rejects.toMatchObject({ code: "REAL_RECORD_COLLISION" });
            expect(await counts()).toEqual(before);
        });
    });

    describe("a first run", () => {
        it("creates labelled synthetic data, passwords only in a private file, and sends/queues nothing", async () => {
            await pool.query(`insert into tenant_settings (id,"tenantId","featureFlags") values ('ts1',$1,'{"enablePharmacy":false,"paystack":true}')`, [CLINIC]);
            const file = credsFile();
            const result = await run({ credentialsOut: file });
            expect(result.created).toMatchObject({ staff: 3, services: 4, patient: 1, visit: 1, "upcoming appointment": 1, "treatment plan": 1, "chart entries": 2 });
            expect(result.passwordsWritten).toBe(3);
            expect(JSON.stringify(result)).not.toMatch(/password:/);

            // the credentials file: private, outside the repo, with working one-off passwords
            expect((fs.statSync(file).mode & 0o777).toString(8)).toBe("600");
            const text = fs.readFileSync(file, "utf8");
            const rows = [...text.matchAll(/(\S+@demo\.invalid)\s+password: (\S+)/g)];
            expect(rows).toHaveLength(3);
            for (const [, email, password] of rows) {
                expect(validatePasswordStrength(password).valid).toBe(true);
                const { rows: u } = await pool.query(`select "passwordHash" h from users where email=$1`, [email]);
                expect(await verifyPassword(password, u[0].h)).toBe(true);
                expect(u[0].h).not.toContain(password);
            }
            expect(new Set(rows.map((r) => r[2])).size).toBe(3); // distinct

            // accounts, roles, and everything is clearly synthetic
            const roles = (await pool.query(`select u.email, m."systemRole" r from users u join user_roles_mapping m on m."userId"=u.id order by u.email`)).rows;
            expect(roles).toEqual([{ email: "dentist@demo.invalid", r: "DOCTOR" }, { email: "owner@demo.invalid", r: "CLINIC_OWNER" }, { email: "reception@demo.invalid", r: "RECEPTIONIST" }]);
            const patient = (await pool.query(`select * from patients where id=$1`, [DEMO_IDS.patient])).rows[0];
            expect(patient.phone).toBe(DEMO_PHONE);
            expect(patient.medicalNotes).toMatch(/SYNTHETIC/);
            expect((await pool.query(`select count(*)::int c from services where id like 'demo-svc-%'`)).rows[0].c).toBe(4);
            expect((await pool.query(`select count(*)::int c from treatment_steps where "planId"=$1`, [DEMO_IDS.plan])).rows[0].c).toBe(3);
            const inv = (await pool.query(`select status,"paymentMethod","totalAmount" from invoices where id=$1`, [DEMO_IDS.invoice])).rows[0];
            expect(inv).toMatchObject({ status: "PAID", paymentMethod: "CASH", totalAmount: 150 });
            expect((await pool.query(`select status from appointments order by id`)).rows.map((r) => r.status)).toEqual(["SCHEDULED", "COMPLETED"]);

            // seeding must never cause an SMS: no reminder rows, no notifications
            const c = await counts();
            expect(c.appointment_reminders).toBe(0);
            expect(c.notifications).toBe(0);

            // the clinic's other settings survive, and reminders are switched on
            const flags = (await pool.query(`select "featureFlags" f from tenant_settings where "tenantId"=$1`, [CLINIC])).rows[0].f;
            expect(flags).toEqual({ enablePharmacy: false, paystack: true, enableSmsReminders: true });

            // an audit trail without secrets
            const audit = (await pool.query(`select "newValue" v from audit_logs where action='DEMO_PROVISIONED'`)).rows;
            expect(audit).toHaveLength(1);
            expect(JSON.stringify(audit)).not.toMatch(/password:|"password"|@demo\.invalid|\+2332000/);
        });

        it("the dates are relative to the clinic's time zone (past visit yesterday, next visit tomorrow)", async () => {
            const now = new Date("2026-10-12T09:00:00Z");
            await run({ now });
            const rows = (await pool.query(`select id, "dateTime" d from appointments`)).rows;
            const get = (id: string) => rows.find((r) => r.id === id).d.toISOString();
            expect(get(DEMO_IDS.pastAppointment)).toBe("2026-10-11T10:00:00.000Z");
            expect(get(DEMO_IDS.nextAppointment)).toBe("2026-10-13T10:00:00.000Z");
        });
    });

    describe("idempotency", () => {
        it("a second run changes nothing, creates no duplicates and generates no new passwords or file", async () => {
            await run();
            const before = await counts();
            const hashes = (await pool.query(`select id,"passwordHash" h from users order by id`)).rows;
            const second = await provisionDemo({ prisma, env: ENV, confirmClinic: CLINIC, migrationsDir: MIGRATIONS }); // no credentials file needed: nothing new
            expect(second.created).toEqual({});
            expect(second.passwordsWritten).toBe(0);
            expect(second.credentialsFile).toBeNull();
            const after = await counts();
            expect({ ...after, audit_logs: 0 }).toEqual({ ...before, audit_logs: 0 }); // only the audit entry for the new run differs
            expect(after.audit_logs).toBe(before.audit_logs + 1);
            expect((await pool.query(`select id,"passwordHash" h from users order by id`)).rows).toEqual(hashes);
        });

        it("TWO SIMULTANEOUS runs still produce exactly one of everything", async () => {
            const [a, b] = await Promise.allSettled([run(), run()]);
            expect([a.status, b.status]).toEqual(["fulfilled", "fulfilled"]);
            const c = await counts();
            expect(c).toMatchObject({ users: 3, patients: 1, services: 4, appointments: 2, prescriptions: 1, invoices: 1, treatment_plans: 1, treatment_steps: 3, tooth_records: 2 });
            // exactly one of the two runs created (and therefore holds the passwords of) the accounts
            const written = [a, b].map((r: any) => r.value.passwordsWritten).sort();
            expect(written).toEqual([0, 3]);
        });

        it("--rotate-passwords replaces the passwords (old ones stop working) and says so only in the file", async () => {
            const first = credsFile();
            await run({ credentialsOut: first });
            const old = [...fs.readFileSync(first, "utf8").matchAll(/(\S+@demo\.invalid)\s+password: (\S+)/g)].map((m) => ({ email: m[1], password: m[2] }));
            const second = credsFile();
            const r = await run({ credentialsOut: second, rotatePasswords: true });
            expect(r.passwordsWritten).toBe(3);
            const fresh = [...fs.readFileSync(second, "utf8").matchAll(/(\S+@demo\.invalid)\s+password: (\S+)/g)].map((m) => ({ email: m[1], password: m[2] }));
            for (const o of old) {
                const f = fresh.find((x) => x.email === o.email)!;
                const { rows } = await pool.query(`select "passwordHash" h from users where email=$1`, [o.email]);
                expect(await verifyPassword(o.password, rows[0].h)).toBe(false);
                expect(await verifyPassword(f.password, rows[0].h)).toBe(true);
            }
        });

        it("re-activates a demo account that was suspended, without touching its password", async () => {
            await run();
            const before = (await pool.query(`select "passwordHash" h from users where id=$1`, [DEMO_IDS.doctor])).rows[0].h;
            await pool.query(`update users set status='SUSPENDED' where id=$1`, [DEMO_IDS.doctor]);
            await provisionDemo({ prisma, env: ENV, confirmClinic: CLINIC, migrationsDir: MIGRATIONS });
            const row = (await pool.query(`select status,"passwordHash" h from users where id=$1`, [DEMO_IDS.doctor])).rows[0];
            expect(row).toMatchObject({ status: "ACTIVE", h: before });
        });
    });

    describe("it never deletes or alters what it does not own", () => {
        it("pre-existing real clinic data is byte-for-byte unchanged", async () => {
            await pool.query(`insert into patients (id,"tenantId",phone,"firstName","lastName","medicalNotes","updatedAt") values ('real-p',$1,'+233244000111','Kofi','Real','genuine notes',now())`, [CLINIC]);
            await pool.query(`insert into services (id,"tenantId",name,category,duration,price,"updatedAt") values ('real-svc',$1,'Real service','GENERAL',20,99,now())`, [CLINIC]);
            await pool.query(`insert into users (id,email,"passwordHash","firstName","lastName","tenantId","updatedAt") values ('real-owner','owner@real-clinic.test','hash','Real','Owner',$1,now())`, [CLINIC]);
            const snap = async () => JSON.stringify([
                (await pool.query(`select * from patients where id='real-p'`)).rows, (await pool.query(`select * from services where id='real-svc'`)).rows, (await pool.query(`select * from users where id='real-owner'`)).rows,
            ]);
            const before = await snap();
            await run();
            await provisionDemo({ prisma, env: ENV, confirmClinic: CLINIC, migrationsDir: MIGRATIONS });
            expect(await snap()).toBe(before);
        });
    });

    describe("readiness check (--check)", () => {
        it("before provisioning: NOT READY, names what is missing, writes nothing, shows no PII", async () => {
            const before = await counts();
            const r = await demoReadiness(prisma, ENV, MIGRATIONS);
            expect(r.ok).toBe(false);
            expect(r.checks.filter((c) => !c.ok).map((c) => c.name)).toEqual(expect.arrayContaining(["owner account", "receptionist account", "doctor account", "demo patient", "demo services"]));
            expect(await counts()).toEqual(before);
            const text = JSON.stringify(r);
            expect(text).not.toContain("0200000099");
            expect(text).not.toContain(DEMO_PHONE);
            expect(text).not.toMatch(/k{20}/);
        });

        it("after provisioning: READY, and still prints no credential, token or full phone number", async () => {
            const file = credsFile();
            await run({ credentialsOut: file });
            const r = await demoReadiness(prisma, ENV, MIGRATIONS);
            expect(r.checks.filter((c) => !c.ok)).toEqual([]);
            expect(r.ok).toBe(true);
            const text = JSON.stringify(r);
            for (const [, , password] of fs.readFileSync(file, "utf8").matchAll(/(\S+@demo\.invalid)\s+password: (\S+)/g)) expect(text).not.toContain(password);
            expect(text).not.toContain(DEMO_PHONE);
            expect(r.checks.find((c) => c.name === "demo patient")?.detail).toMatch(/\+23320\*\*\*\*99/);
        });

        it("flags the specific demo-mode problems", async () => {
            await run();
            const bad = await demoReadiness(prisma, { ...ENV, DEMO_MODE: "false", SMS_PROVIDER: "", DEMO_SMS_ALLOWLIST: "", DEMO_PATIENT_PHONE: "" }, MIGRATIONS);
            expect(bad.ok).toBe(false);
            expect(bad.checks.filter((c) => !c.ok).map((c) => c.name)).toEqual(expect.arrayContaining(["DEMO_MODE", "SMS provider", "SMS allowlist", "demo patient phone", "demo phone is approved for SMS"]));
        });

        it("a clinic that switched reminders off is not ready", async () => {
            await run();
            await pool.query(`update tenant_settings set "featureFlags" = "featureFlags" || '{"enableSmsReminders": false}'::jsonb where "tenantId"=$1`, [CLINIC]);
            const r = await demoReadiness(prisma, ENV, MIGRATIONS);
            expect(r.checks.find((c) => c.name === "clinic SMS reminders switch")).toMatchObject({ ok: false });
        });
    });

    describe("helpers", () => {
        it("generated passwords satisfy the app's policy and are unique", () => {
            const set = new Set(Array.from({ length: 50 }, generateDemoPassword));
            expect(set.size).toBe(50);
            for (const p of set) expect(validatePasswordStrength(p).valid).toBe(true);
        });
        it("DemoError is a real Error with a code", () => {
            expect(new DemoError("NOT_READY", "x")).toBeInstanceOf(Error);
        });
    });
});
