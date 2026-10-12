/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures and database stand-ins are intentionally loosely typed */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// A database stand-in with REAL transaction semantics: writes made inside
// $transaction are buffered and only "committed" if the callback resolves. That
// lets these tests prove "revocation failed => the triggering change did not happen".
const m = vi.hoisted(() => {
    const committed: string[] = [];
    const fn = () => vi.fn();
    const base: any = {
        user: { findUnique: fn(), update: fn() },
        userRoleMapping: { deleteMany: fn(), create: fn() },
        authSession: { create: fn(), updateMany: vi.fn(async () => ({ count: 2 })) },
        staffInvite: { findUnique: fn(), create: fn(), update: fn(), findMany: fn(), delete: fn() },
        tenant: { findUnique: fn() },
        patient: { findUnique: fn() },
    };
    const WRITES = ["user.update", "userRoleMapping.deleteMany", "userRoleMapping.create", "authSession.create", "authSession.updateMany"];
    const tx = (log: string[]) =>
        new Proxy(base, {
            get(target, model: string) {
                if (!(model in target) || typeof target[model] !== "object") return target[model];
                return new Proxy(target[model], {
                    get(t, op: string) {
                        const f = t[op];
                        if (typeof f !== "function") return f;
                        return (...a: unknown[]) => {
                            if (WRITES.includes(`${model}.${op}`)) log.push(`${model}.${op}`);
                            return f(...a);
                        };
                    },
                });
            },
        });
    base.$transaction = vi.fn(async (cb: any) => {
        const log: string[] = [];
        const result = await cb(tx(log));
        committed.push(...log);
        return result;
    });
    return {
        db: base,
        committed,
        redis: { getdel: fn(), set: fn() },
        sendEmail: vi.fn(async () => {}),
        audit: vi.fn(async () => {}),
    };
});
const { db, committed } = m;

vi.mock("@/lib/db/prisma", () => ({ default: m.db, prisma: m.db }));
vi.mock("@/lib/db/redis", () => ({ default: m.redis }));
vi.mock("@/lib/audit/logger", () => ({ logAudit: m.audit, getClientIP: () => "127.0.0.1", getUserAgent: () => "vitest" }));
vi.mock("@/lib/security/rate-limit", () => ({
    consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 5, retryAfterSeconds: 0 })),
    resetRateLimit: vi.fn(async () => {}),
    clientIp: () => "203.0.113.9",
}));
vi.mock("@/lib/email/sender", () => ({ sendEmail: m.sendEmail, staffInviteEmailHtml: (o: any) => `LINK:${o.acceptUrl}` }));

import { staffToken, patientToken, makeRequest, params } from "./helpers/auth";
import { POST as changePassword } from "@/app/api/auth/change-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { PATCH as patchStaff } from "@/app/api/staff/[id]/route";
import { POST as logoutAll } from "@/app/api/auth/logout-all/route";
import { POST as invite, GET as listInvites } from "@/app/api/staff/invite/route";
import { verifyToken } from "@/lib/auth/jwt";
import { hashSid } from "@/lib/auth/session";

