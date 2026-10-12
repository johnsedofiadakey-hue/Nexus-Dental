// ============================================
// NEXUS DENTAL — Capability resolution
//
// Turns the three places "is X on?" is stored — the clinic's own settings
// (including legacy flag names), the deployment's ENABLED_FEATURES list, and
// which provider credentials are actually present — into one normalized
// answer for the access contract. Reports presence only, never values.
// ============================================

import { NextResponse } from "next/server";
import {
    FEATURE_DISABLED_CODE,
    MODULE_KEYS,
    PROVIDER_KEYS,
    type AccessDeploymentMode,
    type CapabilityKey,
    type CapabilityReason,
    type CapabilityState,
    type FeatureDisabledError,
    type ModuleCapabilities,
    type ModuleKey,
    type ProviderCapabilities,
    type ProviderKey,
} from "@/contracts/access";
import { getDeploymentMode, type Env } from "./deployment";
import { FEATURE_REQUIREMENTS, parseEnabledFeatures } from "./validate";

/** Every spelling we have ever stored, reduced to the canonical module key. */
const MODULE_ALIASES: Record<string, ModuleKey> = {
    patientportal: "patientPortal",
    onlineconsultation: "onlineConsultation",
    pharmacy: "pharmacy",
    telehealth: "telehealth",
    smsreminders: "smsReminders",
    smsreminder: "smsReminders",
};

/** `enableTelehealth`, `enable_telehealth`, `TELEHEALTH`, `online-consultation` → `onlineconsultation`. */
function aliasKey(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .replace(/^enable/, "");
}

/**
 * Normalize clinic feature settings. Accepts the object form
 * (`{ enableTelehealth: false }`), the array form (`["telehealth"]`, meaning "on"),
 * or anything else (treated as no information). Unknown keys are ignored.
 * A module the settings say nothing about is left out (callers default it to on).
 */
export function normalizeModuleFlags(raw: unknown): Partial<Record<ModuleKey, boolean>> {
    const out: Partial<Record<ModuleKey, boolean>> = {};
    if (Array.isArray(raw)) {
        for (const entry of raw) {
            if (typeof entry !== "string") continue;
            const key = MODULE_ALIASES[aliasKey(entry)];
            if (key) out[key] = true;
        }
    } else if (raw && typeof raw === "object") {
        for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
            const key = MODULE_ALIASES[aliasKey(name)];
            if (key && typeof value === "boolean") out[key] = value;
        }
    }
    return out;
}

function providerState(provider: ProviderKey | "telehealth", env: Env): CapabilityState {
    const { features } = parseEnabledFeatures(env.ENABLED_FEATURES);
    const unset = (env.ENABLED_FEATURES ?? "").trim() === "";
    // Production never infers features from which secrets happen to exist: an
    // unset/empty list enables nothing. Outside production (local dev) an unset
    // list falls back to "whatever is configured".
    const listed = unset ? env.NODE_ENV !== "production" : features.includes(provider);
    const configured = FEATURE_REQUIREMENTS[provider].every((name) => Boolean(env[name]?.trim()));
    return listed && configured ? { enabled: true } : { enabled: false, reason: "NOT_CONFIGURED" };
}

export function resolveProviders(env: Env = process.env): ProviderCapabilities {
    const out = {} as ProviderCapabilities;
    for (const key of PROVIDER_KEYS) out[key] = providerState(key, env);
    return out;
}

export function resolveModules(flags: unknown, env: Env = process.env): ModuleCapabilities {
    const normalized = normalizeModuleFlags(flags);
    const out = {} as ModuleCapabilities;
    for (const key of MODULE_KEYS) {
        if (normalized[key] === false) {
            out[key] = { enabled: false, reason: "DISABLED_BY_CLINIC" };
        } else {
            out[key] = { enabled: true };
        }
    }
    // SMS reminders need the clinic switch AND a working SMS provider on this deployment.
    if (out.smsReminders.enabled && !providerState("mnotify", env).enabled) {
        out.smsReminders = { enabled: false, reason: "PROVIDER_UNAVAILABLE" };
    }
    // Video consultations also need the telehealth provider on this deployment.
    if (out.telehealth.enabled && !providerState("telehealth", env).enabled) {
        out.telehealth = { enabled: false, reason: "PROVIDER_UNAVAILABLE" };
    }
    return out;
}

