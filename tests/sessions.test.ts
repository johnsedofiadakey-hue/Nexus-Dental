/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures and database stand-ins are intentionally loosely typed */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { store, auditLog } = vi.hoisted(() => ({ store: { db: null as any, state: null as any }, auditLog: vi.fn(async () => {}) }));
vi.mock("@/lib/db/prisma", () => ({
    get default() {
        return store.db;
    },
    get prisma() {
        return store.db;
    },
}));
vi.mock("@/lib/audit/logger", () => ({ logAudit: auditLog, getClientIP: () => "127.0.0.1", getUserAgent: () => "vitest" }));

import { makeFakeStore, activeUser, activePatient, activeTenant, sha } from "./helpers/sessions";
import { makeRequest } from "./helpers/auth";
import { signToken, signPatientToken } from "@/lib/auth/jwt";
import {
    createStaffSession,
    createPatientSession,
    resolveSession,
    revokeUserSessions,
    revokeSessionBySid,
} from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/middleware";
import { resolveUserPermissions } from "@/lib/auth/permissions";
import { SESSION_POLICY } from "@/lib/auth/types";
import { POST as logout } from "@/app/api/auth/logout/route";

const T0 = new Date("2026-10-05T10:00:00Z");
const plus = (s: number, from = T0) => new Date(from.getTime() + s * 1000);

beforeEach(() => {
    globalThis.__NEXUS_REAL_SESSIONS__ = true;
    const f = makeFakeStore();
    store.db = f.db;
    store.state = f.state;
    f.state.tenants["tenant-a"] = activeTenant();
    f.state.users.u1 = activeUser();
    f.state.patients.p1 = activePatient();
    auditLog.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    globalThis.__NEXUS_REAL_SESSIONS__ = false;
    vi.restoreAllMocks();
});

const staffClaims = (sid: string, over: object = {}) => ({ type: "STAFF" as const, userId: "u1", sid, ...over });
const patientClaims = (sid: string) => ({ type: "PATIENT" as const, patientId: "p1", sid });

