// ============================================
// NEXUS DENTAL — Auth Middleware
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractTokenFromHeader } from "./jwt";
import { hasPermission, hasAnyPermission } from "./permissions";
import { JWTPayload, PatientJWTPayload, AuthUser } from "./types";

/**
 * Standard API error response.
 */
export function apiError(message: string, status: number = 400) {
    return NextResponse.json(
        { success: false, error: message },
        { status }
    );
}

/**
 * Standard API success response.
 */
export function apiSuccess<T>(data: T, status: number = 200) {
    return NextResponse.json(
        { success: true, data },
        { status }
    );
}

/**
 * Authenticate a request by verifying the JWT token.
 * Returns the decoded user payload or null.
 */
export function authenticateRequest(
    request: NextRequest
): AuthUser | null {
    const authHeader = request.headers.get("authorization");
    const token = extractTokenFromHeader(authHeader);
    if (!token) return null;
    return verifyToken(token);
}

/**
 * Middleware: Require authentication.
 * Returns the user payload or sends a 401 response.
 */
export function requireAuth(
    request: NextRequest
): { user: AuthUser } | { error: NextResponse } {
    const user = authenticateRequest(request);
    if (!user) {
        return { error: apiError("Authentication required", 401) };
    }
    return { user };
}

/**
 * Middleware: Require specific role(s).
 */
export function requireRole(
    user: AuthUser,
    ...roles: string[]
): NextResponse | null {
    const userRole = "role" in user ? user.role : "PATIENT";
    if (!roles.includes(userRole)) {
        return apiError("Insufficient role access", 403);
    }
    return null;
}

/**
 * Middleware: Require specific permission(s).
 * Only applies to staff tokens (not patients).
 */
export function requirePermission(
    user: AuthUser,
    permission: string
): NextResponse | null {
    if (user.type === "PATIENT") {
        return apiError("Patients cannot access this resource", 403);
    }
    const staffUser = user as JWTPayload;
    if (!hasPermission(staffUser.permissions, permission)) {
        return apiError(`Missing permission: ${permission}`, 403);
    }
    return null;
}

/**
 * Middleware: Require any of the specified permissions.
 */
export function requireAnyPermission(
    user: AuthUser,
    permissions: string[]
): NextResponse | null {
    if (user.type === "PATIENT") {
        return apiError("Patients cannot access this resource", 403);
    }
    const staffUser = user as JWTPayload;
    if (!hasAnyPermission(staffUser.permissions, permissions)) {
        return apiError(`Missing required permissions`, 403);
    }
    return null;
}

/**
 * Middleware: Enforce tenant isolation.
 * Ensures the user can only access data for their own tenant.
 * System Owner bypasses this check.
 */
export function enforceTenantScope(
    user: AuthUser,
    requestedTenantId: string
): NextResponse | null {
    // System owners have global access
    if (user.type === "SYSTEM_OWNER") {
        return null;
    }

    // Staff and patients must match tenant
    const userTenantId = user.tenantId;
    if (userTenantId !== requestedTenantId) {
        return apiError("Tenant scope violation", 403);
    }

    return null;
}

/**
 * Middleware: Require System Owner role.
 */
export function requireSystemOwner(
    user: AuthUser
): NextResponse | null {
    if (user.type !== "SYSTEM_OWNER") {
        return apiError("System owner access required", 403);
    }
    return null;
}

/**
 * Get the tenant ID from a user payload.
 * Returns null for system owners.
 */
export function getUserTenantId(user: AuthUser): string | null {
    return user.tenantId;
}

/**
 * Helper to compose multiple middleware checks.
 * Returns the first error encountered, or null if all pass.
 */
export function composeMiddleware(
    ...checks: (NextResponse | null)[]
): NextResponse | null {
    for (const check of checks) {
        if (check !== null) return check;
    }
    return null;
}

/**
 * Type guard: Check if user is a staff member (not a patient).
 */
export function isStaffUser(user: AuthUser): user is JWTPayload {
    return user.type === "STAFF" || user.type === "SYSTEM_OWNER";
}

/**
 * Type guard: Check if user is a patient.
 */
export function isPatientUser(user: AuthUser): user is PatientJWTPayload {
    return user.type === "PATIENT";
}
