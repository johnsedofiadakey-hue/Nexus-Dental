// ============================================
// NEXUS DENTAL — Suppliers API
// GET  /api/suppliers — List suppliers
// POST /api/suppliers — Create supplier
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    requirePermission,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import { getTenantIdFromUser } from "@/lib/clinic";
import type { JWTPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.INVENTORY_VIEW);
        if (permCheck) return permCheck;

        const tenantId = getTenantIdFromUser(user);
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") ?? undefined;
        const isActiveParam = searchParams.get("isActive");

        const where: Record<string, unknown> = { tenantId };

        if (isActiveParam !== null) {
            where.isActive = isActiveParam === "true";
        }

        if (search) {
            where.name = { contains: search, mode: "insensitive" };
        }

        const suppliers = await prisma.supplier.findMany({
            where,
            orderBy: { name: "asc" },
        });

        return apiSuccess(suppliers);
    } catch (error) {
        console.error("[Suppliers] List error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const permCheck = requirePermission(user, PERMISSIONS.INVENTORY_CREATE);
        if (permCheck) return permCheck;

        const staffUser = user as JWTPayload;
        const body = await request.json();
        const tenantId = getTenantIdFromUser(user);
        const {
            name,
            contactPerson,
            email,
            phone,
            address,
            category,
            paymentTerms,
            leadTimeDays,
            notes,
        } = body;

        if (!name) return apiError("name is required", 400);

        const supplier = await prisma.supplier.create({
            data: {
                tenantId,
                name,
                contactPerson: contactPerson ?? null,
                email: email ?? null,
                phone: phone ?? null,
                address: address ?? null,
                category: category ?? null,
                paymentTerms: paymentTerms ?? null,
                leadTimeDays: leadTimeDays ?? null,
                notes: notes ?? null,
            },
        });

        await prisma.auditLog.create({
            data: {
                tenantId,
                userId: staffUser.userId,
                action: "SUPPLIER_CREATED",
                entity: "Supplier",
                entityId: supplier.id,
                newValue: { name },
            },
        });

        return apiSuccess(supplier, 201);
    } catch (error) {
        console.error("[Suppliers] Create error:", error);
        return apiError("Internal server error", 500);
    }
}
