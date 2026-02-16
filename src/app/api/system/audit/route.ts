// ============================================
// NEXUS DENTAL — System: Audit Log Viewer API
// GET /api/system/audit — View audit logs with filters
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/auth";

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
        const tenantId = searchParams.get("tenantId");
        const userId = searchParams.get("userId");
        const action = searchParams.get("action");
        const entity = searchParams.get("entity");
        const entityId = searchParams.get("entityId");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");

        const where: Record<string, unknown> = {};

        if (tenantId) where.tenantId = tenantId;
        if (userId) where.userId = userId;
        if (action) where.action = { contains: action, mode: "insensitive" };
        if (entity) where.entity = entity;
        if (entityId) where.entityId = entityId;

        if (dateFrom || dateTo) {
            where.timestamp = {};
            if (dateFrom) {
                (where.timestamp as Record<string, unknown>).gte = new Date(dateFrom);
            }
            if (dateTo) {
                (where.timestamp as Record<string, unknown>).lte = new Date(dateTo);
            }
        }

        const [logs, total, actionSummary] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            role: true,
                            email: true,
                        },
                    },
                    tenant: {
                        select: { id: true, name: true, slug: true },
                    },
                },
                orderBy: { timestamp: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.auditLog.count({ where }),
            // Action breakdown for the filtered set
            prisma.auditLog.groupBy({
                by: ["action"],
                where,
                _count: { action: true },
                orderBy: { _count: { action: "desc" } },
                take: 10,
            }),
        ]);

        return apiSuccess({
            logs,
            summary: {
                topActions: actionSummary.map((a) => ({
                    action: a.action,
                    count: a._count.action,
                })),
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("[System] Audit log error:", error);
        return apiError("Internal server error", 500);
    }
}
