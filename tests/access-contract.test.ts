/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures and database stand-ins are intentionally loosely typed */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => {
    const fn = () => vi.fn();
    const db: any = {
        user: { findUnique: fn() },
        patient: { findUnique: fn() },
        tenantSettings: { findUnique: fn() },
        authSession: { findUnique: fn() },
    };
    return { db };
});
vi.mock("@/lib/db/prisma", () => ({ default: db, prisma: db }));

import { staffToken, patientToken, makeRequest } from "./helpers/auth";
import { GET as me } from "@/app/api/auth/me/route";
import {
    featureDisabledResponse,
    normalizeModuleFlags,
    requireCapability,
    resolveModules,
    resolveProviders,
} from "@/lib/config/features";
import { FEATURE_DISABLED_CODE, MODULE_KEYS, PROVIDER_KEYS } from "@/contracts/access";

const SENTINEL = {
    PAYSTACK_SECRET_KEY: "sk_live_SENTINEL_paystack_secret",
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: "pk_live_SENTINEL_paystack_public",
    HUBTEL_CLIENT_ID: "SENTINEL-hubtel-id",
    HUBTEL_CLIENT_SECRET: "SENTINEL-hubtel-secret",
    HUBTEL_SENDER_ID: "SENTINEL-sender",
    RESEND_API_KEY: "re_SENTINEL_resend_key",
    EMAIL_FROM: "SENTINEL <noreply@sentinel.example>",
    DAILY_API_KEY: "SENTINEL-daily-key",
};

const saved = { ...process.env };
afterEach(() => {
    process.env = { ...saved };
});
beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(SENTINEL)) delete process.env[k];
    delete process.env.ENABLED_FEATURES;
    process.env.DEPLOYMENT_MODE = "single_clinic";
});

describe("legacy flag normalization", () => {
    it("maps every historical spelling to one canonical key", () => {
        expect(normalizeModuleFlags({ enableTelehealth: false, enableOnlineConsultation: false, enablePharmacy: false, enablePatientPortal: false })).toEqual({
            telehealth: false,
            onlineConsultation: false,
            pharmacy: false,
            patientPortal: false,
        });
        expect(normalizeModuleFlags({ telehealth: false, online_consultation: false, "patient-portal": false, PHARMACY: false })).toEqual({
            telehealth: false,
            onlineConsultation: false,
            patientPortal: false,
            pharmacy: false,
        });
    });

    it("understands the array form and ignores unknown keys, non-booleans and junk", () => {
        expect(normalizeModuleFlags(["telehealth", "Pharmacy", 42, "nonsense"])).toEqual({ telehealth: true, pharmacy: true });
        expect(normalizeModuleFlags({ enableTelehealth: "no", somethingElse: false })).toEqual({});
        expect(normalizeModuleFlags(null)).toEqual({});
        expect(normalizeModuleFlags("telehealth")).toEqual({});
    });
});

describe("modules vs providers", () => {
    it("modules default to ON when the clinic has said nothing, and OFF with a reason when switched off", () => {
        const m = resolveModules({ enablePharmacy: false }, {});
        expect(m.pharmacy).toEqual({ enabled: false, reason: "DISABLED_BY_CLINIC" });
        expect(m.patientPortal).toEqual({ enabled: true });
        expect(m.onlineConsultation).toEqual({ enabled: true });
    });

    it("telehealth needs BOTH the clinic switch and the telehealth provider", () => {
        expect(resolveModules({}, {}).telehealth).toEqual({ enabled: false, reason: "PROVIDER_UNAVAILABLE" });
        expect(resolveModules({}, { DAILY_API_KEY: "x" }).telehealth).toEqual({ enabled: true });
        expect(resolveModules({ enableTelehealth: false }, { DAILY_API_KEY: "x" }).telehealth).toEqual({
            enabled: false,
            reason: "DISABLED_BY_CLINIC",
        });
    });

    it("a provider is on only when listed in ENABLED_FEATURES (if set) AND fully configured", () => {
        const all = { ...SENTINEL };
        expect(resolveProviders({ ...all, ENABLED_FEATURES: "paystack,resend" })).toEqual({
            paystack: { enabled: true },
            hubtel: { enabled: false, reason: "NOT_CONFIGURED" },
            resend: { enabled: true },
            mnotify: { enabled: false, reason: "NOT_CONFIGURED" },
        });
        // Listed but a credential is missing => off.
        expect(resolveProviders({ ENABLED_FEATURES: "paystack" }).paystack.enabled).toBe(false);
        // No ENABLED_FEATURES (local dev): configuration alone decides.
        expect(resolveProviders(all).hubtel.enabled).toBe(true);
        expect(resolveProviders({}).paystack.enabled).toBe(false);
    });

    it("in production a missing, empty or 'none' ENABLED_FEATURES enables NOTHING, even with every secret present", () => {
        for (const value of [undefined, "", "   ", "none"]) {
            const p = resolveProviders({ ...SENTINEL, NODE_ENV: "production", ENABLED_FEATURES: value });
            expect(Object.values(p).every((s) => s.enabled === false), `value=${JSON.stringify(value)}`).toBe(true);
        }
        expect(resolveModules({}, { ...SENTINEL, NODE_ENV: "production" }).telehealth).toEqual({ enabled: false, reason: "PROVIDER_UNAVAILABLE" });
    });

    it("in production only the listed providers are on", () => {
        const p = resolveProviders({ ...SENTINEL, NODE_ENV: "production", ENABLED_FEATURES: "resend" });
        expect(p.resend.enabled).toBe(true);
        expect(p.paystack.enabled).toBe(false);
        expect(p.hubtel.enabled).toBe(false);
    });

    it("provider state never changes a module and vice versa", () => {
        const m = resolveModules({ enablePatientPortal: true }, {});
        const p = resolveProviders({});
        expect(Object.keys(m).sort()).toEqual([...MODULE_KEYS].sort());
        expect(Object.keys(p).sort()).toEqual([...PROVIDER_KEYS].sort());
        expect(m.patientPortal.enabled).toBe(true);
        expect(p.paystack.enabled).toBe(false);
    });
});

