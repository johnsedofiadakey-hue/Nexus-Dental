// ============================================
// NEXUS DENTAL — Services List API
// GET /api/services
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");
        const category = searchParams.get("category");

        if (!tenantId) {
            return apiError("tenantId is required", 400);
        }

        const where: Record<string, unknown> = {
            tenantId,
            isActive: true,
        };

        if (category) {
            where.category = category;
        }

        const services = await prisma.service.findMany({
            where,
            select: {
                id: true,
                name: true,
                description: true,
                category: true,
                price: true,
                duration: true,
                isActive: true,
            },
            orderBy: [{ category: "asc" }, { name: "asc" }],
        });

        return apiSuccess({ services });
    } catch (error) {
        console.error("[Services] Error fetching services:", error);
        return apiError("Internal server error", 500);
    }
}
