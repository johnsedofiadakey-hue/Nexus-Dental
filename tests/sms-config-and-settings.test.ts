/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma-shaped stand-ins */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
    const db: any = { tenantSettings: { findUnique: vi.fn(), upsert: vi.fn(), create: vi.fn() }, auditLog: { create: vi.fn() } };
    return { db, audit: vi.fn(async (entry: unknown) => { void entry; }) };
});
vi.mock("@/lib/db/prisma", () => ({ default: m.db, prisma: m.db }));
vi.mock("@/lib/audit/logger", () => ({ logAudit: m.audit, getClientIP: () => "127.0.0.1", getUserAgent: () => "vitest" }));

import { validateRuntimeConfig } from "@/lib/config/validate";
import { mergeFeatureFlags, parseFeatureFlagUpdate, resolveModules, resolveProviders } from "@/lib/config/features";
import { GET as getSettings, POST as postSettings } from "@/app/api/clinic/settings/route";
import { staffToken, makeRequest } from "./helpers/auth";
import { validEnv, without } from "./helpers/config";

const vars = (env: Record<string, string | undefined>) => validateRuntimeConfig(env).problems.map((p) => p.variable);
const SMS = { SMS_PROVIDER: "mnotify", MNOTIFY_API_KEY: "k".repeat(20), MNOTIFY_SENDER_ID: "Dentoc", ENABLED_FEATURES: "paystack,hubtel,resend,mnotify" };

describe("startup configuration: SMS and demo mode", () => {
    it("a complete mNotify configuration is valid", () => {
        expect(vars(validEnv(SMS))).toEqual([]);
    });
    it("SMS_PROVIDER=mnotify requires the feature to be enabled, and the feature requires the provider", () => {
        expect(vars(validEnv({ SMS_PROVIDER: "mnotify", MNOTIFY_API_KEY: "k".repeat(20), MNOTIFY_SENDER_ID: "Dentoc" }))).toContain("ENABLED_FEATURES");
        expect(vars(validEnv({ ENABLED_FEATURES: "paystack,hubtel,resend,mnotify", MNOTIFY_API_KEY: "k".repeat(20), MNOTIFY_SENDER_ID: "Dentoc" }))).toContain("SMS_PROVIDER");
    });
    it("the mNotify credentials are required once the feature is on", () => {
        const v = vars(without(validEnv(SMS), "MNOTIFY_API_KEY", "MNOTIFY_SENDER_ID"));
        expect(v).toEqual(expect.arrayContaining(["MNOTIFY_API_KEY", "MNOTIFY_SENDER_ID"]));
    });
    it.each(["WAYTOOLONGSENDER", "bad!", ""])("the sender ID %j is refused (1-11 letters/digits)", (sender) => {
        expect(vars(validEnv({ ...SMS, MNOTIFY_SENDER_ID: sender }))).toContain("MNOTIFY_SENDER_ID");
    });
    it("an unsupported provider, and the console provider in production, are refused", () => {
        expect(vars(validEnv({ SMS_PROVIDER: "twilio" }))).toContain("SMS_PROVIDER");
        expect(vars(validEnv({ SMS_PROVIDER: "console" }))).toContain("SMS_PROVIDER");
        expect(vars(validEnv({ SMS_PROVIDER: "console", NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "http://localhost:3000" }))).not.toContain("SMS_PROVIDER");
    });
    it("DEMO_MODE=true REQUIRES an allowlist of valid E.164 numbers", () => {
        expect(vars(validEnv({ DEMO_MODE: "true" }))).toContain("DEMO_SMS_ALLOWLIST");
        expect(vars(validEnv({ DEMO_MODE: "true", DEMO_SMS_ALLOWLIST: "  " }))).toContain("DEMO_SMS_ALLOWLIST");
        expect(vars(validEnv({ DEMO_MODE: "true", DEMO_SMS_ALLOWLIST: "0244123456" }))).toContain("DEMO_SMS_ALLOWLIST"); // local form is not E.164
        expect(vars(validEnv({ DEMO_MODE: "true", DEMO_SMS_ALLOWLIST: "+233200000001, +233200000002" }))).not.toContain("DEMO_SMS_ALLOWLIST");
        expect(vars(validEnv({ DEMO_MODE: "false" }))).not.toContain("DEMO_SMS_ALLOWLIST");
    });
    it("never reports a secret value", () => {
        const text = JSON.stringify(validateRuntimeConfig(validEnv({ ...SMS, MNOTIFY_SENDER_ID: "WAYTOOLONGSENDER" })).problems);
        expect(text).not.toContain("k".repeat(20));
    });
});

describe("access contract: smsReminders module and mnotify provider", () => {
    it("reminders are on only when the clinic allows them AND mNotify is usable", () => {
        const env = { ...SMS };
        expect(resolveModules({}, env).smsReminders).toEqual({ enabled: true });
        expect(resolveModules({ enableSmsReminders: false }, env).smsReminders).toEqual({ enabled: false, reason: "DISABLED_BY_CLINIC" });
        expect(resolveModules({}, {}).smsReminders).toEqual({ enabled: false, reason: "PROVIDER_UNAVAILABLE" });
        expect(resolveProviders(env).mnotify).toEqual({ enabled: true });
        expect(resolveProviders({}).mnotify).toEqual({ enabled: false, reason: "NOT_CONFIGURED" });
        expect(JSON.stringify(resolveProviders(env))).not.toContain("k".repeat(20));
    });
    it("in production an unlisted mnotify stays off even with credentials", () => {
        expect(resolveProviders({ ...SMS, NODE_ENV: "production", ENABLED_FEATURES: "paystack" }).mnotify.enabled).toBe(false);
    });
});

