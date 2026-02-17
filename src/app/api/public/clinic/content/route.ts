// ============================================
// NEXUS DENTAL — Public Clinic Content API
// GET /api/public/clinic/content
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/auth";

/**
 * GET: Fetch public clinic content by tenantId
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");

        if (!tenantId) {
            return apiError("tenantId is required", 400);
        }

        const content = await prisma.tenantContent.findUnique({
            where: { tenantId },
            select: {
                aboutPage: true,
                mission: true,
                vision: true,
                testimonials: true,
                faqs: true,
                educationArticles: true,
            }
        });

        if (!content) {
            return apiError("Clinic content not found", 404);
        }

        return apiSuccess(content);
    } catch (error: any) {
        console.error("[PublicClinicContent] GET Error:", error);
        return apiError("Failed to fetch clinic content", 500);
    }
}
