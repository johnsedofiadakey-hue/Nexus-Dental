// ============================================
// NEXUS DENTAL — System: Tenants API
// GET   /api/system/tenants — List all tenants
// POST  /api/system/tenants — Create tenant
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";
import { listTenants } from "@/lib/system";
import { logAudit } from "@/lib/audit/logger";
import type { TenantStatus } from "@prisma/client";

function requireSystemOwner(request: NextRequest) {
    const authResult = requireAuth(request);
    if ("error" in authResult) return { error: authResult.error };
    if (authResult.user.type !== "SYSTEM_OWNER") {
        return { error: apiError("System owner access required", 403) };
    }
    return { user: authResult.user };
}

export async function GET(request: NextRequest) {
    try {
        const auth = requireSystemOwner(request);
        if ("error" in auth && auth.error) return auth.error;

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") as TenantStatus | null;
        const search = searchParams.get("search") || undefined;
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        const result = await listTenants({
            status: status || undefined,
            search,
            page,
            limit,
        });

        return apiSuccess(result);
    } catch (error) {
        console.error("[System] Tenant list error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const auth = requireSystemOwner(request);
        if ("error" in auth && auth.error) return auth.error;

        const body = await request.json();
        const { name, slug, email, phone, address, timezone, logo, website } = body;

        if (!name || !slug) {
            return apiError("name and slug are required", 400);
        }

        // Check for duplicate slug
        const existing = await prisma.tenant.findUnique({ where: { slug } });
        if (existing) {
            return apiError("A tenant with this slug already exists", 409);
        }

        const tenant = await prisma.tenant.create({
            data: {
                name,
                slug,
                email: email || null,
                phone: phone || null,
                address: address || null,
                timezone: timezone || "UTC",
                logo: logo || null,
                website: website || null,
            },
        });

        await logAudit({
            tenantId: null,
            userId: auth.user!.userId,
            action: "TENANT_CREATED",
            entity: "Tenant",
            entityId: tenant.id,
            newValue: { name, slug },
        });

        return apiSuccess(tenant, 201);
    } catch (error) {
        console.error("[System] Tenant create error:", error);
        return apiError("Internal server error", 500);
    }
}
