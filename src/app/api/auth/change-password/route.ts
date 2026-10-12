import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    verifyPassword,
    hashPassword,
    signToken,
    createStaffSession,
    revokeUserSessions,
    validatePasswordStrength,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import { consumeRateLimit, resetRateLimit } from "@/lib/security/rate-limit";

// POST /api/auth/change-password  { currentPassword, newPassword }
// Staff only. Requires the current password so a stolen session alone cannot
// take over the account.
export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        if (user.type === "PATIENT") {
            return apiError("Patients sign in with a phone code and have no password", 403);
        }
        const staff = user as JWTPayload;

        const limitKey = `change-password:${staff.userId}`;
        const limit = await consumeRateLimit(limitKey, 5, 15 * 60);
        if (!limit.allowed) {
            return apiError("Too many attempts. Please wait and try again.", 429);
        }

        const body = await request.json().catch(() => ({}));
        const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
        const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

        if (!currentPassword || !newPassword) {
            return apiError("Current and new password are required", 400);
        }

        const strength = validatePasswordStrength(newPassword);
        if (!strength.valid) {
            return apiError(strength.errors.join(". "), 400);
        }
        if (newPassword === currentPassword) {
            return apiError("New password must be different from the current password", 400);
        }

        const account = await prisma.user.findUnique({
            where: { id: staff.userId },
            select: { id: true, tenantId: true, passwordHash: true, status: true },
        });
        if (!account || account.status !== "ACTIVE") {
            return apiError("Account not available", 403);
        }

        const currentOk = await verifyPassword(currentPassword, account.passwordHash);
        if (!currentOk) {
            return apiError("Current password is incorrect", 400);
        }

        const newHash = await hashPassword(newPassword);

        // One transaction: the new password, the revocation of EVERY earlier
        // session, and this device's fresh session commit together or not at
        // all. If revocation fails the password is not changed (fail closed).
        const fresh = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.user.update({ where: { id: account.id }, data: { passwordHash: newHash } });
            const revoked = await revokeUserSessions(tx, account.id, "PASSWORD_CHANGED");
            const session = await createStaffSession(tx, {
                userId: account.id,
                tenantId: account.tenantId,
                userAgent: getUserAgent(request.headers),
            });
            return { session, revoked };
        });

        await resetRateLimit(limitKey);
        await logAudit({
            tenantId: account.tenantId,
            userId: account.id,
            action: "AUTH_PASSWORD_CHANGED",
            entity: "User",
            entityId: account.id,
            newValue: { sessionsRevoked: fresh.revoked },
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        // Re-sign the caller in on this device so only the OTHER sessions are lost.
        const res = apiSuccess({ changed: true });
        res.cookies.set(
            "nexus_token",
            signToken({
                userId: staff.userId,
                tenantId: staff.tenantId,
                role: staff.role,
                roles: staff.roles,
                permissions: staff.permissions,
                featureFlags: [],
                type: staff.type,
                sid: fresh.session.sid,
            }),
            {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: fresh.session.maxAgeSeconds,
            }
        );
        return res;
    } catch (error) {
        console.error("[Change Password] Error:", error);
        return apiError("Internal server error", 500);
    }
}
