import { NextRequest } from "next/server";
import { signToken, signPatientToken } from "@/lib/auth/jwt";
import { DEFAULT_ROLE_PERMISSIONS, type UserRoleType } from "@/lib/auth/types";

/** A real, signed staff JWT for the given clinic and role(s). */
export function staffToken(opts: { userId?: string; tenantId: string; roles: UserRoleType[] }) {
    const role = opts.roles[0];
    const permissions = Array.from(new Set(opts.roles.flatMap((r) => DEFAULT_ROLE_PERMISSIONS[r])));
    return signToken({
        userId: opts.userId ?? `user-${role.toLowerCase()}-${opts.tenantId}`,
        tenantId: opts.tenantId,
        role,
        roles: opts.roles,
        permissions,
        featureFlags: [],
        type: "STAFF",
    });
}

/** A real, signed patient JWT. */
export function patientToken(opts: { patientId: string; tenantId: string }) {
    return signPatientToken({
        patientId: opts.patientId,
        tenantId: opts.tenantId,
        role: "PATIENT",
        type: "PATIENT",
    });
}

/** Build a NextRequest the way a browser/API client would, with a Bearer token. */
export function makeRequest(
    path: string,
    opts: { method?: string; token?: string; body?: unknown } = {}
) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    return new NextRequest(`http://localhost${path}`, {
        method: opts.method ?? "GET",
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
}

/** Next.js 15 passes route params as a Promise. */
export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

/** A real, signed platform (system owner) JWT — not tied to any clinic. */
export function systemOwnerToken(userId = "sys-owner") {
    return signToken({
        userId,
        tenantId: null,
        role: "SYSTEM_OWNER",
        roles: ["SYSTEM_OWNER"],
        permissions: DEFAULT_ROLE_PERMISSIONS.SYSTEM_OWNER,
        featureFlags: [],
        type: "SYSTEM_OWNER",
    });
}
