import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, enforceTenantScope, requirePermission, PERMISSIONS, apiError, apiSuccess } from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");
        const category = searchParams.get("category");
        const includeInactive = searchParams.get("includeInactive") === "true";

        if (!tenantId) return apiError("tenantId is required", 400);

        const where: Record<string, unknown> = { tenantId };
        if (!includeInactive) where.isActive = true;
        if (category) where.category = category;

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
                createdAt: true,
                _count: { select: { appointments: true } },
            },
            orderBy: [{ category: "asc" }, { name: "asc" }],
        });

        return apiSuccess({ services });
    } catch (error) {
        console.error("[Services] GET error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.SERVICES_MANAGE);
        if (permCheck) return permCheck;

        const staffUser = user as JWTPayload;
        const body = await request.json();
        const { tenantId, name, description, category, price, duration } = body;

        if (!tenantId || !name || !category || price === undefined || !duration) {
            return apiError("tenantId, name, category, price, and duration are required", 400);
        }

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const service = await prisma.service.create({
            data: {
                tenantId,
                name: name.trim(),
                description: description?.trim() || null,
                category,
                price: parseFloat(price),
                duration: parseInt(duration),
                isActive: true,
            },
        });

        return apiSuccess(service, 201);
    } catch (error) {
        console.error("[Services] POST error:", error);
        return apiError("Internal server error", 500);
    }
}
