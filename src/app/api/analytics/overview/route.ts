import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, isStaffUser, apiError, apiSuccess } from "@/lib/auth";
import type { JWTPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;
        if (!isStaffUser(user)) return apiError("Staff access required", 403);

        const tenantId = (user as JWTPayload).tenantId;
        if (!tenantId) return apiError("No tenant", 400);

        const now = new Date();
        const months: { label: string; from: Date; to: Date }[] = [];
        for (let i = 5; i >= 0; i--) {
            const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const to   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
            months.push({ label: from.toLocaleString("en-GB", { month: "short" }), from, to });
        }

        const [monthlyData, serviceBreakdown, statusBreakdown, topPatients] = await Promise.all([
            Promise.all(months.map(async m => {
                const [appts, invoices] = await Promise.all([
                    prisma.appointment.count({ where: { tenantId, dateTime: { gte: m.from, lte: m.to } } }),
                    prisma.invoice.findMany({ where: { tenantId, createdAt: { gte: m.from, lte: m.to }, status: "PAID" }, select: { totalAmount: true } }),
                ]);
                return {
                    month: m.label,
                    appointments: appts,
                    revenue: invoices.reduce((s: number, i: any) => s + i.totalAmount, 0),
                };
            })),
            prisma.service.findMany({
                where: { tenantId, isActive: true },
                select: {
                    name: true,
                    category: true,
                    _count: { select: { appointments: true } },
                },
                orderBy: { appointments: { _count: "desc" } },
                take: 6,
            }),
            prisma.appointment.groupBy({
                by: ["status"],
                where: { tenantId },
                _count: { id: true },
            }),
            prisma.patient.findMany({
                where: { tenantId },
                select: {
                    firstName: true,
                    lastName: true,
                    _count: { select: { appointments: true } },
                },
                orderBy: { appointments: { _count: "desc" } },
                take: 5,
            }),
        ]);

        return apiSuccess({ monthlyData, serviceBreakdown, statusBreakdown, topPatients });
    } catch (error) {
        console.error("[Analytics Overview] error:", error);
        return apiError("Internal server error", 500);
    }
}
