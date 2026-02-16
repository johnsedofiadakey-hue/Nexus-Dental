// ============================================
// NEXUS DENTAL — System Owner OTP Request
// POST /api/auth/system/request-otp
//
// Sends an OTP to system owner for critical action
// re-authentication.
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, requireSystemOwner, generateOTP, storeOTP, apiError, apiSuccess } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import type { JWTPayload } from "@/lib/auth";

const SYSTEM_TENANT_KEY = "system";

export async function POST(request: NextRequest) {
    try {
        // Require authenticated system owner
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;

        const roleCheck = requireSystemOwner(authResult.user);
        if (roleCheck) return roleCheck;

        const user = authResult.user as JWTPayload;
        const body = await request.json();
        const { action } = body;

        if (!action) {
            return apiError("Action description is required", 400);
        }

        // Get system owner details for notification
        const systemOwner = await prisma.user.findUnique({
            where: { id: user.userId },
        });

        if (!systemOwner) {
            return apiError("System owner not found", 404);
        }

        // Generate and store OTP
        const otp = generateOTP();
        await storeOTP(SYSTEM_TENANT_KEY, user.userId, otp);

        // TODO: Send OTP to system owner via email (Resend/SendGrid)
        // For now, log in development
        if (process.env.NODE_ENV === "development") {
            console.log(`[System OTP] Code for ${systemOwner.email}: ${otp}`);
        }

        // Log audit
        await logAudit({
            tenantId: null,
            userId: user.userId,
            action: "SYSTEM_OTP_REQUESTED",
            entity: "SystemOwner",
            entityId: user.userId,
            newValue: { action },
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess({
            message: "OTP sent to your registered email",
            ...(process.env.NODE_ENV === "development" ? { otp } : {}),
        });
    } catch (error) {
        console.error("[System] OTP request error:", error);
        return apiError("Internal server error", 500);
    }
}