describe("no raw tokens at rest", () => {
    it("stores only the SHA-256 of the session id", async () => {
        const s = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" }, T0);
        const row = store.state.sessions[0];
        expect(row.sidHash).toBe(sha(s.sid));
        expect(JSON.stringify(store.state.sessions)).not.toContain(s.sid);
        expect(s.sid.length).toBeGreaterThanOrEqual(43); // 256 bits, base64url
    });

    it("never repeats a session id", async () => {
        const ids = new Set<string>();
        for (let i = 0; i < 50; i++) ids.add((await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" })).sid);
        expect(ids.size).toBe(50);
    });
});

describe("resolveSession — staff", () => {
    it("accepts a live session and returns CURRENT roles and permissions from the database", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" }, T0);
        const r = await resolveSession(staffClaims(sid), plus(10));
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.user).toMatchObject({ userId: "u1", tenantId: "tenant-a", role: "DOCTOR", roles: ["DOCTOR"], type: "STAFF" });
            expect((r.user as any).permissions.length).toBeGreaterThan(0);
        }
    });

    it("ignores stale claims: a role removed in the database is gone on the next request", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" }, T0);
        const before = await resolveSession(staffClaims(sid, { role: "DOCTOR", roles: ["DOCTOR"] }), plus(5));
        store.state.users.u1.roles = [{ systemRole: "RECEPTIONIST" }];
        const after = await resolveSession(staffClaims(sid, { role: "DOCTOR", roles: ["DOCTOR"], permissions: ["everything"] }), plus(6));
        expect(before.ok && after.ok).toBe(true);
        if (before.ok && after.ok) {
            expect((after.user as any).roles).toEqual(["RECEPTIONIST"]);
            expect((after.user as any).permissions).not.toContain("everything");
            expect((after.user as any).permissions).not.toEqual((before.user as any).permissions);
        }
    });

    it("rejects a legacy token that has no session id", async () => {
        expect(await resolveSession({ type: "STAFF", userId: "u1" }, T0)).toEqual({ ok: false, reason: "NO_SESSION" });
    });

    it("rejects an unknown session id", async () => {
        expect(await resolveSession(staffClaims("not-a-real-sid"), T0)).toEqual({ ok: false, reason: "UNKNOWN" });
    });

    it("rejects a revoked session", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" }, T0);
        await revokeSessionBySid(store.db, sid, "LOGOUT", plus(1));
        expect(await resolveSession(staffClaims(sid), plus(2))).toEqual({ ok: false, reason: "REVOKED" });
    });

    it("rejects a suspended, deleted or reassigned account immediately", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" }, T0);
        store.state.users.u1.status = "SUSPENDED";
        expect(await resolveSession(staffClaims(sid), plus(1))).toEqual({ ok: false, reason: "ACCOUNT_INACTIVE" });
        store.state.users.u1.status = "ACTIVE";
        store.state.users.u1.deletedAt = new Date();
        expect(await resolveSession(staffClaims(sid), plus(1))).toEqual({ ok: false, reason: "ACCOUNT_INACTIVE" });
        store.state.users.u1.deletedAt = null;
        store.state.users.u1.tenantId = "tenant-b";
        expect(await resolveSession(staffClaims(sid), plus(1))).toEqual({ ok: false, reason: "MISMATCH" });
    });

    it("rejects when the clinic is frozen", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" }, T0);
        store.state.tenants["tenant-a"].status = "FROZEN";
        expect(await resolveSession(staffClaims(sid), plus(1))).toEqual({ ok: false, reason: "CLINIC_INACTIVE" });
    });

    it("rejects a token whose claims name a different account than the session", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" }, T0);
        expect(await resolveSession(staffClaims(sid, { userId: "someone-else" }), plus(1))).toEqual({ ok: false, reason: "MISMATCH" });
        expect(await resolveSession(patientClaims(sid), plus(1))).toEqual({ ok: false, reason: "MISMATCH" });
    });

    it("expires at the absolute limit and when idle too long", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" }, T0);
        expect(await resolveSession(staffClaims(sid), plus(SESSION_POLICY.STAFF_IDLE_SECONDS + 1))).toEqual({ ok: false, reason: "IDLE_EXPIRED" });
        // keep it active past the idle limit but never past the absolute cap
        let t = T0;
        while (t.getTime() - T0.getTime() < SESSION_POLICY.STAFF_ABSOLUTE_SECONDS * 1000 - 3600_000) {
            t = plus(3600 * 6, t);
            const r = await resolveSession(staffClaims(sid), t);
            if (t.getTime() - T0.getTime() < SESSION_POLICY.STAFF_ABSOLUTE_SECONDS * 1000) expect(r.ok).toBe(true);
        }
        expect(await resolveSession(staffClaims(sid), plus(SESSION_POLICY.STAFF_ABSOLUTE_SECONDS + 1))).toEqual({ ok: false, reason: "EXPIRED" });
    });

    it("propagates a database failure instead of allowing", async () => {
        store.db.authSession.findUnique.mockRejectedValue(new Error("db down"));
        await expect(resolveSession(staffClaims("x"), T0)).rejects.toThrow("db down");
    });
});

describe("resolveSession — patient (rolling with absolute maximum)", () => {
    it("stays signed in during ordinary use: each visit pushes the idle expiry forward", async () => {
        const { sid } = await createPatientSession(store.db, { patientId: "p1", tenantId: "tenant-a" }, T0);
        let t = T0;
        for (let visit = 1; visit <= 60; visit++) {
            t = plus(86400 * 20, t); // a visit every 20 days — each gap is within the 30-day idle window
            if (t.getTime() - T0.getTime() > SESSION_POLICY.PATIENT_ABSOLUTE_SECONDS * 1000 - 86400_000) break;
            expect((await resolveSession(patientClaims(sid), t)).ok).toBe(true);
        }
        expect(t.getTime() - T0.getTime()).toBeGreaterThan(SESSION_POLICY.PATIENT_IDLE_SECONDS * 1000); // outlived the idle window thanks to activity
    });

    it("is rejected after the idle window with no activity", async () => {
        const { sid } = await createPatientSession(store.db, { patientId: "p1", tenantId: "tenant-a" }, T0);
        expect(await resolveSession(patientClaims(sid), plus(SESSION_POLICY.PATIENT_IDLE_SECONDS + 1))).toEqual({ ok: false, reason: "IDLE_EXPIRED" });
    });

    it("can never be extended past the absolute maximum", async () => {
        const { sid } = await createPatientSession(store.db, { patientId: "p1", tenantId: "tenant-a" }, T0);
        const absolute = SESSION_POLICY.PATIENT_ABSOLUTE_SECONDS;
        // last visit just before the cap
        const nearEnd = plus(absolute - 3600);
        store.state.sessions[0].idleExpiresAt = plus(absolute - 60); // pretend earlier visits kept it alive
        store.state.sessions[0].lastSeenAt = plus(absolute - 7200);
        expect((await resolveSession(patientClaims(sid), nearEnd)).ok).toBe(true);
        expect(store.state.sessions[0].idleExpiresAt.getTime()).toBeLessThanOrEqual(store.state.sessions[0].absoluteExpiresAt.getTime());
        expect(await resolveSession(patientClaims(sid), plus(absolute + 1))).toEqual({ ok: false, reason: "EXPIRED" });
    });

    it("rejects a revoked session and a deleted patient", async () => {
        const { sid } = await createPatientSession(store.db, { patientId: "p1", tenantId: "tenant-a" }, T0);
        store.state.patients.p1.deletedAt = new Date();
        expect(await resolveSession(patientClaims(sid), plus(1))).toEqual({ ok: false, reason: "ACCOUNT_INACTIVE" });
        store.state.patients.p1.deletedAt = null;
        await revokeSessionBySid(store.db, sid, "SIGN_OUT_ALL", plus(2));
        expect(await resolveSession(patientClaims(sid), plus(3))).toEqual({ ok: false, reason: "REVOKED" });
    });
});

