/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures and database mocks are intentionally loosely typed */
// Database-backed provisioning tests.
//
// Run through `npm run test:provision`, which creates a brand-new throwaway
// database, applies the committed migrations (a genuine clean install), runs this
// file against it, and drops it. Without TEST_DATABASE_URL these tests are skipped.
//
// Never point TEST_DATABASE_URL at a real database: every test TRUNCATEs all
// tables. The guard below refuses anything that isn't a local nexus_c1_test_* DB.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { loadManifestFile, type ClinicManifest } from "@/lib/config/manifest";
import { ProvisionError, provisionClinic, PROVISIONER_USER_ID } from "@/lib/config/provision";
import { hashInviteToken, inviteTokenLookupValues } from "@/lib/auth/invite-token";
import { SECRETS, validEnv } from "./helpers/config";

const URL_UNDER_TEST = process.env.TEST_DATABASE_URL;

if (URL_UNDER_TEST) {
    const u = new URL(URL_UNDER_TEST);
    const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
    const disposable = u.pathname.replace(/^\//, "").startsWith("nexus_c1_test_");
    if (!local || !disposable) {
        throw new Error("Refusing to run: TEST_DATABASE_URL must be a LOCAL database named nexus_c1_test_*. These tests truncate every table.");
    }
}

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "prisma/migrations");
const EXAMPLE = path.join(ROOT, "clients/example/clinic.yaml");
const CLINIC = "example-dental-clinic";

const suite = URL_UNDER_TEST ? describe : describe.skip;

