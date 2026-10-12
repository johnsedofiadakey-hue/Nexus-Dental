// ============================================
// NEXUS DENTAL — Clinic Settings API
// GET/POST /api/clinic/settings
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, apiError, apiSuccess, JWTPayload } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import { mergeFeatureFlags, parseFeatureFlagUpdate } from "@/lib/config/features";
import { smsRemindersState } from "@/lib/reminders/settings";

/**
 * GET: Fetch clinic-specific settings
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAuth(request);
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
                        enableSmsReminders: true,
                    }
                }
            });
        }

        // `effective.smsReminders` is what booking and the worker actually enforce: the clinic's
        // switch AND a working SMS provider on this deployment (reason says which is missing).
        return apiSuccess({ ...settings, effective: { smsReminders: await smsRemindersState(tenantId) } });
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
        const auth = await requireAuth(request);
        if ("error" in auth) return auth.error;

        const tenantId = auth.user.tenantId;
        if (!tenantId) return apiError("Tenant context required", 400);

        // Verify role (Clinic Owner or Admin)
        const staffUser = auth.user as JWTPayload;
        const allowedRoles = ["SYSTEM_OWNER", "CLINIC_OWNER", "ADMIN"];
        if (!staffUser.roles.some(r => allowedRoles.includes(r))) {
            return apiError("Forbidden: Only owners/admins can edit settings", 403);
        }

        const body = await request.json();

        // Feature switches are validated and MERGED into what is stored. Omitting featureFlags leaves
        // them exactly as they are (it used to reset every switch to "on").
        let featureFlags: Record<string, unknown> | undefined;
        if (body.featureFlags !== undefined) {
            const parsed = parseFeatureFlagUpdate(body.featureFlags);
            if (!parsed.ok) return apiError(parsed.error, 400);
            const existing = await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { featureFlags: true } });
            featureFlags = mergeFeatureFlags(existing?.featureFlags, parsed.update);
        }

        const settings = await prisma.tenantSettings.upsert({
            where: { tenantId },
            update: {
                platformName: body.platformName,
                logoUrl: body.logoUrl,
                primaryColor: body.primaryColor,
                secondaryColor: body.secondaryColor,
                featureFlags,
                hoursOfOperation: body.hoursOfOperation,
            },
            create: {
                tenantId,
                platformName: body.platformName,
                logoUrl: body.logoUrl,
                primaryColor: body.primaryColor,
                secondaryColor: body.secondaryColor,
                featureFlags: featureFlags ?? {},
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
            newValue: featureFlags ? { featureFlags } : undefined,
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess(settings);
    } catch (error: any) {
        console.error("[ClinicSettings] POST Error:", error);
        return apiError(error.message || "Failed to update clinic settings", 500);
    }
}