describe("revocation helpers", () => {
    it("revokeUserSessions revokes every live session of that user only, optionally sparing one", async () => {
        const a = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" }, T0);
        const b = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" }, T0);
        store.state.users.u2 = activeUser({ id: "u2" });
        const other = await createStaffSession(store.db, { userId: "u2", tenantId: "tenant-a" }, T0);

        expect(await revokeUserSessions(store.db, "u1", "PASSWORD_RESET", { exceptSid: b.sid })).toBe(1);
        expect((await resolveSession(staffClaims(a.sid), plus(1))).ok).toBe(false);
        expect((await resolveSession(staffClaims(b.sid), plus(1))).ok).toBe(true);
        expect((await resolveSession({ type: "STAFF", userId: "u2", sid: other.sid }, plus(1))).ok).toBe(true);

        expect(await revokeUserSessions(store.db, "u1", "ACCOUNT_SUSPENDED")).toBe(1);
        expect(store.state.sessions.filter((s: any) => s.userId === "u1").every((s: any) => s.revokedAt && s.revokedReason)).toBe(true);
    });
});

describe("strict permission resolution fails closed", () => {
    it("throws, rather than dropping a DENY, when overrides cannot be read", async () => {
        store.db.userOverride.findMany.mockRejectedValue(new Error("overrides unreadable"));
        await expect(resolveUserPermissions("u1", ["DOCTOR"], "tenant-a", { strict: true })).rejects.toThrow("overrides unreadable");
        // non-strict keeps its old degrade-to-defaults behaviour for callers that rely on it
        vi.spyOn(console, "warn").mockImplementation(() => {});
        await expect(resolveUserPermissions("u1", ["DOCTOR"], "tenant-a")).resolves.toBeInstanceOf(Array);
    });

    it("applies a denied override on every request", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" }, T0);
        const base = await resolveSession(staffClaims(sid), plus(1));
        const someDoctorPerm = (base.ok ? (base.user as any).permissions[0] : "") as string;
        store.db.userOverride.findMany.mockResolvedValue([{ granted: false, permission: { name: someDoctorPerm } }]);
        const after = await resolveSession(staffClaims(sid), plus(2));
        expect(after.ok && (after.user as any).permissions.includes(someDoctorPerm)).toBe(false);
    });
});