suite("clinic provisioning against a real, freshly migrated database", () => {
    let pool: pg.Pool;
    let prisma: PrismaClient;
    const tmp: string[] = [];

    const manifest = (mutate?: (m: ClinicManifest) => void): ClinicManifest => {
        const m = loadManifestFile(EXAMPLE);
        mutate?.(m);
        return m;
    };
    const env = (over: Record<string, string | undefined> = {}) =>
        validEnv({ NODE_ENV: "test", DATABASE_URL: URL_UNDER_TEST!, ...over });
    const invitePath = () => {
        const p = path.join(os.tmpdir(), `nexus-invite-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
        tmp.push(p);
        return p;
    };
    const count = async (table: string) => (await pool.query(`select count(*)::int as c from "${table}"`)).rows[0].c as number;
    const provision = (over: Partial<Parameters<typeof provisionClinic>[0]> = {}) =>
        provisionClinic({
            prisma,
            manifest: manifest(),
            env: env(),
            migrationsDir: MIGRATIONS_DIR,
            ownerInvite: { type: "file", path: invitePath() },
            ...over,
        });
    const tokenFromFile = (file: string) => fs.readFileSync(file, "utf8").match(/token=([a-f0-9]{64})/)![1];
    const snapshot = async () =>
        Object.fromEntries(
            await Promise.all(
                ["tenants", "tenant_settings", "tenant_content", "consent_templates", "services", "users", "staff_invites", "audit_logs"].map(
                    async (t) => [t, await count(t)] as const
                )
            )
        );

    beforeAll(async () => {
        pool = new pg.Pool({ connectionString: URL_UNDER_TEST });
        prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    });

    afterAll(async () => {
        for (const f of tmp) fs.rmSync(f, { force: true });
        await prisma.$disconnect();
        await pool.end();
    });

    beforeEach(async () => {
        const { rows } = await pool.query(`select tablename from pg_tables where schemaname = 'public' and tablename <> '_prisma_migrations'`);
        await pool.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
    });

    // ── The clean install itself ─────────────────────────────────────────────

    it("the migrations alone build the complete schema, including the appointment/service join table", async () => {
        const { rows } = await pool.query(`select to_regclass('public."_AppointmentAdditionalServices"') is not null as present`);
        expect(rows[0].present).toBe(true);
        const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
        const models = (schema.match(/^model /gm) ?? []).length;
        const { rows: t } = await pool.query(
            `select count(*)::int as c from information_schema.tables where table_schema = 'public' and table_name <> '_prisma_migrations'`
        );
        expect(t[0].c).toBe(models + 1); // every model + the implicit many-to-many join table
    });

    // ── First provision ──────────────────────────────────────────────────────

    describe("first provision of an empty database", () => {
        it("creates exactly one fully configured clinic", async () => {
            const file = invitePath();
            const result = await provision({ ownerInvite: { type: "file", path: file } });

            expect(result).toMatchObject({ mode: "apply", clinicId: CLINIC, slug: "example-dental", tenant: "created", settings: "created", content: "created", owner: "invite_issued", inviteDelivery: "file" });

            const tenants = await prisma.tenant.findMany();
            expect(tenants).toHaveLength(1);
            expect(tenants[0]).toMatchObject({ id: CLINIC, slug: "example-dental", name: "Example Dental Clinic", status: "ACTIVE", timezone: "Africa/Accra" });

            const settings = await prisma.tenantSettings.findUniqueOrThrow({ where: { tenantId: CLINIC } });
            expect(settings.platformName).toBe("Example Dental Clinic");
            expect(settings.primaryColor).toBe("#0d9488");
            expect(settings.featureFlags).toEqual({ paystack: true, hubtel: true, resend: true, telehealth: false, mnotify: false });
            expect((settings.hoursOfOperation as any).saturday.isOpen).toBe(true);

            const content = await prisma.tenantContent.findUniqueOrThrow({ where: { tenantId: CLINIC } });
            expect(content.mission).toMatch(/accessible/);

            expect(await prisma.service.findMany({ where: { tenantId: CLINIC }, orderBy: { name: "asc" } })).toEqual([
                expect.objectContaining({ name: "Check-up & Cleaning", category: "GENERAL", duration: 30, price: 150, isActive: true }),
                expect.objectContaining({ name: "Teeth Whitening", category: "COSMETIC", duration: 60, price: 450, isActive: true }),
            ]);
            expect(result.services).toEqual({ created: 2, existing: 0 });

            const template = await prisma.consentTemplate.findUniqueOrThrow({ where: { id: "global-telehealth-consent" } });
            expect(template.content).not.toMatch(/HIPAA/);
            expect(template.content).toMatch(/Act 843/);
        });

        it("makes the provisioning actor an inactive, unloggable account that belongs to no clinic", async () => {
            await provision();
            const actor = await prisma.user.findUniqueOrThrow({ where: { id: PROVISIONER_USER_ID }, include: { roles: true } });
            expect(actor).toMatchObject({ status: "INACTIVE", tenantId: null });
            expect(actor.roles).toEqual([]);
            expect(actor.passwordHash).toMatch(/^\$2[aby]\$/);
            // so it never shows up in the clinic's staff list
            expect(await prisma.user.count({ where: { tenantId: CLINIC } })).toBe(0);
        });

        it("stores the owner invitation HASHED, single-use, with the owner role and the configured expiry", async () => {
            const file = invitePath();
            const before = Date.now();
            const result = await provision({ ownerInvite: { type: "file", path: file } });

            const raw = tokenFromFile(file);
            const invite = await prisma.staffInvite.findFirstOrThrow({ where: { tenantId: CLINIC } });
            expect(invite.token).toBe(hashInviteToken(raw));
            expect(invite.token).not.toContain(raw);
            expect(invite).toMatchObject({ role: "CLINIC_OWNER", email: "owner@example-dental.test", acceptedAt: null, invitedById: PROVISIONER_USER_ID });
            const hours = (invite.expiresAt.getTime() - before) / 3_600_000;
            expect(hours).toBeGreaterThan(71.9);
            expect(hours).toBeLessThan(72.1);
            expect(result.inviteExpiresAt).toBe(invite.expiresAt.toISOString());
        });

        it("writes the invitation link only to a private (0600) file, and never to the console", async () => {
            const logs: string[] = [];
            const spies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation((...a) => void logs.push(a.join(" "))));
            const file = invitePath();
            try {
                const result = await provision({ ownerInvite: { type: "file", path: file } });
                const raw = tokenFromFile(file);

                expect((fs.statSync(file).mode & 0o777).toString(8)).toBe("600");
                expect(fs.readFileSync(file, "utf8")).toContain("https://app.example-dental.test/onboarding/accept?token=");
                const everything = logs.join("\n") + JSON.stringify(result);
                expect(everything).not.toContain(raw);
                expect(everything).not.toContain("onboarding/accept");
            } finally {
                spies.forEach((s) => s.mockRestore());
            }
        });

        it("records attributable audit evidence without any token", async () => {
            const file = invitePath();
            await provision({ ownerInvite: { type: "file", path: file } });
            const raw = tokenFromFile(file);
            const logs = await prisma.auditLog.findMany({ orderBy: { timestamp: "asc" } });
            expect(logs.map((l) => l.action)).toEqual(["CLINIC_PROVISIONED", "OWNER_INVITE_ISSUED"]);
            expect(logs.every((l) => l.userId === PROVISIONER_USER_ID && l.tenantId === CLINIC)).toBe(true);
            expect(JSON.stringify(logs)).not.toContain(raw);
        });
    });

    // ── Safe to re-run ───────────────────────────────────────────────────────

    describe("re-running provisioning", () => {
        it("changes nothing and creates no duplicates", async () => {
            await provision();
            const before = await snapshot();
            const inviteBefore = await prisma.staffInvite.findFirstOrThrow({ where: { tenantId: CLINIC } });

            const again = await provision({ ownerInvite: { type: "skip" } });

            expect(await snapshot()).toEqual(before);
            expect(again).toMatchObject({ tenant: "unchanged", settings: "unchanged", content: "unchanged", owner: "invite_pending" });
            expect(again.consentTemplates).toEqual({ created: 0, existing: 1 });
            expect(again.services).toEqual({ created: 0, existing: 2 });
            expect((await prisma.staffInvite.findFirstOrThrow({ where: { tenantId: CLINIC } })).token).toBe(inviteBefore.token);
        });

        it("does not overwrite what the clinic edited after the first run", async () => {
            await provision();
            await prisma.tenantSettings.update({ where: { tenantId: CLINIC }, data: { primaryColor: "#ff0000", platformName: "Renamed In App" } });
            await prisma.tenantContent.update({ where: { tenantId: CLINIC }, data: { aboutPage: "Our own words." } });
            await prisma.service.updateMany({ where: { tenantId: CLINIC, name: "Teeth Whitening" }, data: { price: 999 } });
            await prisma.consentTemplate.update({ where: { id: "global-telehealth-consent" }, data: { content: "Clinic-edited consent wording." } });
            await prisma.tenant.update({ where: { id: CLINIC }, data: { phone: "+233 24 111 1111" } });

            await provision({ ownerInvite: { type: "skip" } });

            expect((await prisma.tenantSettings.findUniqueOrThrow({ where: { tenantId: CLINIC } })).primaryColor).toBe("#ff0000");
            expect((await prisma.tenantSettings.findUniqueOrThrow({ where: { tenantId: CLINIC } })).platformName).toBe("Renamed In App");
            expect((await prisma.tenantContent.findUniqueOrThrow({ where: { tenantId: CLINIC } })).aboutPage).toBe("Our own words.");
            expect((await prisma.service.findFirstOrThrow({ where: { name: "Teeth Whitening" } })).price).toBe(999);
            expect((await prisma.consentTemplate.findUniqueOrThrow({ where: { id: "global-telehealth-consent" } })).content).toBe("Clinic-edited consent wording.");
            expect((await prisma.tenant.findUniqueOrThrow({ where: { id: CLINIC } })).phone).toBe("+233 24 111 1111");
        });

        it("fills in blanks the clinic left empty, but only blanks", async () => {
            await provision();
            await prisma.tenant.update({ where: { id: CLINIC }, data: { address: null } });
            await provision({ ownerInvite: { type: "skip" } });
            expect((await prisma.tenant.findUniqueOrThrow({ where: { id: CLINIC } })).address).toBe("1 Example Street, Accra, Ghana");
        });

        it("reconciles identity and feature flags from the manifest, and audits the change", async () => {
            await provision();
            const result = await provision({
                manifest: manifest((m) => {
                    m.clinic.name = "Example Dental Clinic (Renamed)";
                    m.features = ["paystack"];
                }),
                env: env({ ENABLED_FEATURES: "paystack" }),
                ownerInvite: { type: "skip" },
            });
            expect(result).toMatchObject({ tenant: "updated", settings: "updated" });
            expect((await prisma.tenant.findUniqueOrThrow({ where: { id: CLINIC } })).name).toBe("Example Dental Clinic (Renamed)");
            expect((await prisma.tenantSettings.findUniqueOrThrow({ where: { tenantId: CLINIC } })).featureFlags).toEqual({ paystack: true, hubtel: false, resend: false, telehealth: false, mnotify: false });
            expect((await prisma.auditLog.findMany()).map((l) => l.action)).toContain("CLINIC_RECONCILED");
        });

        it("keeps flags the app added for itself", async () => {
            await provision();
            await prisma.tenantSettings.update({ where: { tenantId: CLINIC }, data: { featureFlags: { paystack: true, hubtel: true, resend: true, telehealth: false, betaWidget: true } } });
            await provision({ ownerInvite: { type: "skip" } });
            expect(((await prisma.tenantSettings.findUniqueOrThrow({ where: { tenantId: CLINIC } })).featureFlags as any).betaWidget).toBe(true);
        });

        it("two simultaneous runs still produce exactly one clinic", async () => {
            const results = await Promise.all([
                provision({ ownerInvite: { type: "file", path: invitePath() } }),
                provision({ ownerInvite: { type: "file", path: invitePath() } }),
            ]);
            expect(results.map((r) => r.mode)).toEqual(["apply", "apply"]);
            expect(await snapshot()).toMatchObject({ tenants: 1, tenant_settings: 1, tenant_content: 1, services: 2, staff_invites: 1, consent_templates: 1 });
            expect(results.map((r) => r.tenant).sort()).toEqual(["created", "unchanged"]);
        });
    });

    // ── Exactly one clinic ───────────────────────────────────────────────────

    describe("a clinic deployment holds exactly one clinic", () => {
        it("refuses to provision a different clinic into a database that has one, and writes nothing", async () => {
            await provision();
            const before = await snapshot();
            const other = manifest((m) => {
                m.clinic.id = "second-clinic";
                m.clinic.slug = "second";
            });
            await expect(provision({ manifest: other, env: env({ CLINIC_ID: "second-clinic" }) })).rejects.toMatchObject({ code: "SECOND_CLINIC_REFUSED" });
            expect(await snapshot()).toEqual(before);
            expect(await prisma.tenant.count()).toBe(1);
        });

        it("refuses a changed slug for the existing clinic", async () => {
            await provision();
            const before = await snapshot();
            await expect(provision({ manifest: manifest((m) => (m.clinic.slug = "new-slug")) })).rejects.toMatchObject({ code: "SLUG_IMMUTABLE" });
            expect(await snapshot()).toEqual(before);
        });

        it("refuses when CLINIC_ID in the environment differs from the manifest — CLINIC_ID and the database row cannot diverge", async () => {
            await expect(provision({ env: env({ CLINIC_ID: "different-id" }) })).rejects.toMatchObject({ code: "CONFIG_INVALID" });
            expect(await prisma.tenant.count()).toBe(0);
        });

        it("the clinic row is created with the manifest's id as its primary key", async () => {
            await provision();
            const { rows } = await pool.query(`select id from tenants`);
            expect(rows).toEqual([{ id: CLINIC }]);
        });
    });

    // ── Migrations ───────────────────────────────────────────────────────────

    describe("migration preconditions", () => {
        it("refuses when a migration in this release has not been applied", async () => {
            const last = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort().pop()!;
            const saved = (await pool.query(`select * from _prisma_migrations where migration_name = $1`, [last])).rows[0];
            await pool.query(`delete from _prisma_migrations where migration_name = $1`, [last]);
            try {
                await expect(provision()).rejects.toMatchObject({ code: "MIGRATIONS_NOT_APPLIED" });
                expect(await prisma.tenant.count()).toBe(0);
            } finally {
                const cols = Object.keys(saved);
                await pool.query(`insert into _prisma_migrations (${cols.map((c) => `"${c}"`).join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`, cols.map((c) => saved[c]));
            }
        });

        it("refuses when the migration table does not exist at all, and not as a generic crash", async () => {
            await pool.query(`alter table _prisma_migrations rename to _prisma_migrations_hidden`);
            try {
                await expect(provision()).rejects.toMatchObject({ code: "MIGRATIONS_NOT_APPLIED" });
            } finally {
                await pool.query(`alter table _prisma_migrations_hidden rename to _prisma_migrations`);
            }
        });

        it("a clean install passes the migration check", async () => {
            await expect(provision({ ownerInvite: { type: "skip" } })).resolves.toMatchObject({ tenant: "created" });
        });
    });

    // ── Production gate against a real database ──────────────────────────────

    describe("production execution", () => {
        const prodManifest = () => manifest((m) => (m.deployment.environment = "production"));

        it("is refused without confirmation and leaves the database empty", async () => {
            await expect(provision({ manifest: prodManifest() })).rejects.toMatchObject({ code: "PRODUCTION_CONFIRMATION_REQUIRED" });
            expect(await snapshot()).toEqual({ tenants: 0, tenant_settings: 0, tenant_content: 0, consent_templates: 0, services: 0, users: 0, staff_invites: 0, audit_logs: 0 });
        });

        it("proceeds when the clinic id is typed back", async () => {
            await expect(provision({ manifest: prodManifest(), confirmProduction: CLINIC, ownerInvite: { type: "skip" } })).resolves.toMatchObject({ environment: "production", tenant: "created" });
        });
    });

    // ── Owner invitation lifecycle ───────────────────────────────────────────

    describe("owner invitation", () => {
        it("emails the link (never printing it) and stores only a hash", async () => {
            const sent: { to: string; subject: string; html: string }[] = [];
            const logs: string[] = [];
            const spies = (["log", "info", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation((...a) => void logs.push(a.join(" "))));
            try {
                const result = await provision({ ownerInvite: { type: "email" }, deps: { sendEmail: async (msg) => void sent.push(msg) } });
                expect(result).toMatchObject({ owner: "invite_issued", inviteDelivery: "email" });
                expect(sent).toHaveLength(1);
                expect(sent[0].to).toBe("owner@example-dental.test");
                const raw = sent[0].html.match(/token=([a-f0-9]{64})/)![1];
                expect((await prisma.staffInvite.findFirstOrThrow()).token).toBe(hashInviteToken(raw));
                expect(logs.join("\n")).not.toContain(raw);
            } finally {
                spies.forEach((s) => s.mockRestore());
            }
        });

        it("rolls the invitation back when delivery fails — nothing half-issued — and succeeds on re-run", async () => {
            await expect(
                provision({ ownerInvite: { type: "email" }, deps: { sendEmail: async () => { throw new Error("provider exploded: key=SENTINEL-PROVIDER-DETAIL"); } } })
            ).rejects.toMatchObject({ code: "INVITE_DELIVERY_FAILED" });

            expect(await prisma.staffInvite.count()).toBe(0); // no unusable invitation left behind
            expect(await prisma.tenant.count()).toBe(1); // the clinic itself was provisioned

            const retry = await provision({ ownerInvite: { type: "file", path: invitePath() } });
            expect(retry).toMatchObject({ tenant: "unchanged", owner: "invite_issued" });
        });

        it("does not leak the provider's error text", async () => {
            try {
                await provision({ ownerInvite: { type: "email" }, deps: { sendEmail: async () => { throw new Error("SENTINEL-PROVIDER-DETAIL"); } } });
                throw new Error("should have failed");
            } catch (error) {
                expect(error).toBeInstanceOf(ProvisionError);
                expect((error as Error).message).not.toContain("SENTINEL-PROVIDER-DETAIL");
            }
        });

        it("--reissue-invite replaces the link: one row, new hash, the old link stops working", async () => {
            const first = invitePath();
            await provision({ ownerInvite: { type: "file", path: first } });
            const rawOld = tokenFromFile(first);

            const second = invitePath();
            const result = await provision({ ownerInvite: { type: "file", path: second }, reissueInvite: true });
            const rawNew = tokenFromFile(second);

            expect(result.owner).toBe("invite_reissued");
            expect(rawNew).not.toBe(rawOld);
            expect(await prisma.staffInvite.count()).toBe(1);
            const resolves = async (raw: string) => (await prisma.staffInvite.findFirst({ where: { token: { in: inviteTokenLookupValues(raw) } } })) !== null;
            expect(await resolves(rawNew)).toBe(true);
            expect(await resolves(rawOld)).toBe(false);
        });

        it("reissues automatically once the pending invitation has expired", async () => {
            await provision();
            await prisma.staffInvite.updateMany({ data: { expiresAt: new Date(Date.now() - 60_000) } });
            const result = await provision({ ownerInvite: { type: "file", path: invitePath() } });
            expect(result.owner).toBe("invite_reissued");
            expect(await prisma.staffInvite.count()).toBe(1);
        });

        it("issues nothing when the clinic already has an owner", async () => {
            await provision({ ownerInvite: { type: "skip" } });
            await prisma.user.create({
                data: { email: "owner@example-dental.test", passwordHash: "x", firstName: "O", lastName: "W", tenantId: CLINIC, roles: { create: { systemRole: "CLINIC_OWNER" } } },
            });
            const result = await provision({ ownerInvite: { type: "file", path: invitePath() } });
            expect(result.owner).toBe("exists");
            expect(await prisma.staffInvite.count()).toBe(0);
        });

        it("refuses when the owner email already belongs to another account", async () => {
            await provision({ ownerInvite: { type: "skip" } });
            await prisma.user.create({ data: { email: "owner@example-dental.test", passwordHash: "x", firstName: "N", lastName: "R", tenantId: CLINIC, roles: { create: { systemRole: "RECEPTIONIST" } } } });
            await expect(provision({ ownerInvite: { type: "file", path: invitePath() } })).rejects.toMatchObject({ code: "OWNER_EMAIL_IN_USE" });
            expect(await prisma.staffInvite.count()).toBe(0);
        });

        it("--skip-owner-invite provisions the clinic and says so", async () => {
            const result = await provision({ ownerInvite: { type: "skip" } });
            expect(result.owner).toBe("invite_skipped");
            expect(await prisma.staffInvite.count()).toBe(0);
        });

        it("the invitation really works: the REAL accept endpoint turns it into a clinic owner, once", async () => {
            const file = invitePath();
            await provision({ ownerInvite: { type: "file", path: file } });
            const raw = tokenFromFile(file);

            // The route builds its own Prisma client from DATABASE_URL at import time.
            process.env.DATABASE_URL = URL_UNDER_TEST;
            const { POST: accept } = await import("@/app/api/staff/invite/[token]/accept/route");
            const { GET: validate } = await import("@/app/api/staff/invite/[token]/route");
            const { makeRequest, params } = await import("./helpers/auth");

            const seen = await validate(makeRequest(`/api/staff/invite/${raw}`), params({ token: raw }));
            expect(seen.status).toBe(200);
            expect((await seen.json()).data).toMatchObject({ email: "owner@example-dental.test", role: "CLINIC_OWNER", clinic: { id: CLINIC } });

            const res = await accept(
                makeRequest(`/api/staff/invite/${raw}/accept`, { method: "POST", body: { firstName: "Ama", lastName: "Owner", password: "Str0ng!Passw0rd" } }),
                params({ token: raw })
            );
            expect(res.status).toBe(200);
            expect(res.headers.get("set-cookie")).toContain("nexus_token=");

            const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner@example-dental.test" }, include: { roles: true } });
            expect(owner).toMatchObject({ tenantId: CLINIC, status: "ACTIVE" });
            expect(owner.roles.map((r) => r.systemRole)).toEqual(["CLINIC_OWNER"]);
            expect((await prisma.staffInvite.findFirstOrThrow()).acceptedAt).not.toBeNull();

            const again = await accept(
                makeRequest(`/api/staff/invite/${raw}/accept`, { method: "POST", body: { firstName: "X", lastName: "Y", password: "Str0ng!Passw0rd" } }),
                params({ token: raw })
            );
            expect(again.status).toBe(410); // single-use
            expect(await prisma.user.count({ where: { tenantId: CLINIC } })).toBe(1);
        });

        it("a stored hash cannot be presented as the token", async () => {
            const file = invitePath();
            await provision({ ownerInvite: { type: "file", path: file } });
            const stored = (await prisma.staffInvite.findFirstOrThrow()).token;

            process.env.DATABASE_URL = URL_UNDER_TEST;
            const { GET: validate } = await import("@/app/api/staff/invite/[token]/route");
            const { makeRequest, params } = await import("./helpers/auth");
            const res = await validate(makeRequest(`/api/staff/invite/${stored}`), params({ token: stored }));
            expect(res.status).toBe(404);
        });
    });

    // ── check-only ───────────────────────────────────────────────────────────

    it("--check validates a real database and writes nothing", async () => {
        const before = await snapshot();
        const result = await provision({ checkOnly: true });
        expect(result).toMatchObject({ mode: "check", tenant: "would_create", owner: "would_issue_invite" });
        expect(await snapshot()).toEqual(before);
        expect(before.tenants).toBe(0);
    });

    // ── The real CLI, end to end ─────────────────────────────────────────────

    describe("the real CLI against the real database", () => {
        const run = (args: string[], over: Record<string, string | undefined> = {}) => {
            const clean: Record<string, string> = { PATH: process.env.PATH ?? "" };
            for (const [k, v] of Object.entries(env(over))) if (v !== undefined) clean[k] = v;
            const r = spawnSync(path.join(ROOT, "node_modules/.bin/tsx"), [path.join(ROOT, "scripts/clinic-provision.ts"), "--manifest", EXAMPLE, ...args], { cwd: ROOT, env: clean as NodeJS.ProcessEnv, encoding: "utf8", timeout: 120_000 });
            return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
        };

        it("provisions, reports ids and next steps, and prints no secret or invitation link", async () => {
            const file = invitePath();
            const r = run(["--invite-out", file]);

            expect(r.code).toBe(0);
            expect(r.out).toMatch(/Provisioning complete/);
            expect(r.out).toContain(CLINIC);
            expect(r.out).toMatch(/owner\s+invite issued/);
            expect(r.out).toMatch(/Next steps/);

            const raw = tokenFromFile(file);
            expect(r.out).not.toContain(raw);
            expect(r.out).not.toContain("onboarding/accept");
            for (const secret of Object.values(SECRETS)) expect(r.out).not.toContain(secret);
            const dbPassword = new URL(URL_UNDER_TEST!).password;
            if (dbPassword) expect(r.out).not.toContain(dbPassword);
            expect(await prisma.tenant.count()).toBe(1);
        });

        it("is safe to run twice: the second run reports the existing state and changes nothing", async () => {
            expect(run(["--invite-out", invitePath()]).code).toBe(0);
            const before = await snapshot();
            const second = run(["--skip-owner-invite"]);
            expect(second.code).toBe(0);
            expect(second.out).toMatch(/invite pending/);
            expect(await snapshot()).toEqual(before);
        });

        it("--check on an empty database exits 0 and writes nothing", async () => {
            const r = run(["--check"]);
            expect(r.code).toBe(0);
            expect(r.out).toMatch(/nothing was changed/i);
            expect(await prisma.tenant.count()).toBe(0);
        });
    });
});
