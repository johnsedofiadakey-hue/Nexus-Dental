import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    requirePermission,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import type { JWTPayload, UserRoleType } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";

// Roles that can be assigned through this endpoint. Owners are deliberately
// excluded: ownership is never handed out by a role dropdown.
const ASSIGNABLE_ROLES: UserRoleType[] = [
    "ADMIN",
    "DOCTOR",
    "NURSE",
    "RECEPTIONIST",
    "INVENTORY_MANAGER",
    "BILLING_STAFF",
];
const PROTECTED_ROLES: UserRoleType[] = ["SYSTEM_OWNER", "CLINIC_OWNER"];
const ALLOWED_STATUSES = ["ACTIVE", "SUSPENDED"] as const;

// PATCH /api/staff/[id]   { status?: "ACTIVE" | "SUSPENDED", role?: <assignable role> }
//
// Suspension blocks all new sign-ins immediately. A session that is already
// open keeps working until its token expires (24h) unless JWT_SECRET is rotated.
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;

        const permissionError = requirePermission(authResult.user, PERMISSIONS.STAFF_UPDATE);
        if (permissionError) return permissionError;
        const actor = authResult.user as JWTPayload;

        const body = await request.json().catch(() => ({}));
        const newStatus = body.status as (typeof ALLOWED_STATUSES)[number] | undefined;
        const newRole = body.role as UserRoleType | undefined;

        if (newStatus === undefined && newRole === undefined) {
            return apiError("Provide a status and/or a role to change", 400);
        }
        if (newStatus !== undefined && !ALLOWED_STATUSES.includes(newStatus)) {
            return apiError(`status must be one of: ${ALLOWED_STATUSES.join(", ")}`, 400);
        }
        if (newRole !== undefined && !ASSIGNABLE_ROLES.includes(newRole)) {
            return apiError(`role must be one of: ${ASSIGNABLE_ROLES.join(", ")}`, 400);
        }

        if (id === actor.userId) {
            return apiError("You can't change your own status or role", 400);
        }

        const target = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                tenantId: true,
                status: true,
                deletedAt: true,
                roles: { select: { id: true, systemRole: true } },
            },
        });
        // Same response for "missing" and "other clinic" so IDs can't be probed.
        if (!target || target.deletedAt || target.tenantId !== actor.tenantId) {
            return apiError("Staff member not found", 404);
        }

        const targetRoles = target.roles
            .map((r: { systemRole: UserRoleType | null }) => r.systemRole)
            .filter(Boolean) as UserRoleType[];

        if (targetRoles.some((r) => PROTECTED_ROLES.includes(r))) {
            return apiError("Owner accounts can't be changed here", 403);
        }
        // Admins manage everyone below them; only an owner can manage another admin.
        const actorIsOwner = actor.roles.includes("CLINIC_OWNER") || actor.roles.includes("SYSTEM_OWNER");
        if (!actorIsOwner && (targetRoles.includes("ADMIN") || newRole === "ADMIN")) {
            return apiError("Only a clinic owner can manage or assign the Admin role", 403);
        }

        const before = { status: target.status, roles: targetRoles };

        await prisma.$transaction(async (tx: any) => {
            if (newStatus !== undefined) {
                await tx.user.update({ where: { id }, data: { status: newStatus } });
            }
            if (newRole !== undefined) {
                // Replace only hard-coded system roles; custom tenant roles are left alone.
                await tx.userRoleMapping.deleteMany({
                    where: { userId: id, systemRole: { not: null } },
                });
                await tx.userRoleMapping.create({ data: { userId: id, systemRole: newRole } });
            }
        });

        await logAudit({
            tenantId: target.tenantId,
            userId: actor.userId,
            action: "STAFF_ACCESS_CHANGED",
            entity: "User",
            entityId: id,
            oldValue: before,
            newValue: {
                status: newStatus ?? before.status,
                roles: newRole ? [newRole] : before.roles,
            },
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        return apiSuccess({
            id,
            status: newStatus ?? target.status,
            role: newRole ?? targetRoles[0] ?? null,
        });
    } catch (error) {
        console.error("[Staff Update] Error:", error);
        return apiError("Internal server error", 500);
    }
}
