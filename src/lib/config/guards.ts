// ============================================
// NEXUS DENTAL — Route guards for deployment mode
// ============================================

import { NextResponse } from "next/server";
import {
    isSingleClinicMode,
    ONBOARDING_DISABLED_CODE,
    TENANT_ADMIN_DISABLED_CODE,
    type Env,
} from "./deployment";

/**
 * Platform tenant administration (list / create / update / freeze tenants) only
 * makes sense for a shared multi-clinic platform. A single-clinic deployment has
 * exactly one clinic, so these endpoints are switched off entirely.
 *
 * Returns a 403 response to send, or null when the endpoint may proceed.
 * Call it AFTER authentication so anonymous callers still just get a 401.
 */
export function tenantAdminDisabledResponse(env: Env = process.env): NextResponse | null {
    if (!isSingleClinicMode(env)) return null;
    return NextResponse.json(
        {
            success: false,
            error: "Tenant administration is disabled: this is a single-clinic deployment.",
            code: TENANT_ADMIN_DISABLED_CODE,
        },
        { status: 403 }
    );
}

/** Browser self-registration is retired in favour of `npm run clinic:provision`. */
export function onboardingDisabledResponse(): NextResponse {
    return NextResponse.json(
        {
            success: false,
            error: "Self-registration is disabled. Clinics are provisioned by an operator with `npm run clinic:provision`.",
            code: ONBOARDING_DISABLED_CODE,
        },
        { status: 410 }
    );
}
