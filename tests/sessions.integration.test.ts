/* eslint-disable @typescript-eslint/no-explicit-any -- route/db fixtures are intentionally loosely typed */
// Database-backed session tests: the REAL route handlers and the REAL session
// code against a REAL, freshly migrated PostgreSQL.
//
// Run through `npm run test:provision`, which creates a throwaway database,
// applies the committed migrations, sets DATABASE_URL to it, runs this file and
// drops the database. Without TEST_DATABASE_URL these tests are skipped.
//
// Never point TEST_DATABASE_URL at a real database: tests TRUNCATE tables.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import pg from "pg";

const URL_UNDER_TEST = process.env.TEST_DATABASE_URL;
if (URL_UNDER_TEST) {
    const u = new URL(URL_UNDER_TEST);
    const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
    const disposable = u.pathname.replace(/^\//, "").startsWith("nexus_c1_test_");
    if (!local || !disposable || process.env.DATABASE_URL !== URL_UNDER_TEST) {
        throw new Error("Refusing to run: TEST_DATABASE_URL must be a LOCAL nexus_c1_test_* database and equal DATABASE_URL.");
    }
}

const m = vi.hoisted(() => ({
    getdel: vi.fn(),
    verifyIdToken: vi.fn(),
    sendEmail: vi.fn(async () => {}),
}));
vi.mock("@/lib/db/redis", () => ({ default: { getdel: m.getdel, set: vi.fn() } }));
vi.mock("@/lib/firebase/server", () => ({ adminAuth: { verifyIdToken: m.verifyIdToken } }));
vi.mock("@/lib/security/rate-limit", () => ({
    consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 5, retryAfterSeconds: 0 })),
    resetRateLimit: vi.fn(async () => {}),
    clientIp: () => "203.0.113.9",
}));
vi.mock("@/lib/email/sender", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/email/sender")>()),
    sendEmail: m.sendEmail,
}));

import { NextRequest } from "next/server";
import { params } from "./helpers/auth";

const suite = URL_UNDER_TEST ? describe : describe.skip;
const T = "tenant-int";
const PASSWORD = "Correct-Horse-9!";

