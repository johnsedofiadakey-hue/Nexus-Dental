// ============================================
// NEXUS DENTAL — Analytics Engine
// Business intelligence and performance metrics
// ============================================

import prisma from "@/lib/db/prisma";

export interface AnalyticsSummary {
    revenue: {
        totalPaid: number;
        taxCollected: number;
        discountGiven: number;
        dailyRevenue: { date: string; amount: number }[];
    };
    appointments: {
        total: number;
        completed: number;
        cancelled: number;
        noShow: number;
        categoryDistribution: { category: string; count: number }[];
    };
    patients: {
        total: number;
        newThisMonth: number;
    };
}

/**
 * Get analytics summary for a tenant within a date range.
 */
export async function getTenantAnalytics(
    tenantId: string,
    startDate: Date,
    endDate: Date
): Promise<AnalyticsSummary> {
    const [
        invoiceStats,
        dailyRevenue,
        appointmentStats,
        appointmentCategories,
        totalPatients,
        newPatients,
    ] = await Promise.all([
        // Invoice Stats
        prisma.invoice.aggregate({
            where: { tenantId, status: "PAID", paidAt: { gte: startDate, lte: endDate } },
            _sum: { totalAmount: true, tax: true, discount: true },
        }),
        // Daily Revenue (Native Query for grouping by date)
        prisma.$queryRaw<{ date: string; amount: number }[]>`
            SELECT date_trunc('day', "paidAt") as date, sum("totalAmount") as amount
            FROM "invoices"
            WHERE "tenantId" = ${tenantId} AND "status" = 'PAID' AND "paidAt" >= ${startDate} AND "paidAt" <= ${endDate}
            GROUP BY date
            ORDER BY date ASC
        `.catch(() => []), // Fallback if raw query fails in some environments
        // Appointment Stats
        prisma.appointment.groupBy({
            by: ["status"],
            where: { tenantId, dateTime: { gte: startDate, lte: endDate } },
            _count: { status: true },
        }),
        // Service Categories
        prisma.appointment.findMany({
            where: { tenantId, dateTime: { gte: startDate, lte: endDate } },
            select: { service: { select: { category: true } } },
        }),
        // Patient Stats
        prisma.patient.count({ where: { tenantId } }),
        prisma.patient.count({
            where: {
                tenantId,
                createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            },
        }),
    ]);

    // Process categories
    const categories: Record<string, number> = {};
    appointmentCategories.forEach((a) => {
        const cat = a.service.category;
        categories[cat] = (categories[cat] || 0) + 1;
    });

    const apptCounts: Record<string, number> = {};
    appointmentStats.forEach((s) => {
        apptCounts[s.status] = s._count.status;
    });

    return {
        revenue: {
            totalPaid: invoiceStats._sum.totalAmount || 0,
            taxCollected: invoiceStats._sum.tax || 0,
            discountGiven: invoiceStats._sum.discount || 0,
            dailyRevenue: dailyRevenue.map((d) => ({
                date: new Date(d.date).toISOString().split("T")[0],
                amount: Number(d.amount),
            })),
        },
        appointments: {
            total: Object.values(apptCounts).reduce((a, b) => a + b, 0),
            completed: apptCounts["COMPLETED"] || 0,
            cancelled: apptCounts["CANCELLED"] || 0,
            noShow: apptCounts["NO_SHOW"] || 0,
            categoryDistribution: Object.entries(categories).map(([category, count]) => ({
                category,
                count,
            })),
        },
        patients: {
            total: totalPatients,
            newThisMonth: newPatients,
        },
    };
}
