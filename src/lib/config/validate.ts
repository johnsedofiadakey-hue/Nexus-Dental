// ============================================
// NEXUS DENTAL — Runtime configuration validation
//
// One function decides whether a deployment is configured well enough to
// serve traffic. It is used three ways:
//   1. at server start (src/instrumentation.ts) — fail closed in production,
//   2. by `npm run config:check` as a pre-release gate,
//   3. by `npm run clinic:provision` before it touches the database.
//
// SAFETY: problems carry the variable NAME and a generic reason only. A value
// is never placed in a message, because these messages end up in logs.
// ============================================

import { DEPLOYMENT_MODES, getDeploymentMode, type Env } from "./deployment";

/** Explicit "this clinic uses none of the optional features" value for ENABLED_FEATURES. */
export const NO_FEATURES = "none";

export const FEATURE_NAMES = ["paystack", "hubtel", "resend", "telehealth", "mnotify"] as const;
export type FeatureName = (typeof FEATURE_NAMES)[number];

/** Clinic ids double as the tenant primary key, so keep them URL- and SQL-friendly. */
export const CLINIC_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

/** Variables each optional feature requires once it is enabled. */
export const FEATURE_REQUIREMENTS: Record<FeatureName, readonly string[]> = {
    // Hosted Checkout is initialized and verified server-side; no browser public key is used.
    paystack: ["PAYSTACK_SECRET_KEY"],
    hubtel: ["HUBTEL_CLIENT_ID", "HUBTEL_CLIENT_SECRET", "HUBTEL_SENDER_ID"],
    resend: ["RESEND_API_KEY", "EMAIL_FROM"],
    telehealth: ["DAILY_API_KEY"],
    // SMS (appointment reminders). Hubtel stays for payments/WhatsApp; it is never an SMS fallback.
    mnotify: ["MNOTIFY_API_KEY", "MNOTIFY_SENDER_ID"],
};

/** Always required, whatever features are enabled. */
const ALWAYS_REQUIRED_PRESENT = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "FIREBASE_STORAGE_BUCKET",
] as const;

export interface ConfigProblem {
    variable: string;
    kind: "missing" | "invalid";
    /** Generic, value-free explanation. */
    message: string;
}

export interface ConfigReport {
    ok: boolean;
    problems: ConfigProblem[];
    features: FeatureName[];
}

export class ConfigError extends Error {
    readonly problems: ConfigProblem[];
    constructor(problems: ConfigProblem[]) {
        super(`Invalid deployment configuration — ${formatProblems(problems)}`);
        this.name = "ConfigError";
        this.problems = problems;
    }
}

/** "VAR (missing), OTHER (invalid: reason)" — names and reasons only. */
export function formatProblems(problems: readonly ConfigProblem[]): string {
    return problems
        .map((p) => (p.kind === "missing" ? `${p.variable} (missing)` : `${p.variable} (invalid: ${p.message})`))
        .join(", ");
}

/** Parse the comma-separated ENABLED_FEATURES variable. */
export function parseEnabledFeatures(raw: string | undefined): { features: FeatureName[]; unknown: string[] } {
    const features: FeatureName[] = [];
    const unknown: string[] = [];
    for (const part of (raw ?? "").split(",")) {
        const name = part.trim().toLowerCase();
        if (!name || name === NO_FEATURES) continue;
        if ((FEATURE_NAMES as readonly string[]).includes(name)) {
            if (!features.includes(name as FeatureName)) features.push(name as FeatureName);
        } else if (!unknown.includes(name)) {
            unknown.push(name);
        }
    }
    return { features, unknown };
}

const PLACEHOLDER = /(change[-_ ]?me|^your[-_]|placeholder|xxxx|<.*>)/i;

function isUrl(value: string, protocols: readonly string[]): URL | null {
    try {
        const url = new URL(value);
        return protocols.includes(url.protocol) ? url : null;
    } catch {
        return null;
    }
}

