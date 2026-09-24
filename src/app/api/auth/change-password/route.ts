import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    verifyPassword,
    hashPassword,
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
        const authResult = requireAuth(request);
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

        await prisma.user.update({
            where: { id: account.id },
            data: { passwordHash: await hashPassword(newPassword) },
        });

        await resetRateLimit(limitKey);
        await logAudit({
            tenantId: account.tenantId,
            userId: account.id,
            action: "AUTH_PASSWORD_CHANGED",
            entity: "User",
            entityId: account.id,
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess({ changed: true });
    } catch (error) {
        console.error("[Change Password] Error:", error);
        return apiError("Internal server error", 500);
    }
}
