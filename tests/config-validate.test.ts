import { describe, expect, it, vi } from "vitest";
import {
    ConfigError,
    assertRuntimeConfig,
    enforceStartupConfig,
    formatProblems,
    parseEnabledFeatures,
    validateRuntimeConfig,
} from "@/lib/config/validate";
import { getDeploymentMode, isSingleClinicMode } from "@/lib/config/deployment";
import { SECRETS, validEnv, without } from "./helpers/config";

const vars = (env: Record<string, string | undefined>) => validateRuntimeConfig(env).problems.map((p) => p.variable);

describe("deployment mode", () => {
    it("recognises only single_clinic", () => {
        expect(getDeploymentMode({ DEPLOYMENT_MODE: "single_clinic" })).toBe("single_clinic");
        expect(getDeploymentMode({ DEPLOYMENT_MODE: " single_clinic " })).toBe("single_clinic");
        expect(getDeploymentMode({ DEPLOYMENT_MODE: "multi_tenant" })).toBeNull();
        expect(getDeploymentMode({})).toBeNull();
        expect(isSingleClinicMode({})).toBe(false);
    });

    it("reads the environment at call time, not import time", () => {
        const env: Record<string, string | undefined> = {};
        expect(isSingleClinicMode(env)).toBe(false);
        env.DEPLOYMENT_MODE = "single_clinic";
        expect(isSingleClinicMode(env)).toBe(true);
    });
});

describe("validateRuntimeConfig", () => {
    it("accepts a complete configuration", () => {
        const report = validateRuntimeConfig(validEnv());
        expect(report.problems).toEqual([]);
        expect(report.ok).toBe(true);
        expect(report.features).toEqual(["paystack", "hubtel", "resend"]);
    });

    it.each([
        "DEPLOYMENT_MODE",
        "DATABASE_URL",
        "JWT_SECRET",
        "CLINIC_ID",
        "REDIS_URL",
        "NEXT_PUBLIC_APP_URL",
        "NEXT_PUBLIC_FIREBASE_API_KEY",
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "NEXT_PUBLIC_FIREBASE_APP_ID",
        "FIREBASE_STORAGE_BUCKET",
    ])("fails closed when %s is missing", (name) => {
        const report = validateRuntimeConfig(without(validEnv(), name));
        expect(report.ok).toBe(false);
        expect(report.problems).toContainEqual(expect.objectContaining({ variable: name, kind: "missing" }));
    });

    it("treats blank and whitespace-only values as missing", () => {
        expect(vars(validEnv({ JWT_SECRET: "   ", REDIS_URL: "" }))).toEqual(expect.arrayContaining(["JWT_SECRET", "REDIS_URL"]));
    });

    it("rejects invalid values", () => {
        const problems = vars(
            validEnv({
                DEPLOYMENT_MODE: "multi_tenant",
                DATABASE_URL: "mysql://x/y",
                JWT_SECRET: "too-short",
                CLINIC_ID: "Not A Valid Id!",
                REDIS_URL: "http://redis",
                NEXT_PUBLIC_APP_URL: "ftp://app",
            })
        );
        expect(problems).toEqual(
            expect.arrayContaining(["DEPLOYMENT_MODE", "DATABASE_URL", "JWT_SECRET", "CLINIC_ID", "REDIS_URL", "NEXT_PUBLIC_APP_URL"])
        );
    });

    it("rejects template placeholders left in from .env.example", () => {
        expect(vars(validEnv({ JWT_SECRET: "your_jwt_secret_key_change_me_in_production" }))).toContain("JWT_SECRET");
        expect(vars(validEnv({ CLINIC_ID: "your-clinic-id-from-database" }))).toContain("CLINIC_ID");
    });

    it("requires https and a real host for the app URL in production only", () => {
        expect(vars(validEnv({ NEXT_PUBLIC_APP_URL: "http://app.example-dental.test" }))).toContain("NEXT_PUBLIC_APP_URL");
        expect(vars(validEnv({ NEXT_PUBLIC_APP_URL: "https://localhost:3000" }))).toContain("NEXT_PUBLIC_APP_URL");
        expect(vars(validEnv({ NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "http://localhost:3000" }))).not.toContain("NEXT_PUBLIC_APP_URL");
    });

    describe("ENABLED_FEATURES must be explicit in production", () => {
        it("refuses to start in production when it is missing or empty", () => {
            expect(vars(without(validEnv(), "ENABLED_FEATURES"))).toContain("ENABLED_FEATURES");
            expect(vars(validEnv({ ENABLED_FEATURES: "" }))).toContain("ENABLED_FEATURES");
            expect(vars(validEnv({ ENABLED_FEATURES: "  " }))).toContain("ENABLED_FEATURES");
        });

        it('accepts an explicit "none" and an explicit list', () => {
            expect(vars(validEnv({ ENABLED_FEATURES: "none" }))).not.toContain("ENABLED_FEATURES");
            expect(vars(validEnv({ ENABLED_FEATURES: "paystack" }))).not.toContain("ENABLED_FEATURES");
            expect(parseEnabledFeatures("none")).toEqual({ features: [], unknown: [] });
        });

        it("is not required outside production", () => {
            expect(vars(without(validEnv({ NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "http://localhost:3000" }), "ENABLED_FEATURES"))).not.toContain("ENABLED_FEATURES");
        });
    });

    describe("feature-gated secrets", () => {
        it("does not require payment or messaging secrets when those features are off", () => {
            const bare = without(
                validEnv({ ENABLED_FEATURES: "none" }),
                "PAYSTACK_SECRET_KEY", "NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY",
                "HUBTEL_CLIENT_ID", "HUBTEL_CLIENT_SECRET", "HUBTEL_SENDER_ID",
                "RESEND_API_KEY", "EMAIL_FROM"
            );
            expect(validateRuntimeConfig(bare).ok).toBe(true);
        });

        it.each([
            ["paystack", ["PAYSTACK_SECRET_KEY"]],
            ["hubtel", ["HUBTEL_CLIENT_ID", "HUBTEL_CLIENT_SECRET", "HUBTEL_SENDER_ID"]],
            ["resend", ["RESEND_API_KEY", "EMAIL_FROM"]],
            ["telehealth", ["DAILY_API_KEY"]],
        ])("requires %s secrets once the feature is enabled", (feature, required) => {
            const env = without(validEnv({ ENABLED_FEATURES: feature }), ...required);
            expect(vars(env).sort()).toEqual([...required].sort());
        });

        it("rejects unknown feature names", () => {
            expect(vars(validEnv({ ENABLED_FEATURES: "paystack,teleport" }))).toContain("ENABLED_FEATURES");
        });
    });

    it("parses ENABLED_FEATURES tolerantly", () => {
        expect(parseEnabledFeatures(" Paystack , hubtel,,paystack ")).toEqual({ features: ["paystack", "hubtel"], unknown: [] });
        expect(parseEnabledFeatures(undefined)).toEqual({ features: [], unknown: [] });
        expect(parseEnabledFeatures("nope").unknown).toEqual(["nope"]);
    });
});

