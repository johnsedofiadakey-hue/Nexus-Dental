import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";

const { db } = vi.hoisted(() => {
    const fn = () => vi.fn();
    const db: any = {
        tenant: { count: fn(), findMany: fn() },
        user: { count: fn() },
        patient: { count: fn() },
        appointment: { findMany: fn() },
        invoice: { findMany: fn(), groupBy: fn() },
    };
    return { db };
});
vi.mock("@/lib/db/prisma", () => ({ default: db, prisma: db }));

import { staffToken, patientToken, systemOwnerToken, makeRequest } from "./helpers/auth";
import { GET as platformAnalytics } from "@/app/api/analytics/platform/route";
import { GET as systemStats } from "@/app/api/system/stats/route";

beforeEach(() => {
    vi.clearAllMocks();
    db.tenant.count.mockResolvedValue(2);
    db.user.count.mockResolvedValue(7);
    db.patient.count.mockResolvedValue(40);
    db.tenant.findMany.mockResolvedValue([]);
    db.appointment.findMany.mockResolvedValue([]);
    db.invoice.findMany.mockResolvedValue([]);
    db.invoice.groupBy.mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(() => {});
});

const routes = [
    ["GET /api/analytics/platform", (t?: string) => platformAnalytics(makeRequest("/api/analytics/platform", { token: t }))],
    ["GET /api/system/stats", (t?: string) => systemStats(makeRequest("/api/system/stats", { token: t }))],
] as const;

describe.each(routes)("%s (cross-clinic totals)", (_name, call) => {
    it("rejects a request with no session", async () => {
        expect((await call()).status).toBe(401);
    });

    it("rejects a forged or garbage token — the edge middleware only checks a cookie exists", async () => {
        expect((await call("not-a-real-jwt")).status).toBe(401);
    });

    it("rejects a clinic owner and other clinic staff", async () => {
        expect((await call(staffToken({ tenantId: "tenant-a", roles: ["CLINIC_OWNER"] }))).status).toBe(403);
        expect((await call(staffToken({ tenantId: "tenant-a", roles: ["ADMIN"] }))).status).toBe(403);
    });

    it("rejects a patient", async () => {
        expect((await call(patientToken({ patientId: "p1", tenantId: "tenant-a" }))).status).toBe(403);
    });

    it("never queries the database for an unauthorized caller", async () => {
        await call();
        await call(staffToken({ tenantId: "tenant-a", roles: ["CLINIC_OWNER"] }));
        expect(db.tenant.count).not.toHaveBeenCalled();
        expect(db.tenant.findMany).not.toHaveBeenCalled();
    });

    it("serves the system owner", async () => {
        expect((await call(systemOwnerToken())).status).toBe(200);
    });
});

// ── Inventory guard: no API route may be unauthenticated by accident ─────────
describe("API route authentication inventory", () => {
    // Routes that are intentionally reachable without a session. Anything NOT
    // listed here must verify the caller. Adding a route here is a deliberate,
    // reviewable decision.
    const INTENTIONALLY_PUBLIC = new Set([
        "appointments/doctors",       // public booking: list doctors
        "appointments/slots",         // public booking: list free slots
        "auth/forgot-password",       // emails a single-use reset link
        "auth/login",
        "auth/logout",
        "auth/patient/otp/request",
        "auth/patient/otp/verify",
        "auth/reset-password",        // the emailed token is the credential
        "health",                     // uptime monitor
        "onboarding",                 // one-time setup; refuses once a clinic exists
        "public/clinic/content",      // public website content
        "staff/invite/[token]",       // invite token is the credential
        "staff/invite/[token]/accept",
    ]);
    // A route verifies its caller if it uses one of these mechanisms.
    const AUTH_MARKERS = /requireAuth|authenticateRequest|verifyWebhookSignature|BACKUP_WEBHOOK_SECRET|x-backup-secret|requireSystemOwner|verifyToken/;

    function findRoutes(dir: string): string[] {
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) return findRoutes(full);
            return e.name === "route.ts" ? [full] : [];
        });
    }

    const apiDir = path.resolve(__dirname, "../src/app/api");
    const files = findRoutes(apiDir);

    it("finds the API routes", () => {
        expect(files.length).toBeGreaterThan(50);
    });

    it("has no route without an auth check that is not on the public allowlist", () => {
        const unprotected = files
            .filter((f) => !AUTH_MARKERS.test(fs.readFileSync(f, "utf8")))
            .map((f) => path.relative(apiDir, path.dirname(f)).split(path.sep).join("/"))
            .filter((r) => !INTENTIONALLY_PUBLIC.has(r));
        expect(unprotected, `Unauthenticated API routes not on the allowlist: ${unprotected.join(", ")}`).toEqual([]);
    });

    it("has no stale allowlist entries pointing at routes that no longer exist", () => {
        const existing = new Set(files.map((f) => path.relative(apiDir, path.dirname(f)).split(path.sep).join("/")));
        const stale = [...INTENTIONALLY_PUBLIC].filter((r) => !existing.has(r));
        expect(stale).toEqual([]);
    });
});
