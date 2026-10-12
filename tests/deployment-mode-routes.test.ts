/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures and database mocks are intentionally loosely typed */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { db, sys } = vi.hoisted(() => {
    const fn = () => vi.fn();
    const db: any = {
        tenant: { findUnique: fn(), findFirst: fn(), create: fn(), update: fn() },
        user: { create: fn() },
        $transaction: vi.fn(async (cb: any) => cb(db)),
    };
    const sys = {
        listTenants: vi.fn(async () => ({ tenants: [], total: 0 })),
        getTenantStats: vi.fn(async () => ({})),
        changeTenantStatus: vi.fn(async () => ({})),
        killSwitch: vi.fn(async () => ({})),
        enableMaintenance: vi.fn(async () => ({})),
        disableMaintenance: vi.fn(async () => ({})),
    };
    return { db, sys };
});

vi.mock("@/lib/db/prisma", () => ({ default: db, prisma: db }));
vi.mock("@/lib/audit/logger", () => ({ logAudit: vi.fn(async () => {}), getClientIP: () => "x", getUserAgent: () => "x" }));
vi.mock("@/lib/system", () => sys);

import { makeRequest, params, staffToken, systemOwnerToken } from "./helpers/auth";
import { GET as onboardingGet, POST as onboardingPost } from "@/app/api/onboarding/route";
import { GET as listTenants, POST as createTenant } from "@/app/api/system/tenants/route";
import { GET as getTenant, PATCH as patchTenant } from "@/app/api/system/tenants/[id]/route";

const ORIGINAL = process.env.DEPLOYMENT_MODE;
beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DEPLOYMENT_MODE;
    else process.env.DEPLOYMENT_MODE = ORIGINAL;
});

const body = { name: "Second Clinic", slug: "second-clinic" };

describe("/api/onboarding is retired in every mode", () => {
    it.each([["single_clinic"], [undefined]])("POST and GET return 410 and write nothing (mode=%s)", async (mode) => {
        if (mode) process.env.DEPLOYMENT_MODE = mode; else delete process.env.DEPLOYMENT_MODE;

        const post = await onboardingPost();
        const get = await onboardingGet();
        expect(post.status).toBe(410);
        expect(get.status).toBe(410);
        expect((await post.json()).code).toBe("ONBOARDING_DISABLED");
        expect(db.tenant.create).not.toHaveBeenCalled();
        expect(db.user.create).not.toHaveBeenCalled();
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("does not leak the old behaviour: no tenant lookup, no session cookie", async () => {
        const res = await onboardingPost();
        expect(res.headers.get("set-cookie")).toBeNull();
        expect(db.tenant.findFirst).not.toHaveBeenCalled();
    });
});

describe("system tenant APIs in single_clinic mode", () => {
    beforeEach(() => {
        process.env.DEPLOYMENT_MODE = "single_clinic";
    });
    const owner = () => systemOwnerToken();
    const call = (token?: string) => ({
        list: () => listTenants(makeRequest("/api/system/tenants", { token })),
        create: () => createTenant(makeRequest("/api/system/tenants", { method: "POST", token, body })),
        get: () => getTenant(makeRequest("/api/system/tenants/x", { token }), params({ id: "x" })),
        update: () => patchTenant(makeRequest("/api/system/tenants/x", { method: "PATCH", token, body: { name: "Renamed" } }), params({ id: "x" })),
    });

    it.each(["list", "create", "get", "update"] as const)("%s is disabled with a machine-readable code", async (op) => {
        const res = await call(owner())[op]();
        expect(res.status).toBe(403);
        expect((await res.json()).code).toBe("TENANT_ADMIN_DISABLED");
    });

    it("never reaches the database or the system library", async () => {
        for (const op of ["list", "create", "get", "update"] as const) await call(owner())[op]();
        expect(db.tenant.create).not.toHaveBeenCalled();
        expect(db.tenant.update).not.toHaveBeenCalled();
        expect(db.tenant.findUnique).not.toHaveBeenCalled();
        expect(sys.listTenants).not.toHaveBeenCalled();
        expect(sys.killSwitch).not.toHaveBeenCalled();
        expect(sys.changeTenantStatus).not.toHaveBeenCalled();
    });

    it("still answers 401 / 403 first — authentication is checked before the mode", async () => {
        expect((await call(undefined).list()).status).toBe(401);
        const clinicOwner = staffToken({ tenantId: "t", roles: ["CLINIC_OWNER"] });
        const res = await call(clinicOwner).create();
        expect(res.status).toBe(403);
        expect((await res.json()).code).toBeUndefined(); // the "system owner required" error, not the mode error
    });
});

describe("outside single_clinic mode the platform APIs are unchanged", () => {
    it("still lists tenants for the system owner", async () => {
        delete process.env.DEPLOYMENT_MODE;
        const res = await listTenants(makeRequest("/api/system/tenants", { token: systemOwnerToken() }));
        expect(res.status).toBe(200);
        expect(sys.listTenants).toHaveBeenCalledOnce();
    });
});
