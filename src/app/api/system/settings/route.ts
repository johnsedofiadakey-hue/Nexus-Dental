// ============================================
// NEXUS DENTAL — Platform Settings API
// GET/POST /api/system/settings
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, requireSystemOwner, apiError, apiSuccess, JWTPayload } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";

export async function GET(request: NextRequest) {
    try {
        const auth = requireAuth(request);
        if ("error" in auth) return auth.error;

        const systemCheck = requireSystemOwner(auth.user);
        if (systemCheck) return systemCheck;

        const settings = await prisma.platformSettings.findUnique({
            where: { id: "global-settings" }
        });

        return apiSuccess(settings);
    } catch (error: any) {
        console.error("[SystemSettings] GET error:", error);
        return apiError("Failed to fetch settings", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = requireAuth(request);
        if ("error" in auth) return auth.error;

        const systemCheck = requireSystemOwner(auth.user);
        if (systemCheck) return systemCheck;

        const body = await request.json();

        // Update global settings
        const settings = await prisma.platformSettings.upsert({
            where: { id: "global-settings" },
            update: {
                platformName: body.platformName,
                logoUrl: body.logoUrl,
                faviconUrl: body.faviconUrl,
                primaryColor: body.primaryColor,
                secondaryColor: body.secondaryColor,
                supportEmail: body.supportEmail,
                supportPhone: body.supportPhone,
                emailFooter: body.emailFooter,
                maintenanceMode: body.maintenanceMode,
                allowRegistration: body.allowRegistration,
            },
            create: {
                id: "global-settings",
                platformName: body.platformName || "Nexus Dental",
                logoUrl: body.logoUrl,
                faviconUrl: body.faviconUrl,
                primaryColor: body.primaryColor || "#008080",
                secondaryColor: body.secondaryColor || "#FFD700",
                supportEmail: body.supportEmail,
                supportPhone: body.supportPhone,
                emailFooter: body.emailFooter,
                maintenanceMode: body.maintenanceMode || false,
                allowRegistration: body.allowRegistration ?? true,
            }
        });

        // Log the change
        await logAudit({
            userId: (auth.user as JWTPayload).userId,
            action: "SYSTEM_SETTINGS_UPDATE",
            entity: "PlatformSettings",
            entityId: "global-settings",
            newValue: body,
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess(settings);
    } catch (error: any) {
        console.error("[SystemSettings] POST error:", error);
        return apiError("Failed to update settings", 500);
    }
}
