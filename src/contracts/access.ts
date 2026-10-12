// ============================================
// NEXUS DENTAL — Effective-access contract
//
// Types only. This is the shape `GET /api/auth/me` returns under `data.access`
// and the shape UI code should read instead of interpreting raw clinic settings,
// legacy `enableTelehealth`-style flags, manifest feature names or environment
// variables. The server normalizes all of those into this one vocabulary.
//
// Nothing here ever carries a configuration value, key or secret — only whether
// a capability is usable.
// ============================================

export const ACCESS_CONTRACT_VERSION = 1 as const;

/** Who is asking. */
export type AccessSubject = "STAFF" | "SYSTEM_OWNER" | "PATIENT";

/** `unconfigured` only occurs in local development; a real deployment is `single_clinic`. */
export type AccessDeploymentMode = "single_clinic" | "unconfigured";

/** Patient- and staff-facing product areas a clinic can switch on or off. */
export const MODULE_KEYS = ["patientPortal", "onlineConsultation", "pharmacy", "telehealth", "smsReminders"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

/** Third-party services the deployment is wired to. Distinct from modules. */
export const PROVIDER_KEYS = ["paystack", "hubtel", "resend", "mnotify"] as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[number];

/** Anything a later API packet may gate on. */
export type CapabilityKey = ModuleKey | ProviderKey;

/**
 * Why something is off:
 *  - `DISABLED_BY_CLINIC`   — the clinic switched the module off in its settings.
 *  - `PROVIDER_UNAVAILABLE` — a module needs a provider this deployment lacks (telehealth video).
 *  - `NOT_CONFIGURED`       — a provider is not enabled for this deployment or has no credentials.
 */
export type CapabilityReason = "DISABLED_BY_CLINIC" | "PROVIDER_UNAVAILABLE" | "NOT_CONFIGURED";

export interface CapabilityState {
    enabled: boolean;
    /** Present only when `enabled` is false. */
    reason?: CapabilityReason;
}

export type ModuleCapabilities = Record<ModuleKey, CapabilityState>;
export type ProviderCapabilities = Record<ProviderKey, CapabilityState>;

export interface AccessContract {
    version: typeof ACCESS_CONTRACT_VERSION;
    deploymentMode: AccessDeploymentMode;
    subject: AccessSubject;
    /** Highest-authority role; "PATIENT" for patients. */
    role: string;
    roles: string[];
    /** Effective permissions, re-resolved on the server for this request. Empty for patients. */
    permissions: string[];
    /** Clinic-controlled product areas. */
    modules: ModuleCapabilities;
    /** Deployment-level integrations. Never contains keys or ids. */
    providers: ProviderCapabilities;
}

/** Machine-readable code returned whenever a disabled capability is requested. */
export const FEATURE_DISABLED_CODE = "FEATURE_DISABLED" as const;
export type FeatureDisabledCode = typeof FEATURE_DISABLED_CODE;

/** Body of the HTTP 403 every "feature is off" API response uses. */
export interface FeatureDisabledError {
    success: false;
    error: string;
    code: FeatureDisabledCode;
    feature: CapabilityKey;
    reason: CapabilityReason;
}

/** The success envelope of `GET /api/auth/me` (existing fields are kept alongside `access`). */
export interface AuthMeData {
    type: AccessSubject;
    role: string;
    roles: string[];
    access: AccessContract;
    /** Legacy: staff only, kept for existing UI. Prefer `access.permissions`. */
    permissions?: string[];
    /** Legacy: kept for existing UI; always `[]` now. Prefer `access.modules` / `access.providers`. */
    featureFlags?: string[];
    [profileField: string]: unknown;
}
