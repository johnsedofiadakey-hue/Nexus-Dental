// ============================================
// NEXUS DENTAL — Audit Logger
// ============================================

import prisma from "@/lib/db/prisma";

interface AuditLogEntry {
    tenantId?: string | null;
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Log an audit event.
 * All critical actions must be logged for compliance.
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                tenantId: entry.tenantId ?? undefined,
                userId: entry.userId,
                action: entry.action,
                entity: entry.entity,
                entityId: entry.entityId,
                oldValue: entry.oldValue ? JSON.parse(JSON.stringify(entry.oldValue)) : undefined,
                newValue: entry.newValue ? JSON.parse(JSON.stringify(entry.newValue)) : undefined,
                ipAddress: entry.ipAddress,
                userAgent: entry.userAgent,
            },
        });
    } catch (error) {
        // Audit logging should never block the main operation
        console.error("[Audit] Failed to log audit entry:", error);
    }
}

/**
 * Extract IP address from request headers.
 */
export function getClientIP(headers: Headers): string {
    return (
        headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headers.get("x-real-ip") ||
        "unknown"
    );
}

/**
 * Extract user agent from request headers.
 */
export function getUserAgent(headers: Headers): string {
    return headers.get("user-agent") || "unknown";
}