export function resolveDeploymentMode(env: Env = process.env): AccessDeploymentMode {
    return getDeploymentMode(env) ?? "unconfigured";
}

// ─────────────────────────────────────────────
// The one reusable "feature is off" response
// ─────────────────────────────────────────────

const FEATURE_LABELS: Record<CapabilityKey, string> = {
    patientPortal: "The patient portal",
    onlineConsultation: "Online consultation",
    pharmacy: "Pharmacy",
    telehealth: "Video consultation",
    paystack: "Online card and mobile-money payments",
    hubtel: "Payments and WhatsApp messaging",
    resend: "Email messaging",
    mnotify: "SMS messaging",
    smsReminders: "SMS appointment reminders",
};

/**
 * HTTP 403 with `code: "FEATURE_DISABLED"`. Use this for every API that is
 * unavailable because its module or provider is off, so the UI handles exactly
 * one error shape. Carries no configuration detail.
 */
export function featureDisabledResponse(
    feature: CapabilityKey,
    reason: CapabilityReason = "DISABLED_BY_CLINIC"
): NextResponse<FeatureDisabledError> {
    return NextResponse.json(
        {
            success: false as const,
            error: `${FEATURE_LABELS[feature]} is not available at this clinic.`,
            code: FEATURE_DISABLED_CODE,
            feature,
            reason,
        },
        { status: 403 }
    );
}

/** Returns the 403 response when `state` is off, otherwise null. */
export function requireCapability(
    feature: CapabilityKey,
    state: CapabilityState
): NextResponse<FeatureDisabledError> | null {
    return state.enabled ? null : featureDisabledResponse(feature, state.reason);
}

// ─────────────────────────────────────────────
// Validated writes of the clinic's own module switches
// ─────────────────────────────────────────────

/** The names the dashboard already reads and writes. */
export const STORED_MODULE_KEYS: Record<ModuleKey, string> = {
    patientPortal: "enablePatientPortal",
    onlineConsultation: "enableOnlineConsultation",
    pharmacy: "enablePharmacy",
    telehealth: "enableTelehealth",
    smsReminders: "enableSmsReminders",
};

export type FlagUpdate = { ok: true; update: Partial<Record<ModuleKey, boolean>> } | { ok: false; error: string };

/**
 * Validate a client-supplied featureFlags object: a plain object, only known module
 * switches (any historical spelling), every value a real boolean. Unknown keys and
 * non-booleans are REJECTED, not silently dropped - a typo must not look like a saved setting.
 */
export function parseFeatureFlagUpdate(raw: unknown): FlagUpdate {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "featureFlags must be an object of true/false values." };
    const update: Partial<Record<ModuleKey, boolean>> = {};
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
        const key = MODULE_ALIASES[aliasKey(name)];
        if (!key) return { ok: false, error: `Unknown setting "${name.slice(0, 40)}".` };
        if (typeof value !== "boolean") return { ok: false, error: `"${name.slice(0, 40)}" must be true or false.` };
        update[key] = value;
    }
    return { ok: true, update };
}

/** Apply a validated update to what is stored, leaving every other stored key untouched. */
export function mergeFeatureFlags(existing: unknown, update: Partial<Record<ModuleKey, boolean>>): Record<string, unknown> {
    const base = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...(existing as Record<string, unknown>) } : {};
    for (const [key, value] of Object.entries(update) as Array<[ModuleKey, boolean]>) {
        // Drop any older spelling of the same switch so the stored value is unambiguous.
        for (const stored of Object.keys(base)) if (MODULE_ALIASES[aliasKey(stored)] === key) delete base[stored];
        base[STORED_MODULE_KEYS[key]] = value;
    }
    return base;
}
