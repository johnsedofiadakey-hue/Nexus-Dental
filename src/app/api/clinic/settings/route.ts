// ============================================
// NEXUS DENTAL — Clinic Settings API
// GET/POST /api/clinic/settings
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, apiError, apiSuccess, JWTPayload } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";

/**
 * GET: Fetch clinic-specific settings
 */
export async function GET(request: NextRequest) {
    try {
        const auth = requireAuth(request);
        if ("error" in auth) return auth.error;

        const tenantId = auth.user.tenantId;
        if (!tenantId) return apiError("Tenant context required", 400);

        let settings = await prisma.tenantSettings.findUnique({
            where: { tenantId }
        });

        // Auto-initialize if empty
        if (!settings) {
            settings = await prisma.tenantSettings.create({
                data: {
                    tenantId,
                    featureFlags: {
                        enableOnlineConsultation: true,
                        enablePharmacy: true,
                        enableTelehealth: true,
                        enablePatientPortal: true,
                    }
                }
            });
        }

        return apiSuccess(settings);
    } catch (error: any) {
        console.error("[ClinicSettings] GET Error:", error);
        return apiError("Failed to fetch clinic settings", 500);
    }
}

/**
 * POST: Update clinic-specific settings
 */
export async function POST(request: NextRequest) {
    try {
        const auth = requireAuth(request);
        if ("error" in auth) return auth.error;

        const tenantId = auth.user.tenantId;
        if (!tenantId) return apiError("Tenant context required", 400);

        // Verify role (Clinic Owner or Admin)
        const staffUser = auth.user as JWTPayload;
        const allowedRoles = ["SYSTEM_OWNER", "CLINIC_OWNER", "ADMIN"];
        if (!allowedRoles.includes(staffUser.role)) {
            return apiError("Forbidden: Only owners/admins can edit settings", 403);
        }

        const body = await request.json();

        const settings = await prisma.tenantSettings.upsert({
            where: { tenantId },
            update: {
                platformName: body.platformName,
                logoUrl: body.logoUrl,
                primaryColor: body.primaryColor,
                secondaryColor: body.secondaryColor,
                featureFlags: body.featureFlags || {},
                hoursOfOperation: body.hoursOfOperation,
            },
            create: {
                tenantId,
                platformName: body.platformName,
                logoUrl: body.logoUrl,
                primaryColor: body.primaryColor,
                secondaryColor: body.secondaryColor,
                featureFlags: body.featureFlags || {},
                hoursOfOperation: body.hoursOfOperation,
            }
        });

        // Audit log
        await logAudit({
            tenantId,
            userId: staffUser.userId,
            action: "UPDATE_CLINIC_SETTINGS",
            entity: "TenantSettings",
            entityId: settings.id,
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess(settings);
    } catch (error: any) {
        console.error("[ClinicSettings] POST Error:", error);
        return apiError(error.message || "Failed to update clinic settings", 500);
    }
}