suite("sessions against a real, freshly migrated database", () => {
    let pool: pg.Pool;
    let prisma: any;
    let h: Record<string, any>;

    const rows = async (sql: string, args: unknown[] = []) => (await pool.query(sql, args)).rows;

    const call = (handler: any, path: string, o: { method?: string; token?: string; body?: unknown; ctx?: any; cookie?: string } = {}) => {
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (o.token) headers.authorization = `Bearer ${o.token}`;
        if (o.cookie) headers.cookie = o.cookie;
        const req = new NextRequest(`http://localhost${path}`, {
            method: o.method ?? "GET",
            headers,
            body: o.body === undefined ? undefined : JSON.stringify(o.body),
        });
        return o.ctx ? handler(req, o.ctx) : handler(req);
    };
    const tokenFrom = (res: Response, name = "nexus_token") => new RegExp(`${name}=([^;]+)`).exec(res.headers.get("set-cookie") ?? "")?.[1] ?? "";

    async function seedUser(id: string, role: string, over: Record<string, unknown> = {}) {
        return prisma.user.create({
            data: {
                id,
                email: `${id}@example.test`,
                passwordHash: await bcrypt.hash(PASSWORD, 4),
                firstName: id,
                lastName: "Test",
                tenantId: T,
                roles: { create: { systemRole: role } },
                ...over,
            },
        });
    }
    async function signIn(id: string) {
        const res = await call(h.login, "/api/auth/login", { method: "POST", body: { email: `${id}@example.test`, password: PASSWORD } });
        expect(res.status).toBe(200);
        return tokenFrom(res);
    }
    const me = (token: string) => call(h.me, "/api/auth/me", { token });
    const sessionCount = async (where = "true") => (await rows(`select count(*)::int c from auth_sessions where ${where}`))[0].c as number;

    beforeAll(async () => {
        globalThis.__NEXUS_REAL_SESSIONS__ = true; // use the genuine session check, not the claims-trusting stand-in
        process.env.CLINIC_ID = T;
        pool = new pg.Pool({ connectionString: URL_UNDER_TEST });
        prisma = (await import("@/lib/db/prisma")).default;
        h = {
            login: (await import("@/app/api/auth/login/route")).POST,
            logout: (await import("@/app/api/auth/logout/route")).POST,
            logoutAll: (await import("@/app/api/auth/logout-all/route")).POST,
            me: (await import("@/app/api/auth/me/route")).GET,
            changePassword: (await import("@/app/api/auth/change-password/route")).POST,
            resetPassword: (await import("@/app/api/auth/reset-password/route")).POST,
            patchStaff: (await import("@/app/api/staff/[id]/route")).PATCH,
            otpVerify: (await import("@/app/api/auth/patient/otp/verify/route")).POST,
            invite: (await import("@/app/api/staff/invite/route")).POST,
            acceptInvite: (await import("@/app/api/staff/invite/[token]/accept/route")).POST,
            listStaff: (await import("@/app/api/staff/route")).GET,
        };
    });
    afterAll(async () => {
        await pool?.end();
        await prisma?.$disconnect?.();
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        await pool.query(`DROP TRIGGER IF EXISTS nexus_block_revoke ON auth_sessions`);
        await pool.query(`TRUNCATE tenants, users, patients, staff_invites, audit_logs CASCADE`);
        await prisma.tenant.create({ data: { id: T, name: "Integration Clinic", slug: "integration-clinic" } });
        await seedUser("owner", "CLINIC_OWNER");
        await seedUser("doc", "DOCTOR");
        await prisma.patient.create({ data: { id: "pat", tenantId: T, phone: "+233200000001", firstName: "Pat", lastName: "Ient" } });
    });

    // ───────────────────────── schema ─────────────────────────
    describe("migration", () => {
        it("creates auth_sessions and the subject CHECK rejects malformed rows", async () => {
            expect(await rows(`select to_regclass('public.auth_sessions') as t`)).toEqual([{ t: "auth_sessions" }]);
            const insert = (cols: string, vals: string) =>
                pool.query(`insert into auth_sessions (id,"sidHash","subjectType",${cols},"idleExpiresAt","absoluteExpiresAt") values ('x'||random(), 'h'||random(), ${vals}, now(), now())`);
            await expect(insert(`"userId","patientId"`, `'STAFF','doc','pat'`)).rejects.toMatchObject({ code: "23514" }); // both
            await expect(insert(`"tenantId"`, `'STAFF','${T}'`)).rejects.toMatchObject({ code: "23514" }); // neither
            await expect(insert(`"userId"`, `'PATIENT','doc'`)).rejects.toMatchObject({ code: "23514" }); // type/subject mismatch
            await expect(insert(`"userId"`, `'STAFF','doc'`)).resolves.toBeDefined(); // the valid shapes
            await expect(insert(`"patientId"`, `'PATIENT','pat'`)).resolves.toBeDefined();
        });

        it("sidHash is unique", async () => {
            const ins = () => pool.query(`insert into auth_sessions (id,"sidHash","subjectType","userId","idleExpiresAt","absoluteExpiresAt") values (md5(random()::text),'dup','STAFF','doc',now(),now())`);
            await ins();
            await expect(ins()).rejects.toMatchObject({ code: "23505" });
        });
    });

    // ───────────────────────── staff ─────────────────────────
    describe("staff sessions", () => {
        it("login creates a session row; only a hash is stored, never the session id or token", async () => {
            const token = await signIn("doc");
            expect(await sessionCount(`"userId"='doc' and "revokedAt" is null`)).toBe(1);
            const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
            expect(claims.sid).toBeTruthy();
            const dump = JSON.stringify(await rows(`select * from auth_sessions`)) + JSON.stringify(await rows(`select * from audit_logs`));
            expect(dump).not.toContain(claims.sid);
            expect(dump).not.toContain(token);
            expect(dump).toContain("AUTH_LOGIN_SUCCESS");
            expect((await me(token)).status).toBe(200);
        });

        it("rejects a validly-signed legacy token that has no session", async () => {
            const { signToken } = await import("@/lib/auth/jwt");
            const legacy = signToken({ userId: "owner", tenantId: T, role: "CLINIC_OWNER", roles: ["CLINIC_OWNER"], permissions: ["*"], featureFlags: [], type: "STAFF" });
            expect((await me(legacy)).status).toBe(401);
        });

        it("an already signed-in suspended account is rejected on its NEXT request, and sessions are marked revoked", async () => {
            const ownerToken = await signIn("owner");
            const docToken = await signIn("doc");
            expect((await me(docToken)).status).toBe(200);

            const res = await call(h.patchStaff, "/api/staff/doc", { method: "PATCH", token: ownerToken, body: { status: "SUSPENDED" }, ctx: params({ id: "doc" }) });
            expect(res.status).toBe(200);

            expect((await me(docToken)).status).toBe(401);
            expect((await me(ownerToken)).status).toBe(200); // the actor is unaffected
            expect(await rows(`select "revokedReason" from auth_sessions where "userId"='doc'`)).toEqual([{ revokedReason: "ACCOUNT_SUSPENDED" }]);
            // audit trail, without any token
            const audit = await rows(`select action, "newValue" from audit_logs where action='STAFF_ACCESS_CHANGED'`);
            expect(audit).toHaveLength(1);
            expect(JSON.stringify(audit)).not.toMatch(/eyJ/);
        });

        it("even WITHOUT revocation a suspended account is refused (status re-checked on every request)", async () => {
            const docToken = await signIn("doc");
            await pool.query(`update users set status='SUSPENDED' where id='doc'`);
            expect((await me(docToken)).status).toBe(401);
        });

        it("a frozen clinic locks out its signed-in staff immediately", async () => {
            const docToken = await signIn("doc");
            await pool.query(`update tenants set status='FROZEN' where id=$1`, [T]);
            expect((await me(docToken)).status).toBe(401);
        });

        it("a role removal takes effect on the next request without waiting for the token to expire", async () => {
            const ownerToken = await signIn("owner");
            const docToken = await signIn("doc");
            const before = (await (await me(docToken)).json()).data;
            expect(before.roles).toEqual(["DOCTOR"]);

            // The old session is revoked by a role change, so sign in again as the new role.
            await call(h.patchStaff, "/api/staff/doc", { method: "PATCH", token: ownerToken, body: { role: "RECEPTIONIST" }, ctx: params({ id: "doc" }) });
            expect((await me(docToken)).status).toBe(401);
            const fresh = (await (await me(await signIn("doc"))).json()).data;
            expect(fresh.roles).toEqual(["RECEPTIONIST"]);
            expect(fresh.access.roles).toEqual(["RECEPTIONIST"]);
            expect(fresh.access.permissions).not.toEqual(before.access.permissions);
        });

        it("a role changed directly in the database (no revoke) is still honoured immediately", async () => {
            const docToken = await signIn("doc");
            await pool.query(`update user_roles_mapping set "systemRole"='RECEPTIONIST' where "userId"='doc'`);
            const data = (await (await me(docToken)).json()).data;
            expect(data.roles).toEqual(["RECEPTIONIST"]);
            expect(data.access.permissions).not.toContain("patients:delete");
        });

        it("logout revokes only that session", async () => {
            const a = await signIn("doc");
            const b = await signIn("doc");
            const res = await call(h.logout, "/api/auth/logout", { method: "POST", token: a });
            expect(res.status).toBe(200);
            expect((await me(a)).status).toBe(401);
            expect((await me(b)).status).toBe(200);
            expect(await rows(`select "revokedReason" r from auth_sessions where "revokedAt" is not null`)).toEqual([{ r: "LOGOUT" }]);
            expect(await rows(`select 1 from audit_logs where action='SESSION_LOGOUT'`)).toHaveLength(1);
        });

        it("sign-out-all revokes every session of that identity and none of anyone else's", async () => {
            const a = await signIn("doc");
            const b = await signIn("doc");
            const o = await signIn("owner");
            const res = await call(h.logoutAll, "/api/auth/logout-all", { method: "POST", token: a });
            expect(res.status).toBe(200);
            expect((await res.json()).data.sessionsRevoked).toBe(2);
            expect((await me(a)).status).toBe(401);
            expect((await me(b)).status).toBe(401);
            expect((await me(o)).status).toBe(200);
        });

        it("password change invalidates every earlier session, but the caller's device continues on a fresh one", async () => {
            const a = await signIn("doc");
            const b = await signIn("doc");
            const res = await call(h.changePassword, "/api/auth/change-password", {
                method: "POST", token: a, body: { currentPassword: PASSWORD, newPassword: "Another-Passw0rd!2" },
            });
            expect(res.status).toBe(200);
            expect((await me(a)).status).toBe(401);
            expect((await me(b)).status).toBe(401);
            const fresh = tokenFrom(res);
            expect(fresh).not.toBe("");
            expect((await me(fresh)).status).toBe(200);
            expect(await rows(`select count(*)::int c from auth_sessions where "revokedReason"='PASSWORD_CHANGED'`)).toEqual([{ c: 2 }]);
        });

        it("password reset invalidates every earlier session", async () => {
            const a = await signIn("doc");
            const b = await signIn("doc");
            m.getdel.mockResolvedValue("doc");
            const res = await call(h.resetPassword, "/api/auth/reset-password", { method: "POST", body: { token: "b".repeat(64), password: "Reset-Passw0rd!3" } });
            expect(res.status).toBe(200);
            expect((await me(a)).status).toBe(401);
            expect((await me(b)).status).toBe(401);
            expect(await rows(`select count(*)::int c from auth_sessions where "revokedReason"='PASSWORD_RESET'`)).toEqual([{ c: 2 }]);
        });

        it("FAILS CLOSED: when revocation cannot be written, the password reset does not happen", async () => {
            const a = await signIn("doc");
            const before = (await rows(`select "passwordHash" h from users where id='doc'`))[0].h;
            await pool.query(`
                CREATE OR REPLACE FUNCTION nexus_block_revoke() RETURNS trigger AS $$
                BEGIN IF NEW."revokedAt" IS NOT NULL AND OLD."revokedAt" IS NULL THEN RAISE EXCEPTION 'revocation blocked for test'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql;
                CREATE TRIGGER nexus_block_revoke BEFORE UPDATE ON auth_sessions FOR EACH ROW EXECUTE FUNCTION nexus_block_revoke();`);
            vi.spyOn(console, "error").mockImplementation(() => {});
            m.getdel.mockResolvedValue("doc");
            const res = await call(h.resetPassword, "/api/auth/reset-password", { method: "POST", body: { token: "c".repeat(64), password: "Reset-Passw0rd!3" } });
            expect(res.status).toBe(500);
            expect((await rows(`select "passwordHash" h from users where id='doc'`))[0].h).toBe(before); // rolled back
            expect((await me(a)).status).toBe(200); // and the old session is, honestly, still valid
        });

        it("FAILS CLOSED: when revocation cannot be written, a suspension is not applied (and says so)", async () => {
            const ownerToken = await signIn("owner");
            await signIn("doc");
            await pool.query(`
                CREATE OR REPLACE FUNCTION nexus_block_revoke() RETURNS trigger AS $$
                BEGIN IF NEW."revokedAt" IS NOT NULL AND OLD."revokedAt" IS NULL THEN RAISE EXCEPTION 'revocation blocked for test'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql;
                CREATE TRIGGER nexus_block_revoke BEFORE UPDATE ON auth_sessions FOR EACH ROW EXECUTE FUNCTION nexus_block_revoke();`);
            vi.spyOn(console, "error").mockImplementation(() => {});
            const res = await call(h.patchStaff, "/api/staff/doc", { method: "PATCH", token: ownerToken, body: { status: "SUSPENDED" }, ctx: params({ id: "doc" }) });
            expect(res.status).toBe(500);
            expect((await rows(`select status from users where id='doc'`))[0].status).toBe("ACTIVE");
        });

        it("fails closed with 503 when the session store cannot be read", async () => {
            const a = await signIn("doc");
            await pool.query(`ALTER TABLE auth_sessions RENAME TO auth_sessions_gone`);
            try {
                vi.spyOn(console, "error").mockImplementation(() => {});
                expect((await me(a)).status).toBe(503);
            } finally {
                await pool.query(`ALTER TABLE auth_sessions_gone RENAME TO auth_sessions`);
            }
        });
    });

    // ───────────────────────── patient ─────────────────────────
    describe("patient sessions", () => {
        const otp = async () => {
            m.verifyIdToken.mockResolvedValue({ phone_number: "+233200000001" });
            const res = await call(h.otpVerify, "/api/auth/patient/otp/verify", { method: "POST", body: { phone: "+233200000001", otp: "123456", token: "firebase-token" } });
            expect(res.status).toBe(200);
            return tokenFrom(res, "nexus_patient_token");
        };

        it("sign-in creates a patient session and /me returns the contract with no permissions", async () => {
            const token = await otp();
            expect(await sessionCount(`"patientId"='pat' and "subjectType"='PATIENT'`)).toBe(1);
            const { data } = await (await me(token)).json();
            expect(data.access).toMatchObject({ subject: "PATIENT", role: "PATIENT", permissions: [] });
        });

        it("stays signed in through ordinary use: activity rolls the idle window forward", async () => {
            const token = await otp();
            await pool.query(`update auth_sessions set "lastSeenAt"=now()-interval '2 minutes', "idleExpiresAt"=now()+interval '1 hour' where "patientId"='pat'`);
            const res = await me(token);
            expect(res.status).toBe(200);
            const [row] = await rows(`select "idleExpiresAt" i, "absoluteExpiresAt" a from auth_sessions where "patientId"='pat'`);
            const days = (row.i.getTime() - Date.now()) / 86400000;
            expect(days).toBeGreaterThan(29);
            expect(row.i.getTime()).toBeLessThanOrEqual(row.a.getTime());
            expect(res.headers.get("set-cookie")).toMatch(/nexus_patient_token=/); // cookie renewed too
        });

        it("is rejected after the idle window passes with no activity", async () => {
            const token = await otp();
            await pool.query(`update auth_sessions set "idleExpiresAt"=now()-interval '1 second' where "patientId"='pat'`);
            expect((await me(token)).status).toBe(401);
        });

        it("is rejected once the absolute maximum passes — however recently it was used", async () => {
            const token = await otp();
            await pool.query(`update auth_sessions set "absoluteExpiresAt"=now()-interval '1 second', "idleExpiresAt"=now()+interval '10 days' where "patientId"='pat'`);
            expect((await me(token)).status).toBe(401);
        });

        it("rolling renewal never extends the idle expiry past the absolute maximum", async () => {
            const token = await otp();
            await pool.query(`update auth_sessions set "absoluteExpiresAt"=now()+interval '3 days', "lastSeenAt"=now()-interval '2 minutes' where "patientId"='pat'`);
            expect((await me(token)).status).toBe(200);
            const [r] = await rows(`select "idleExpiresAt" i, "absoluteExpiresAt" a from auth_sessions where "patientId"='pat'`);
            expect(r.i.getTime()).toBeLessThanOrEqual(r.a.getTime());
        });

        it("logout and sign-out-all revoke patient sessions", async () => {
            const a = await otp();
            const b = await otp();
            await call(h.logout, "/api/auth/logout", { method: "POST", cookie: `nexus_patient_token=${a}` });
            expect((await me(a)).status).toBe(401);
            expect((await me(b)).status).toBe(200);
            await call(h.logoutAll, "/api/auth/logout-all", { method: "POST", token: b });
            expect((await me(b)).status).toBe(401);
        });

        it("a soft-deleted patient is refused immediately", async () => {
            const token = await otp();
            await pool.query(`update patients set "deletedAt"=now() where id='pat'`);
            expect((await me(token)).status).toBe(401);
        });
    });

    // ───────────────────────── invitations ─────────────────────────
    describe("invitations", () => {
        const sentLink = () => {
            const html = (m.sendEmail.mock.calls.at(-1) as any[])[0].html as string;
            return html.match(/token=([a-f0-9]{64})/)![1];
        };

        it("POST /api/staff/invite stores only a hash; the emailed token works exactly once", async () => {
            const ownerToken = await signIn("owner");
            const res = await call(h.invite, "/api/staff/invite", { method: "POST", token: ownerToken, body: { email: "new.nurse@example.test", role: "NURSE" } });
            expect(res.status).toBe(200);
            const raw = sentLink();
            const [row] = await rows(`select token from staff_invites where email='new.nurse@example.test'`);
            expect(row.token).toMatch(/^sha256:[a-f0-9]{64}$/);
            expect(JSON.stringify(await rows(`select * from staff_invites`))).not.toContain(raw);
            expect(JSON.stringify(await rows(`select * from audit_logs`))).not.toContain(raw);

            const accept = () => call(h.acceptInvite, `/api/staff/invite/${raw}/accept`, {
                method: "POST", body: { firstName: "New", lastName: "Nurse", password: "Fresh-Passw0rd!4" }, ctx: params({ token: raw }),
            });
            const first = await accept();
            expect(first.status).toBe(200);
            const token = tokenFrom(first);
            expect((await me(token)).status).toBe(200); // accepted invite signs in WITH a real session
            expect((await accept()).status).toBeGreaterThanOrEqual(400); // single use
            // presenting the stored hash as if it were the token must not work
            expect((await call(h.acceptInvite, `/api/staff/invite/x/accept`, {
                method: "POST", body: { firstName: "A", lastName: "B", password: "Fresh-Passw0rd!4" }, ctx: params({ token: row.token }),
            })).status).toBeGreaterThanOrEqual(400);
        });

        it("DOCUMENTED COMPATIBILITY: an unexpired legacy plaintext invitation still works, once", async () => {
            await pool.query(
                `insert into staff_invites (id,"tenantId",email,role,token,"invitedById","expiresAt") values ('legacy1',$1,'legacy@example.test','NURSE','legacy-plaintext-token','owner', now()+interval '1 day')`,
                [T]
            );
            const accept = () => call(h.acceptInvite, `/api/staff/invite/legacy-plaintext-token/accept`, {
                method: "POST", body: { firstName: "Old", lastName: "Invite", password: "Fresh-Passw0rd!4" }, ctx: params({ token: "legacy-plaintext-token" }),
            });
            expect((await accept()).status).toBe(200);
            expect((await accept()).status).toBeGreaterThanOrEqual(400);
        });
    });

    // ───────────────────────── contract ─────────────────────────
    describe("effective-access contract from real settings", () => {
        it("reads the clinic's legacy flags and reports modules separately from providers", async () => {
            await prisma.tenantSettings.create({ data: { tenantId: T, featureFlags: { enablePharmacy: false, enableTelehealth: true } } });
            const { data } = await (await me(await signIn("doc"))).json();
            expect(data.access.version).toBe(1);
            expect(data.access.modules.pharmacy).toEqual({ enabled: false, reason: "DISABLED_BY_CLINIC" });
            expect(data.access.modules.patientPortal).toEqual({ enabled: true });
            expect(Object.keys(data.access.providers).sort()).toEqual(["hubtel", "mnotify", "paystack", "resend"]);
            expect(JSON.stringify(data.access)).not.toMatch(/sk_|secret|apikey/i);
        });
    });
});
