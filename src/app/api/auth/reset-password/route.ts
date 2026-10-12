import { NextRequest } from "next/server";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import redis from "@/lib/db/redis";
import { hashPassword, revokeUserSessions, validatePasswordStrength, apiError, apiSuccess } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import { consumeRateLimit, clientIp } from "@/lib/security/rate-limit";

const RESET_KEY_PREFIX = "pwreset:";

// POST /api/auth/reset-password  { token, password }   (public — the token is the credential)
export async function POST(request: NextRequest) {
    try {
        const limit = await consumeRateLimit(`reset:ip:${clientIp(request.headers)}`, 10, 15 * 60);
        if (!limit.allowed) return apiError("Too many attempts. Try again later.", 429);

        const body = await request.json().catch(() => ({}));
        const token = typeof body.token === "string" ? body.token : "";
        const password = typeof body.password === "string" ? body.password : "";

        if (!token || !/^[a-f0-9]{64}$/.test(token)) {
            return apiError("This reset link is invalid or has expired.", 400);
        }

        const strength = validatePasswordStrength(password);
        if (!strength.valid) return apiError(strength.errors.join(". "), 400);

        const key = `${RESET_KEY_PREFIX}${crypto.createHash("sha256").update(token).digest("hex")}`;

        // GETDEL makes the token strictly single-use even under concurrent requests.
        const userId = await redis.getdel(key);
        if (!userId) return apiError("This reset link is invalid or has expired.", 400);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, tenantId: true, status: true, deletedAt: true },
        });
        if (!user || user.status !== "ACTIVE" || user.deletedAt) {
            return apiError("This reset link is invalid or has expired.", 400);
        }

        const newHash = await hashPassword(password);

        // Password and revocation commit together: if revoking sessions fails the
        // password is not changed, so a compromised session can never outlive a reset.
        const revoked = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
            return revokeUserSessions(tx, user.id, "PASSWORD_RESET");
        });

        await logAudit({
            tenantId: user.tenantId,
            userId: user.id,
            action: "AUTH_PASSWORD_RESET",
            entity: "User",
            entityId: user.id,
            newValue: { sessionsRevoked: revoked },
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess({ reset: true });
    } catch (error) {
        console.error("[Reset Password] Error:", error);
        return apiError("Internal server error", 500);
    }
}
