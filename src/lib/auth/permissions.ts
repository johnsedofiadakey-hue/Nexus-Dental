// ============================================
// NEXUS DENTAL — Permission Resolver
// ============================================

import prisma from "@/lib/db/prisma";
import { DEFAULT_ROLE_PERMISSIONS, UserRoleType } from "./types";

/**
 * Calculate effective permissions for a user.
 * 
 * Formula:
 * EffectivePermissions = (RolePermissions ∪ GrantedOverrides) - DeniedOverrides
 * 
 * 1. Start with default role permissions
 * 2. Merge tenant-specific role permissions from DB
 * 3. Apply user overrides (grant additions, deny removals)
 */
export async function resolveUserPermissions(
    userId: string,
    roles: UserRoleType[],
    tenantId: string | null
): Promise<string[]> {
    // Start with default role permissions (cumulative for all assigned roles)
    const basePermissions = new Set<string>();

    for (const role of roles) {
        const defaults = DEFAULT_ROLE_PERMISSIONS[role] || [];
        for (const p of defaults) {
            basePermissions.add(p);
        }
    }

    if (tenantId && roles.length > 0) {
        try {
            // Get tenant-specific role permissions from DB for all roles
            const dbRolePermissions = await prisma.rolePermission.findMany({
                where: {
                    role: {
                        tenantId,
                        name: { in: roles as string[] },
                    },
                },
                include: {
                    permission: true,
                },
            });

            // Merge DB permissions (additive)
            for (const rp of dbRolePermissions) {
                basePermissions.add(rp.permission.name);
            }
        } catch {
            // If DB lookup fails, continue with defaults
            console.warn(`[Permissions] Failed to fetch DB permissions for roles: ${roles.join(', ')}`);
        }
    }

    try {
        // Apply user-specific overrides
        const overrides = await prisma.userOverride.findMany({
            where: { userId },
            include: { permission: true },
        });

        for (const override of overrides) {
            if (override.granted) {
                // Extend: add permission
                basePermissions.add(override.permission.name);
            } else {
                // Restrict: remove permission
                basePermissions.delete(override.permission.name);
            }
        }
    } catch {
        console.warn(`[Permissions] Failed to fetch overrides for user ${userId}`);
    }

    return Array.from(basePermissions);
}

/**
 * Check if a set of permissions includes a specific permission.
 */
export function hasPermission(
    userPermissions: string[],
    requiredPermission: string
): boolean {
    return userPermissions.includes(requiredPermission);
}

/**
 * Check if a set of permissions includes ALL specified permissions.
 */
export function hasAllPermissions(
    userPermissions: string[],
    requiredPermissions: string[]
): boolean {
    return requiredPermissions.every((p) => userPermissions.includes(p));
}

/**
 * Check if a set of permissions includes ANY of the specified permissions.
 */
export function hasAnyPermission(
    userPermissions: string[],
    requiredPermissions: string[]
): boolean {
    return requiredPermissions.some((p) => userPermissions.includes(p));
}