describe("one disabled-feature error", () => {
    it("is a 403 with the stable FEATURE_DISABLED code and no configuration detail", async () => {
        const res = featureDisabledResponse("pharmacy");
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body).toMatchObject({ success: false, code: FEATURE_DISABLED_CODE, feature: "pharmacy", reason: "DISABLED_BY_CLINIC" });
        expect(FEATURE_DISABLED_CODE).toBe("FEATURE_DISABLED");
        expect(JSON.stringify(body)).not.toMatch(/key|secret|env/i);
    });

    it("requireCapability passes enabled state through and blocks disabled state", () => {
        expect(requireCapability("telehealth", { enabled: true })).toBeNull();
        expect(requireCapability("telehealth", { enabled: false, reason: "PROVIDER_UNAVAILABLE" })?.status).toBe(403);
    });
});

describe("GET /api/auth/me — effective access", () => {
    const staffRow = (extra: object = {}) => ({
        id: "user-doctor-tenant-a",
        tenantId: "tenant-a",
        email: "d@example.test",
        passwordHash: "SHOULD-NEVER-APPEAR",
        firstName: "D",
        lastName: "Doc",
        status: "ACTIVE",
        roles: [{ systemRole: "DOCTOR" }],
        ...extra,
    });

    it("returns the contract for staff, keeps legacy fields, and leaks no secret or password hash", async () => {
        Object.assign(process.env, SENTINEL, { ENABLED_FEATURES: "paystack,hubtel,resend,telehealth" });
        db.user.findUnique.mockResolvedValue(staffRow());
        db.tenantSettings.findUnique.mockResolvedValue({ featureFlags: { enablePharmacy: false, enableTelehealth: true } });

        const res = await me(makeRequest("/api/auth/me", { token: staffToken({ tenantId: "tenant-a", roles: ["DOCTOR"] }) }));
        expect(res.status).toBe(200);
        const text = await res.text();
        for (const v of Object.values(SENTINEL)) expect(text).not.toContain(v);
        expect(text).not.toContain("SHOULD-NEVER-APPEAR");

        const { data } = JSON.parse(text);
        // legacy shape preserved
        expect(data).toMatchObject({ type: "STAFF", role: "DOCTOR", roles: ["DOCTOR"], email: "d@example.test" });
        expect(Array.isArray(data.permissions)).toBe(true);
        // new contract
        expect(data.access).toMatchObject({
            version: 1,
            deploymentMode: "single_clinic",
            subject: "STAFF",
            role: "DOCTOR",
            roles: ["DOCTOR"],
        });
        expect(data.access.permissions).toEqual(data.permissions);
        expect(data.access.modules.pharmacy).toEqual({ enabled: false, reason: "DISABLED_BY_CLINIC" });
        expect(data.access.modules.telehealth).toEqual({ enabled: true });
        expect(data.access.providers).toEqual({
            paystack: { enabled: true },
            hubtel: { enabled: true },
            resend: { enabled: true },
            mnotify: { enabled: false, reason: "NOT_CONFIGURED" },
        });
    });

    it("returns the contract for a patient with no permissions", async () => {
        db.patient.findUnique.mockResolvedValue({ id: "pat-1", tenantId: "tenant-a", firstName: "P", lastName: "Q", phone: "0200000000", email: null, dateOfBirth: null, isVerified: true, lastVisitAt: null });
        db.tenantSettings.findUnique.mockResolvedValue({ featureFlags: { enablePatientPortal: true } });
        db.authSession.findUnique.mockResolvedValue(null);
        const res = await me(makeRequest("/api/auth/me", { token: patientToken({ patientId: "pat-1", tenantId: "tenant-a" }) }));
        const { data } = await res.json();
        expect(data).toMatchObject({ type: "PATIENT", role: "PATIENT", roles: ["PATIENT"], id: "pat-1" });
        expect(data.access).toMatchObject({ subject: "PATIENT", role: "PATIENT", roles: ["PATIENT"], permissions: [] });
        expect(data.access.modules.patientPortal).toEqual({ enabled: true });
    });
});
