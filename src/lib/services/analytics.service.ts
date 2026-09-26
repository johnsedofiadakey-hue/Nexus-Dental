import prisma from "@/lib/db/prisma";
import { monthBounds, paidInRange, percentChange, sumAmounts } from "./analytics.math";

/**
 * Analytics Service
 * Provides real-time statistics from database
 */

export interface PlatformStats {
    totalRevenue: number;
    monthlyRevenue: number;
    revenueGrowth: number;
    activePatients: number;
    patientGrowth: number;
    totalAppointments: number;
    completedAppointments: number;
    completionRate: number;
    totalTenants: number;
    activeTenants: number;
}

export interface TenantStats {
    tenantId: string;
    tenantName: string;
    totalPatients: number;
    totalAppointments: number;
    revenue: number;
}

/**
 * Get platform-wide statistics for System Owner dashboard
 */
export async function getPlatformStats(): Promise<PlatformStats> {
    try {
        const { prevStart, start, nextStart } = monthBounds();

        // Parallel queries for performance
        const [
            tenants,
            patientCount,
            patientsThisMonth,
            patientsLastMonth,
            appointments,
            paidAllTime,
            paidThisMonth,
            paidLastMonth,
        ] = await Promise.all([
            prisma.tenant.findMany({ select: { id: true, status: true } }),
            // Soft-deleted patients are not active patients.
            prisma.patient.count({ where: { deletedAt: null } }),
            prisma.patient.count({ where: { deletedAt: null, createdAt: { gte: start, lt: nextStart } } }),
            prisma.patient.count({ where: { deletedAt: null, createdAt: { gte: prevStart, lt: start } } }),
            prisma.appointment.findMany({ select: { id: true, status: true } }),
            prisma.invoice.findMany({ where: { status: "PAID" }, select: { totalAmount: true } }),
            prisma.invoice.findMany({ where: paidInRange(start, nextStart), select: { totalAmount: true } }),
            prisma.invoice.findMany({ where: paidInRange(prevStart, start), select: { totalAmount: true } }),
        ]);

        const totalTenants = tenants.length;
        const activeTenants = tenants.filter((t: any) => t.status === "ACTIVE").length;
        const activePatients = patientCount;
        const totalAppointments = appointments.length;
        const completedAppointments = appointments.filter((a: any) => a.status === "COMPLETED").length;
        const completionRate = totalAppointments > 0
            ? (completedAppointments / totalAppointments) * 100
            : 0;

        // Revenue = money actually received (PAID invoices), see analytics.math.ts.
        const totalRevenue = sumAmounts(paidAllTime);
        const monthlyRevenue = sumAmounts(paidThisMonth);
        const revenueGrowth = percentChange(monthlyRevenue, sumAmounts(paidLastMonth));
        const patientGrowth = percentChange(patientsThisMonth, patientsLastMonth);

        return {
            totalRevenue,
            monthlyRevenue,
            revenueGrowth,
            activePatients,
            patientGrowth,
            totalAppointments,
            completedAppointments,
            completionRate,
            totalTenants,
            activeTenants,
        };
    } catch (error) {
        console.error("[Analytics Service] Failed to fetch platform stats:", error);
        // Return zeros on error
        return {
            totalRevenue: 0,
            monthlyRevenue: 0,
            revenueGrowth: 0,
            activePatients: 0,
            patientGrowth: 0,
            totalAppointments: 0,
            completedAppointments: 0,
            completionRate: 0,
            totalTenants: 0,
            activeTenants: 0,
        };
    }
}

/**
 * Get statistics for individual tenants
 */
export async function getTenantStats(tenantId?: string): Promise<TenantStats[]> {
    try {
        const tenants = await prisma.tenant.findMany({
            where: tenantId ? { id: tenantId } : {},
            include: {
                _count: {
                    select: {
                        patients: true,
                        appointments: true,
                    },
                },
            },
        });

        const revenueRows = await prisma.invoice.groupBy({
            by: ["tenantId"],
            where: { status: "PAID", ...(tenantId ? { tenantId } : {}) },
            _sum: { totalAmount: true },
        });
        const revenueByTenant = new Map<string, number>(
            revenueRows.map((r: any) => [r.tenantId, sumAmounts([{ totalAmount: r._sum.totalAmount }])])
        );

        return tenants.map((tenant: any) => ({
            tenantId: tenant.id,
            tenantName: tenant.name,
            totalPatients: tenant._count.patients,
            totalAppointments: tenant._count.appointments,
            revenue: revenueByTenant.get(tenant.id) ?? 0,
        }));
    } catch (error) {
        console.error("[Analytics Service] Failed to fetch tenant stats:", error);
        return [];
    }
}

/**
 * Get clinic-specific statistics for Clinic Owner dashboard
 */
export async function getClinicStats(tenantId: string) {
    try {
        const { start, nextStart } = monthBounds();
        const [
            patients,
            appointments,
            completedAppointments,
            staff,
            paidAllTime,
            paidThisMonth,
        ] = await Promise.all([
            prisma.patient.count({ where: { tenantId, deletedAt: null } }),
            prisma.appointment.count({ where: { tenantId } }),
            prisma.appointment.count({ where: { tenantId, status: "COMPLETED" } }),
            prisma.user.count({ where: { tenantId } }),
            prisma.invoice.findMany({ where: { tenantId, status: "PAID" }, select: { totalAmount: true } }),
            prisma.invoice.findMany({ where: { tenantId, ...paidInRange(start, nextStart) }, select: { totalAmount: true } }),
        ]);

        const completionRate = appointments > 0
            ? (completedAppointments / appointments) * 100
            : 0;

        return {
            totalPatients: patients,
            totalAppointments: appointments,
            completedAppointments,
            completionRate,
            totalStaff: staff,
            revenue: sumAmounts(paidAllTime),
            monthlyRevenue: sumAmounts(paidThisMonth),
        };
    } catch (error) {
        console.error("[Analytics Service] Failed to fetch clinic stats:", error);
        return {
            totalPatients: 0,
            totalAppointments: 0,
            completedAppointments: 0,
            completionRate: 0,
            totalStaff: 0,
            revenue: 0,
            monthlyRevenue: 0,
        };
    }
}