const A = "tenant-a";
let CURRENT_HASH = "";
beforeEach(async () => {
    vi.clearAllMocks();
    committed.length = 0;
    db.authSession.updateMany.mockImplementation(async () => ({ count: 2 }));
    CURRENT_HASH = await bcrypt.hash("Old-Passw0rd!x", 4);
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const revokeCall = () => db.authSession.updateMany.mock.calls.map((c: any) => c[0]).find((a: any) => a.data?.revokedAt);

describe("password change", () => {
    const run = (body: object) =>
        changePassword(makeRequest("/api/auth/change-password", { method: "POST", token: staffToken({ userId: "u1", tenantId: A, roles: ["DOCTOR"] }), body }));
    beforeEach(() => db.user.findUnique.mockResolvedValue({ id: "u1", tenantId: A, passwordHash: CURRENT_HASH, status: "ACTIVE" }));

    it("revokes every earlier session and signs this device in with a fresh one", async () => {
        const res = await run({ currentPassword: "Old-Passw0rd!x", newPassword: "New-Passw0rd!y1" });
        expect(res.status).toBe(200);
        expect(revokeCall()).toMatchObject({ where: { userId: "u1", revokedAt: null }, data: { revokedReason: "PASSWORD_CHANGED" } });
        expect(revokeCall().where).not.toHaveProperty("NOT"); // nothing spared: the caller gets a NEW session instead
        expect(db.authSession.create).toHaveBeenCalledTimes(1);
        const cookie = res.headers.get("set-cookie")!;
        const newToken = cookie.match(/nexus_token=([^;]+)/)![1];
        const claims = verifyToken(newToken) as any;
        expect(hashSid(claims.sid)).toBe(db.authSession.create.mock.calls[0][0].data.sidHash);
        expect(committed).toEqual(expect.arrayContaining(["user.update", "authSession.updateMany", "authSession.create"]));
    });

    it("FAILS CLOSED: if revocation fails the password is not changed", async () => {
        db.authSession.updateMany.mockRejectedValue(new Error("db down"));
        const res = await run({ currentPassword: "Old-Passw0rd!x", newPassword: "New-Passw0rd!y1" });
        expect(res.status).toBe(500);
        expect(committed).toEqual([]);
        expect(res.headers.get("set-cookie")).toBeNull();
    });
});

describe("password reset", () => {
    const token = "a".repeat(64);
    const run = () => resetPassword(makeRequest("/api/auth/reset-password", { method: "POST", body: { token, password: "New-Passw0rd!y1" } }));
    beforeEach(() => {
        m.redis.getdel.mockResolvedValue("u1");
        db.user.findUnique.mockResolvedValue({ id: "u1", tenantId: A, status: "ACTIVE", deletedAt: null });
    });

    it("revokes every earlier session in the same transaction as the new password", async () => {
        expect((await run()).status).toBe(200);
        expect(revokeCall()).toMatchObject({ where: { userId: "u1", revokedAt: null }, data: { revokedReason: "PASSWORD_RESET" } });
        expect(committed).toEqual(expect.arrayContaining(["user.update", "authSession.updateMany"]));
        expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "AUTH_PASSWORD_RESET", newValue: { sessionsRevoked: 2 } }));
    });

    it("FAILS CLOSED: if revocation fails the password is not reset", async () => {
        db.authSession.updateMany.mockRejectedValue(new Error("db down"));
        expect((await run()).status).toBe(500);
        expect(committed).toEqual([]);
    });
});

describe("staff suspension and role change", () => {
    const owner = () => staffToken({ userId: "owner-1", tenantId: A, roles: ["CLINIC_OWNER"] });
    const target = () => ({ id: "doc-1", tenantId: A, status: "ACTIVE", deletedAt: null, roles: [{ id: "r", systemRole: "DOCTOR" }] });
    const patch = (body: object) => patchStaff(makeRequest("/api/staff/doc-1", { method: "PATCH", token: owner(), body }), params({ id: "doc-1" }));
    beforeEach(() => db.user.findUnique.mockResolvedValue(target()));

    it("suspension revokes the target's sessions", async () => {
        expect((await patch({ status: "SUSPENDED" })).status).toBe(200);
        expect(revokeCall()).toMatchObject({ where: { userId: "doc-1" }, data: { revokedReason: "ACCOUNT_SUSPENDED" } });
        expect(committed).toEqual(expect.arrayContaining(["user.update", "authSession.updateMany"]));
    });

    it("re-activation does NOT revoke anything", async () => {
        expect((await patch({ status: "ACTIVE" })).status).toBe(200);
        expect(revokeCall()).toBeUndefined();
    });

    it("a role change revokes the target's sessions", async () => {
        expect((await patch({ role: "NURSE" })).status).toBe(200);
        expect(revokeCall()).toMatchObject({ where: { userId: "doc-1" }, data: { revokedReason: "ROLE_CHANGED" } });
    });

    it("FAILS CLOSED: if revocation fails the suspension is not applied", async () => {
        db.authSession.updateMany.mockRejectedValue(new Error("db down"));
        expect((await patch({ status: "SUSPENDED" })).status).toBe(500);
        expect(committed).toEqual([]);
    });

    it("audits the change with the number of sessions revoked and never a token", async () => {
        await patch({ status: "SUSPENDED" });
        const call = (m.audit.mock.calls as unknown as Array<[any]>).find((c) => c[0].action === "STAFF_ACCESS_CHANGED")![0];
        expect(call.newValue).toMatchObject({ status: "SUSPENDED", sessionsRevoked: 2 });
        expect(JSON.stringify(call)).not.toMatch(/sid|token|password/i);
    });
});