export function validateRuntimeConfig(env: Env): ConfigReport {
    const problems: ConfigProblem[] = [];
    const missing = (variable: string) => problems.push({ variable, kind: "missing", message: "not set" });
    const invalid = (variable: string, message: string) => problems.push({ variable, kind: "invalid", message });
    const get = (name: string) => env[name]?.trim() || undefined;
    const isProduction = env.NODE_ENV === "production";

    // ── Deployment mode ────────────────────────────────────────────────────
    if (!get("DEPLOYMENT_MODE")) {
        missing("DEPLOYMENT_MODE");
    } else if (!getDeploymentMode(env)) {
        invalid("DEPLOYMENT_MODE", `must be one of: ${DEPLOYMENT_MODES.join(", ")}`);
    }

    // ── Core secrets and endpoints ─────────────────────────────────────────
    const databaseUrl = get("DATABASE_URL");
    if (!databaseUrl) missing("DATABASE_URL");
    else if (!isUrl(databaseUrl, ["postgres:", "postgresql:"])) invalid("DATABASE_URL", "must be a postgres:// or postgresql:// URL");

    const jwtSecret = get("JWT_SECRET");
    if (!jwtSecret) missing("JWT_SECRET");
    else if (jwtSecret.length < 32) invalid("JWT_SECRET", "must be at least 32 characters");
    else if (PLACEHOLDER.test(jwtSecret)) invalid("JWT_SECRET", "looks like a template placeholder");

    const clinicId = get("CLINIC_ID");
    if (!clinicId) missing("CLINIC_ID");
    else if (!CLINIC_ID_PATTERN.test(clinicId)) invalid("CLINIC_ID", "must be 3-64 lowercase letters, digits or hyphens");
    else if (/^your-|from-database/.test(clinicId)) invalid("CLINIC_ID", "looks like a template placeholder");

    const redisUrl = get("REDIS_URL");
    if (!redisUrl) missing("REDIS_URL");
    else if (!isUrl(redisUrl, ["redis:", "rediss:"])) invalid("REDIS_URL", "must be a redis:// or rediss:// URL");

    const appUrl = get("NEXT_PUBLIC_APP_URL");
    if (!appUrl) {
        missing("NEXT_PUBLIC_APP_URL");
    } else {
        const url = isUrl(appUrl, ["http:", "https:"]);
        if (!url) invalid("NEXT_PUBLIC_APP_URL", "must be an http(s) URL");
        else if (isProduction && url.protocol !== "https:") invalid("NEXT_PUBLIC_APP_URL", "must use https in production");
        else if (isProduction && /^(localhost|127\.|0\.0\.0\.0)/.test(url.hostname)) invalid("NEXT_PUBLIC_APP_URL", "must not point at localhost in production");
    }

    // ── Firebase (per-clinic project) ──────────────────────────────────────
    for (const name of ALWAYS_REQUIRED_PRESENT) {
        if (!get(name)) missing(name);
    }

    // ── Optional features: their secrets are required only when enabled ────
    // Production must state its features explicitly (a comma list, or "none").
    // A missing or empty value is refused rather than guessed, and the runtime
    // resolver independently treats it as "nothing enabled".
    if (isProduction && !get("ENABLED_FEATURES")) {
        problems.push({
            variable: "ENABLED_FEATURES",
            kind: "missing",
            message: `must be set explicitly in production: a comma list of ${FEATURE_NAMES.join(", ")}, or "${NO_FEATURES}"`,
        });
    }
    const { features, unknown } = parseEnabledFeatures(env.ENABLED_FEATURES);
    if (unknown.length > 0) {
        invalid("ENABLED_FEATURES", `unknown feature name(s); allowed: ${FEATURE_NAMES.join(", ")}`);
    }
    for (const feature of features) {
        for (const name of FEATURE_REQUIREMENTS[feature]) {
            if (!get(name)) problems.push({ variable: name, kind: "missing", message: `required because feature "${feature}" is enabled` });
        }
    }

    // ── SMS and demo mode ──────────────────────────────────────────────────
    const smsProvider = get("SMS_PROVIDER")?.toLowerCase();
    if (smsProvider !== undefined) {
        if (smsProvider !== "mnotify" && !(smsProvider === "console" && !isProduction)) {
            invalid("SMS_PROVIDER", isProduction ? 'must be "mnotify"' : 'must be "mnotify" (or "console" outside production)');
        }
        if (smsProvider === "mnotify") {
            if (!features.includes("mnotify")) {
                problems.push({ variable: "ENABLED_FEATURES", kind: "invalid", message: 'must list "mnotify" because SMS_PROVIDER=mnotify' });
            }
            const sender = get("MNOTIFY_SENDER_ID");
            if (sender && !/^[A-Za-z0-9 ]{1,11}$/.test(sender)) invalid("MNOTIFY_SENDER_ID", "must be 1-11 letters, digits or spaces");
        }
    }
    if (features.includes("mnotify") && smsProvider !== "mnotify") {
        problems.push({ variable: "SMS_PROVIDER", kind: "missing", message: 'must be "mnotify" because feature "mnotify" is enabled' });
    }
    if (get("DEMO_MODE")?.toLowerCase() === "true") {
        const list = (get("DEMO_SMS_ALLOWLIST") ?? "").split(/[\s,;]+/).filter(Boolean);
        if (list.length === 0) {
            problems.push({ variable: "DEMO_SMS_ALLOWLIST", kind: "missing", message: "required while DEMO_MODE=true (comma-separated E.164 numbers the demo may text)" });
        } else if (!list.every((n) => /^\+[1-9]\d{7,14}$/.test(n))) {
            invalid("DEMO_SMS_ALLOWLIST", "every entry must be an E.164 number such as +233200000000");
        }
    }

    return { ok: problems.length === 0, problems, features };
}

export function assertRuntimeConfig(env: Env): ConfigReport {
    const report = validateRuntimeConfig(env);
    if (!report.ok) throw new ConfigError(report.problems);
    return report;
}

/**
 * Startup gate, called once from src/instrumentation.ts.
 *
 * - During `next build` it does nothing (the build machine holds no runtime secrets).
 * - In production it THROWS, so a misconfigured release never serves traffic.
 * - Elsewhere it only warns, so local development isn't blocked.
 */
export function enforceStartupConfig(env: Env = process.env): ConfigReport | null {
    if (env.NEXT_PHASE === "phase-production-build") return null;

    const report = validateRuntimeConfig(env);
    if (report.ok) return report;

    if (env.NODE_ENV === "production") throw new ConfigError(report.problems);

    console.warn(`[Config] Deployment configuration incomplete (non-production, continuing): ${formatProblems(report.problems)}`);
    return report;
}
