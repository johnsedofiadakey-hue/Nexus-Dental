import prisma from "@/lib/db/prisma";

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
        // Parallel queries for performance
        const [
            tenants,
            patients,
            appointments,
            completedAppointments,
        ] = await Promise.all([
            prisma.tenant.findMany({ select: { id: true, status: true } }),
            prisma.patient.findMany({ select: { id: true } }),
            prisma.appointment.findMany({ select: { id: true, status: true } }),
            prisma.appointment.count({ where: { status: "COMPLETED" } }),
        ]);

        const totalTenants = tenants.length;
        const activeTenants = tenants.filter(t => t.status === "ACTIVE").length;
        const activePatients = patients.length;
        const totalAppointments = appointments.length;
        const completionRate = totalAppointments > 0
            ? (completedAppointments / totalAppointments) * 100
            : 0;

        // TODO: Calculate real revenue from payments table when implemented
        const totalRevenue = 0;
        const monthlyRevenue = 0;
        const revenueGrowth = 0;
        const patientGrowth = 0; // Would need historical data

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

        return tenants.map(tenant => ({
            tenantId: tenant.id,
            tenantName: tenant.name,
            totalPatients: tenant._count.patients,
            totalAppointments: tenant._count.appointments,
            revenue: 0, // TODO: Calculate from payments
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
        const [
            patients,
            appointments,
            completedAppointments,
            staff,
        ] = await Promise.all([
            prisma.patient.count({ where: { tenantId } }),
            prisma.appointment.count({ where: { tenantId } }),
            prisma.appointment.count({ where: { tenantId, status: "COMPLETED" } }),
            prisma.user.count({ where: { tenantId } }),
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
            revenue: 0, // TODO: Calculate from payments
            monthlyRevenue: 0,
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
