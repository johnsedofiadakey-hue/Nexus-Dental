// ============================================
// NEXUS DENTAL — System Owner: Maintenance Mode
// Toggleable maintenance with bypass for system owner
// ============================================

import prisma from "@/lib/db/prisma";
import { logAudit } from "@/lib/audit/logger";

/**
 * Enable maintenance mode for a tenant.
 * Sets tenant status to MAINTENANCE which triggers middleware blocking.
 */
export async function enableMaintenance(
    tenantId: string,
    reason: string,
    estimatedDuration: string,
    systemOwnerId: string
) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error("Tenant not found");

    const previousStatus = tenant.status;

    const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            status: "MAINTENANCE",
            settings: JSON.parse(JSON.stringify({
                ...(typeof tenant.settings === "object" && tenant.settings !== null
                    ? tenant.settings
                    : {}),
                maintenance: {
                    enabled: true,
                    reason,
                    estimatedDuration,
                    previousStatus,
                    enabledAt: new Date().toISOString(),
                    enabledBy: systemOwnerId,
                },
            })),
        },
    });

    await logAudit({
        tenantId: null,
        userId: systemOwnerId,
        action: "MAINTENANCE_ENABLED",
        entity: "Tenant",
        entityId: tenantId,
        oldValue: { status: previousStatus },
        newValue: { status: "MAINTENANCE", reason, estimatedDuration },
    });

    return updated;
}

/**
 * Disable maintenance mode and restore previous status.
 */
export async function disableMaintenance(
    tenantId: string,
    systemOwnerId: string
) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error("Tenant not found");

    const settings =
        typeof tenant.settings === "object" && tenant.settings !== null
            ? (tenant.settings as Record<string, unknown>)
            : {};
    const maintenanceInfo = settings.maintenance as Record<string, unknown> | undefined;
    const previousStatus = (maintenanceInfo?.previousStatus as string) || "ACTIVE";

    // Remove maintenance info from settings
    const { maintenance: _, ...cleanSettings } = settings;

    const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            status: previousStatus as "ACTIVE" | "FROZEN",
            settings: JSON.parse(JSON.stringify(cleanSettings)),
        },
    });

    await logAudit({
        tenantId: null,
        userId: systemOwnerId,
        action: "MAINTENANCE_DISABLED",
        entity: "Tenant",
        entityId: tenantId,
        oldValue: { status: "MAINTENANCE" },
        newValue: { status: previousStatus },
    });

    return updated;
}

/**
 * Check if a tenant is in maintenance mode.
 */
export async function isInMaintenance(
    tenantId: string
): Promise<{ maintenance: boolean; reason?: string; estimatedDuration?: string }> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { status: true, settings: true },
    });

    if (!tenant) throw new Error("Tenant not found");

    if (tenant.status !== "MAINTENANCE") {
        return { maintenance: false };
    }

    const settings =
        typeof tenant.settings === "object" && tenant.settings !== null
            ? (tenant.settings as Record<string, unknown>)
            : {};
    const maintenanceInfo = settings.maintenance as Record<string, unknown> | undefined;

    return {
        maintenance: true,
        reason: maintenanceInfo?.reason as string | undefined,
        estimatedDuration: maintenanceInfo?.estimatedDuration as string | undefined,
    };
}