describe("sign out of all devices", () => {
    it("staff: revokes every session of the caller and clears cookies", async () => {
        const res = await logoutAll(makeRequest("/api/auth/logout-all", { method: "POST", token: staffToken({ userId: "u1", tenantId: A, roles: ["DOCTOR"] }) }));
        expect(res.status).toBe(200);
        expect(revokeCall()).toMatchObject({ where: { userId: "u1", revokedAt: null }, data: { revokedReason: "SIGN_OUT_ALL" } });
        expect(res.headers.get("set-cookie")).toMatch(/nexus_token=;/);
        expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "SESSION_SIGN_OUT_ALL" }));
    });

    it("patient: revokes every session of that patient only", async () => {
        const res = await logoutAll(makeRequest("/api/auth/logout-all", { method: "POST", token: patientToken({ patientId: "p9", tenantId: A }) }));
        expect(res.status).toBe(200);
        expect(revokeCall()).toMatchObject({ where: { patientId: "p9", revokedAt: null }, data: { revokedReason: "SIGN_OUT_ALL" } });
    });

    it("requires authentication", async () => {
        expect((await logoutAll(makeRequest("/api/auth/logout-all", { method: "POST" }))).status).toBe(401);
    });

    it("does not report success when revocation fails", async () => {
        db.authSession.updateMany.mockRejectedValue(new Error("db down"));
        const res = await logoutAll(makeRequest("/api/auth/logout-all", { method: "POST", token: staffToken({ userId: "u1", tenantId: A, roles: ["DOCTOR"] }) }));
        expect(res.status).toBe(500);
    });
});

describe("POST /api/staff/invite stores only a hash", () => {
    const admin = () => staffToken({ userId: "admin-1", tenantId: A, roles: ["ADMIN"] });
    beforeEach(() => {
        db.user.findUnique.mockImplementation(async ({ where }: any) => (where.email ? null : { firstName: "A", lastName: "B" }));
        db.staffInvite.findUnique.mockResolvedValue(null);
        db.staffInvite.create.mockImplementation(async ({ data }: any) => ({ id: "inv-1", ...data }));
        db.tenant.findUnique.mockResolvedValue({ name: "Clinic" });
    });

    it("writes sha256:<hash> to the database and puts the raw token only in the emailed link", async () => {
        const res = await invite(makeRequest("/api/staff/invite", { method: "POST", token: admin(), body: { email: "new@example.test", role: "NURSE" } }));
        expect(res.status).toBe(200);
        const stored = db.staffInvite.create.mock.calls[0][0].data.token as string;
        const html = (m.sendEmail.mock.calls as unknown as Array<[{ html: string }]>)[0][0].html;
        const raw = html.match(/token=([a-f0-9]{64})/)![1];
        expect(stored).toBe("sha256:" + crypto.createHash("sha256").update(raw).digest("hex"));
        expect(JSON.stringify(db.staffInvite.create.mock.calls)).not.toContain(raw);
        expect(JSON.stringify(m.audit.mock.calls)).not.toContain(raw);
        expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "STAFF_INVITE_CREATED" }));
        expect(JSON.stringify(await res.json())).not.toContain(raw);
    });

    it("re-sending replaces a legacy plaintext token with a hash (no new plaintext is ever written)", async () => {
        db.staffInvite.findUnique.mockResolvedValue({ id: "inv-old", acceptedAt: null, token: "11111111-legacy-plaintext" });
        db.staffInvite.update.mockImplementation(async ({ data }: any) => ({ id: "inv-old", ...data }));
        await invite(makeRequest("/api/staff/invite", { method: "POST", token: admin(), body: { email: "new@example.test", role: "NURSE" } }));
        expect(db.staffInvite.update.mock.calls[0][0].data.token).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it("the pending-invite list never returns the token column", async () => {
        db.staffInvite.findMany.mockResolvedValue([]);
        await listInvites(makeRequest("/api/staff/invite", { token: admin() }));
        const arg = db.staffInvite.findMany.mock.calls[0][0];
        expect(arg.select).toBeDefined();
        expect(arg.select.token).toBeUndefined();
    });
});