describe("requireAuth", () => {
    const tokenFor = (claims: any, patient = false) => (patient ? signPatientToken(claims) : signToken(claims));

    it("401s a forged/legacy token and 200-equivalents a live session", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" });
        const good = tokenFor({ userId: "u1", tenantId: "tenant-a", role: "DOCTOR", roles: ["DOCTOR"], permissions: [], featureFlags: [], type: "STAFF", sid });
        const legacy = tokenFor({ userId: "u1", tenantId: "tenant-a", role: "DOCTOR", roles: ["DOCTOR"], permissions: [], featureFlags: [], type: "STAFF" });
        expect("user" in (await requireAuth(makeRequest("/api/x", { token: good })))).toBe(true);
        const denied = await requireAuth(makeRequest("/api/x", { token: legacy }));
        expect("error" in denied && denied.error.status).toBe(401);
        const none = await requireAuth(makeRequest("/api/x"));
        expect("error" in none && none.error.status).toBe(401);
    });

    it("is revoked on the very next request after a revoke", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" });
        const token = tokenFor({ userId: "u1", tenantId: "tenant-a", role: "DOCTOR", roles: ["DOCTOR"], permissions: [], featureFlags: [], type: "STAFF", sid });
        expect("user" in (await requireAuth(makeRequest("/api/x", { token })))).toBe(true);
        await revokeUserSessions(store.db, "u1", "ACCOUNT_SUSPENDED");
        const after = await requireAuth(makeRequest("/api/x", { token }));
        expect("error" in after && after.error.status).toBe(401);
    });

    it("fails CLOSED with 503 when the session store is unavailable", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" });
        const token = tokenFor({ userId: "u1", tenantId: "tenant-a", role: "DOCTOR", roles: ["DOCTOR"], permissions: [], featureFlags: [], type: "STAFF", sid });
        store.db.authSession.findUnique.mockRejectedValue(new Error("connection refused"));
        const res = await requireAuth(makeRequest("/api/x", { token }));
        expect("error" in res && res.error.status).toBe(503);
        expect("user" in res).toBe(false);
    });
});

describe("logout", () => {
    const cookieReq = (token: string) =>
        new NextRequest("http://localhost/api/auth/logout", { method: "POST", headers: { cookie: `nexus_token=${token}` } });

    it("revokes the current session and clears cookies", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" });
        const token = signToken({ userId: "u1", tenantId: "tenant-a", role: "DOCTOR", roles: ["DOCTOR"], permissions: [], featureFlags: [], type: "STAFF", sid });
        const res = await logout(cookieReq(token));
        expect(res.status).toBe(200);
        expect(store.state.sessions[0]).toMatchObject({ revokedReason: "LOGOUT" });
        expect(store.state.sessions[0].revokedAt).toBeInstanceOf(Date);
        expect(res.headers.get("set-cookie")).toMatch(/nexus_token=;/);
        expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "SESSION_LOGOUT" }));
    });

    it("does not claim success if the server session could not be revoked", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" });
        const token = signToken({ userId: "u1", tenantId: "tenant-a", role: "DOCTOR", roles: ["DOCTOR"], permissions: [], featureFlags: [], type: "STAFF", sid });
        store.db.authSession.updateMany.mockRejectedValue(new Error("db down"));
        const res = await logout(cookieReq(token));
        expect(res.status).toBe(500);
        expect((await res.json()).success).toBe(false);
        // The browser keeps its cookie so it can retry: no Set-Cookie at all.
        expect(res.headers.get("set-cookie")).toBeNull();
        expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "SESSION_REVOKE_FAILED" }));
        // and it never records the token or sid
        expect(JSON.stringify(auditLog.mock.calls)).not.toContain(sid);
        expect(JSON.stringify(auditLog.mock.calls)).not.toContain(token);
    });

    it("retry after a failed logout succeeds: the session ends and only then is the cookie cleared", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" });
        const token = signToken({ userId: "u1", tenantId: "tenant-a", role: "DOCTOR", roles: ["DOCTOR"], permissions: [], featureFlags: [], type: "STAFF", sid });

        store.db.authSession.updateMany.mockRejectedValueOnce(new Error("db blip"));
        const failed = await logout(cookieReq(token));
        expect(failed.status).toBe(500);
        expect(failed.headers.get("set-cookie")).toBeNull();
        // the session is genuinely still live on the server
        expect(store.state.sessions[0].revokedAt).toBeNull();

        const retried = await logout(cookieReq(token));
        expect(retried.status).toBe(200);
        expect(retried.headers.get("set-cookie")).toMatch(/nexus_token=;/);
        expect(store.state.sessions[0]).toMatchObject({ revokedReason: "LOGOUT" });
    });

    it("logging out twice is harmless", async () => {
        const { sid } = await createStaffSession(store.db, { userId: "u1", tenantId: "tenant-a" });
        const token = signToken({ userId: "u1", tenantId: "tenant-a", role: "DOCTOR", roles: ["DOCTOR"], permissions: [], featureFlags: [], type: "STAFF", sid });
        expect((await logout(cookieReq(token))).status).toBe(200);
        expect((await logout(cookieReq(token))).status).toBe(200);
    });
});
