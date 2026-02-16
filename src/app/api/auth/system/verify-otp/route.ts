// ============================================
// NEXUS DENTAL — System Owner OTP Verification
// POST /api/auth/system/verify-otp
//
// Used for re-authentication on critical actions
// (kill switch, backup restore, API key rotation)
// ============================================

import { NextRequest } from "next/server";
import { requireAuth, requireSystemOwner, verifyOTP as verifyOTPService, apiError, apiSuccess } from "@/lib/auth";
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
        const { otp, action } = body;

        if (!otp || !action) {
            return apiError("OTP and action description are required", 400);
        }

        // Verify OTP (system owner OTPs use a special tenant key)
        const otpResult = await verifyOTPService(SYSTEM_TENANT_KEY, user.userId, otp);
        if (!otpResult.valid) {
            // Log failed verification attempt
            await logAudit({
                tenantId: null,
                userId: user.userId,
                action: "SYSTEM_OTP_FAILED",
                entity: "SystemOwner",
                entityId: user.userId,
                newValue: { action, error: otpResult.error },
                ipAddress: getClientIP(request.headers),
                userAgent: getUserAgent(request.headers),
            });
            return apiError(otpResult.error || "Invalid OTP", 401);
        }

        // Log successful OTP verification
        await logAudit({
            tenantId: null,
            userId: user.userId,
            action: "SYSTEM_OTP_VERIFIED",
            entity: "SystemOwner",
            entityId: user.userId,
            newValue: { action },
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess({
            verified: true,
            action,
            message: "OTP verified. Proceed with critical action.",
        });
    } catch (error) {
        console.error("[System] OTP verification error:", error);
        return apiError("Internal server error", 500);
    }
}