describe("feature-flag writes are validated and merged", () => {
    it("accepts every historical spelling of a known switch and rejects unknown keys and non-booleans", () => {
        expect(parseFeatureFlagUpdate({ enableSmsReminders: false, smsReminders: true })).toEqual({ ok: true, update: { smsReminders: true } });
        expect(parseFeatureFlagUpdate({ enableTelehealth: false })).toEqual({ ok: true, update: { telehealth: false } });
        for (const bad of [{ enableSmsReminderz: true }, { enableSmsReminders: "no" }, { enableSmsReminders: 0 }, [], null, "x", { paystack: true }]) {
            expect(parseFeatureFlagUpdate(bad).ok, JSON.stringify(bad)).toBe(false);
        }
    });
    it("merging keeps unrelated stored keys and replaces older spellings of the same switch", () => {
        const merged = mergeFeatureFlags({ paystack: true, telehealth: true, enablePharmacy: true }, { telehealth: false, smsReminders: false });
        expect(merged).toEqual({ paystack: true, enablePharmacy: true, enableTelehealth: false, enableSmsReminders: false });
        expect(mergeFeatureFlags(null, { pharmacy: false })).toEqual({ enablePharmacy: false });
    });
});

describe("/api/clinic/settings", () => {
    const owner = () => staffToken({ userId: "o", tenantId: "tenant-a", roles: ["CLINIC_OWNER"] });
    const post = (body: unknown, token = owner()) => postSettings(makeRequest("/api/clinic/settings", { method: "POST", token, body }));
    beforeEach(() => {
        vi.clearAllMocks();
        Object.assign(process.env, { SMS_PROVIDER: "mnotify", MNOTIFY_API_KEY: "k".repeat(20), MNOTIFY_SENDER_ID: "Dentoc" });
        m.db.tenantSettings.findUnique.mockResolvedValue({ id: "s1", tenantId: "tenant-a", featureFlags: { enableSmsReminders: false, enablePharmacy: true, paystack: true } });
        m.db.tenantSettings.upsert.mockImplementation(async ({ update }: any) => ({ id: "s1", ...update }));
        vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => { for (const k of ["SMS_PROVIDER", "MNOTIFY_API_KEY", "MNOTIFY_SENDER_ID"]) delete process.env[k]; });

    it("saving WITHOUT featureFlags leaves every switch exactly as it was (it used to reset them all)", async () => {
        expect((await post({ platformName: "Dentoc Dental" })).status).toBe(200);
        const arg = m.db.tenantSettings.upsert.mock.calls[0][0];
        expect(arg.update.featureFlags).toBeUndefined();
        expect(arg.update.platformName).toBe("Dentoc Dental");
    });

    it("turning SMS reminders on/off merges into the stored flags", async () => {
        expect((await post({ featureFlags: { enableSmsReminders: true } })).status).toBe(200);
        expect(m.db.tenantSettings.upsert.mock.calls[0][0].update.featureFlags).toEqual({ enablePharmacy: true, paystack: true, enableSmsReminders: true });
    });

    it("rejects unknown settings and non-boolean values with 400 and writes nothing", async () => {
        expect((await post({ featureFlags: { enableSmsReminderz: true } })).status).toBe(400);
        expect((await post({ featureFlags: { enableSmsReminders: "yes" } })).status).toBe(400);
        expect((await post({ featureFlags: ["enableSmsReminders"] })).status).toBe(400);
        expect(m.db.tenantSettings.upsert).not.toHaveBeenCalled();
    });

    it("only owners and admins may change settings", async () => {
        expect((await post({ featureFlags: { enableSmsReminders: true } }, staffToken({ tenantId: "tenant-a", roles: ["RECEPTIONIST"] }))).status).toBe(403);
        expect(m.db.tenantSettings.upsert).not.toHaveBeenCalled();
    });

    it("GET exposes the EFFECTIVE reminder state that booking and the worker enforce", async () => {
        const res = await getSettings(makeRequest("/api/clinic/settings", { token: staffToken({ tenantId: "tenant-a", roles: ["RECEPTIONIST"] }) }));
        const { data } = await res.json();
        expect(data.effective.smsReminders).toEqual({ enabled: false, reason: "DISABLED_BY_CLINIC" });
        delete process.env.SMS_PROVIDER;
        m.db.tenantSettings.findUnique.mockResolvedValue({ id: "s1", tenantId: "tenant-a", featureFlags: {} });
        const again = await (await getSettings(makeRequest("/api/clinic/settings", { token: staffToken({ tenantId: "tenant-a", roles: ["RECEPTIONIST"] }) }))).json();
        expect(again.data.effective.smsReminders).toEqual({ enabled: false, reason: "PROVIDER_UNAVAILABLE" });
    });
});
