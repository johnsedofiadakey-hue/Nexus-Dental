// ============================================
// NEXUS DENTAL — Deployment mode
//
// Every client runs its own isolated deployment (own database, Redis, storage,
// Firebase project, domain, secrets). The only supported mode is therefore
// `single_clinic`: exactly one clinic exists per deployment, and nothing in the
// running application may create a second one.
//
// Read lazily (never at import time) so tests and tooling can change the
// environment between calls.
// ============================================

export const DEPLOYMENT_MODES = ["single_clinic"] as const;
export type DeploymentMode = (typeof DEPLOYMENT_MODES)[number];

export type Env = Record<string, string | undefined>;

/** The configured mode, or null when unset or not a supported value. */
export function getDeploymentMode(env: Env = process.env): DeploymentMode | null {
    const raw = env.DEPLOYMENT_MODE?.trim();
    return raw === "single_clinic" ? "single_clinic" : null;
}

export function isSingleClinicMode(env: Env = process.env): boolean {
    return getDeploymentMode(env) === "single_clinic";
}

/** Machine-readable codes returned alongside the human message. */
export const TENANT_ADMIN_DISABLED_CODE = "TENANT_ADMIN_DISABLED";
export const ONBOARDING_DISABLED_CODE = "ONBOARDING_DISABLED";
