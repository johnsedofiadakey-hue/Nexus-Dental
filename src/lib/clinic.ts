import { AuthUser } from "./auth";

// Single-clinic-per-deployment configuration. Set CLINIC_ID in your .env to
// the tenant ID created when you first ran the seed script.
//
// No hardcoded fallback: a deployment with CLINIC_ID unset must fail to
// start rather than silently resolving to some other clinic's tenant ID.
export function getClinicId(): string {
    const id = process.env.CLINIC_ID;
    if (!id) {
        throw new Error(
            "CLINIC_ID environment variable is not set. Refusing to fall back to a hardcoded clinic ID."
        );
    }
    return id;
}

/**
 * Extract tenant ID from authenticated user.
 * For system owners, falls back to CLINIC_ID env var.
 * For staff/patients, returns their assigned tenant.
 *
 * CRITICAL: Use this instead of getClinicId() for authenticated routes.
 * Using getClinicId() in multi-tenant contexts = security hole.
 */
export function getTenantIdFromUser(user: AuthUser): string {
    if (user.type === "SYSTEM_OWNER") {
        // System owners can access any clinic, but default to env var
        return getClinicId();
    }

    // Staff and patients have tenantId in JWT
    if (user.tenantId) {
        return user.tenantId;
    }

    // Fallback (should not reach here if JWT is valid)
    console.warn("[getTenantIdFromUser] User missing tenantId; falling back to CLINIC_ID");
    return getClinicId();
}
