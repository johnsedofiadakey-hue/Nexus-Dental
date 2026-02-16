// ============================================
// NEXUS DENTAL — System Owner: Tenant Management
// CRUD, stats, suspend/activate, kill switch
// ============================================

import prisma from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit/logger";
import type { TenantStatus } from "@prisma/client";

/**
 * Get comprehensive stats for a tenant.
 */
export async function getTenantStats(tenantId: string) {
    const [
        userCount,
        patientCount,
        appointmentCount,
        activeAppointments,
        ticketCount,
        openTickets,
        inventoryCount,
        lowStockCount,
        invoiceRevenue,
    ] = await Promise.all([
        prisma.user.count({ where: { tenantId } }),
        prisma.patient.count({ where: { tenantId } }),
        prisma.appointment.count({ where: { tenantId } }),
        prisma.appointment.count({
            where: { tenantId, status: { in: ["SCHEDULED", "CHECKED_IN", "IN_CHAIR"] } },
        }),
        prisma.supportTicket.count({ where: { tenantId } }),
        prisma.supportTicket.count({
            where: { tenantId, status: { in: ["OPEN", "IN_PROGRESS", "ESCALATED"] } },
        }),
        prisma.inventoryItem.count({ where: { tenantId } }),
        prisma.inventoryItem.count({
            where: { tenantId, quantity: { lte: prisma.inventoryItem.fields.threshold } },
        }).catch(() => 0), // fallback if raw query needed
        prisma.invoice.aggregate({
            where: { tenantId, status: "PAID" },
            _sum: { totalAmount: true },
        }),
    ]);

    return {
        users: userCount,
        patients: patientCount,
        appointments: { total: appointmentCount, active: activeAppointments },
        support: { total: ticketCount, open: openTickets },
        inventory: { total: inventoryCount, lowStock: lowStockCount },
        revenue: invoiceRevenue._sum.totalAmount || 0,
    };
}

/**
 * Change a tenant's status (activate, suspend, freeze, maintenance).
 * Kill switch = SUSPENDED, which blocks all tenant operations.
 */
export async function changeTenantStatus(
    tenantId: string,
    newStatus: TenantStatus,
    reason: string,
    systemOwnerId: string
) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error("Tenant not found");

    const oldStatus = tenant.status;

    const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: newStatus },
    });

    await logAudit({
        tenantId: null,
        userId: systemOwnerId,
        action: `TENANT_STATUS_CHANGED`,
        entity: "Tenant",
        entityId: tenantId,
        oldValue: { status: oldStatus },
        newValue: { status: newStatus, reason },
    });

    return updated;
}

/**
 * Kill switch — immediately suspend a tenant.
 * All API requests for this tenant will be blocked.
 */
export async function killSwitch(
    tenantId: string,
    reason: string,
    systemOwnerId: string
) {
    return changeTenantStatus(tenantId, "SUSPENDED", reason, systemOwnerId);
}

/**
 * List all tenants with stats summary.
 */
export async function listTenants(
    filters?: {
        status?: TenantStatus;
        search?: string;
        page?: number;
        limit?: number;
    }
) {
    const where: Record<string, unknown> = {};
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;

    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
        where.OR = [
            { name: { contains: filters.search, mode: "insensitive" } },
            { slug: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
        ];
    }

    const [tenants, total] = await Promise.all([
        prisma.tenant.findMany({
            where,
            include: {
                _count: {
                    select: {
                        users: true,
                        patients: true,
                        appointments: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.tenant.count({ where }),
    ]);

    return {
        tenants,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}