describe("configuration errors never contain secret values", () => {
    it("names variables and reasons only — across every failure kind", () => {
        const env = validEnv({
            JWT_SECRET: "short",
            DATABASE_URL: "mysql://sentinel_user:SENTINEL-DB-PASSWORD-9f3a@db.sentinel.example/x",
            REDIS_URL: "http://default:SENTINEL-REDIS-PASSWORD-77b1@redis.sentinel.example",
        });
        const text = formatProblems(validateRuntimeConfig(env).problems) + new ConfigError(validateRuntimeConfig(env).problems).message;
        for (const secret of [...Object.values(SECRETS), "SENTINEL-DB-PASSWORD-9f3a", "SENTINEL-REDIS-PASSWORD-77b1", "short"]) {
            expect(text).not.toContain(secret);
        }
        expect(text).toContain("JWT_SECRET");
    });
});

describe("assertRuntimeConfig / enforceStartupConfig", () => {
    it("assertRuntimeConfig throws a ConfigError listing the problems", () => {
        expect(() => assertRuntimeConfig(without(validEnv(), "JWT_SECRET"))).toThrow(ConfigError);
        expect(() => assertRuntimeConfig(validEnv())).not.toThrow();
    });

    it("blocks start-up in production when configuration is incomplete", () => {
        expect(() => enforceStartupConfig(without(validEnv(), "CLINIC_ID"))).toThrow(/CLINIC_ID/);
        expect(() => enforceStartupConfig({ NODE_ENV: "production" })).toThrow(ConfigError);
    });

    it("lets a complete production configuration start", () => {
        expect(enforceStartupConfig(validEnv())?.ok).toBe(true);
    });

    it("only warns outside production, so local development is not blocked", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(() => enforceStartupConfig({ NODE_ENV: "development" })).not.toThrow();
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });

    it("does nothing during `next build`, which has no runtime secrets", () => {
        expect(enforceStartupConfig({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBeNull();
    });
});
