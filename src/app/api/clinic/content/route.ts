// ============================================
// NEXUS DENTAL — Clinic Content CMS API
// GET/POST /api/clinic/content
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, apiError, apiSuccess, JWTPayload } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";

/**
 * GET: Fetch clinic-specific content
 */
export async function GET(request: NextRequest) {
    try {
        const auth = requireAuth(request);
        if ("error" in auth) return auth.error;

        const tenantId = auth.user.tenantId;
        if (!tenantId) return apiError("Tenant context required", 400);

        let content = await prisma.tenantContent.findUnique({
            where: { tenantId }
        });

        // Auto-initialize if empty
        if (!content) {
            content = await prisma.tenantContent.create({
                data: {
                    tenantId,
                    aboutPage: "Welcome to our clinic.",
                    mission: "Providing quality dental care.",
                    vision: "To be the leading dental provider."
                }
            });
        }

        return apiSuccess(content);
    } catch (error: any) {
        console.error("[ClinicContent] GET Error:", error);
        return apiError("Failed to fetch clinic content", 500);
    }
}

/**
 * POST: Update clinic-specific content
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
            return apiError("Forbidden: Only owners/admins can edit content", 403);
        }

        const body = await request.json();

        const content = await prisma.tenantContent.upsert({
            where: { tenantId },
            update: {
                aboutPage: body.aboutPage,
                mission: body.mission,
                vision: body.vision,
                testimonials: body.testimonials || [],
                faqs: body.faqs || [],
                educationArticles: body.educationArticles || [],
            },
            create: {
                tenantId,
                aboutPage: body.aboutPage,
                mission: body.mission,
                vision: body.vision,
                testimonials: body.testimonials || [],
                faqs: body.faqs || [],
                educationArticles: body.educationArticles || [],
            }
        });

        // Audit log
        await logAudit({
            tenantId,
            userId: staffUser.userId,
            action: "UPDATE_CLINIC_CONTENT",
            entity: "TenantContent",
            entityId: content.id,
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess(content);
    } catch (error: any) {
        console.error("[ClinicContent] POST Error:", error);
        return apiError(error.message || "Failed to update clinic content", 500);
    }
}
