import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { requireAuth, requirePermission, PERMISSIONS, apiError, apiSuccess } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { JWTPayload } from "@/lib/auth/types";
import { getTenantIdFromUser } from "@/lib/clinic";


/**
 * GET /api/staff - List all employees for the current tenant
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;

        const permissionError = requirePermission(authResult.user, PERMISSIONS.STAFF_VIEW);
        if (permissionError) return permissionError;
        const user = authResult.user as JWTPayload;

        const employees = await prisma.user.findMany({
            where: { tenantId: getTenantIdFromUser(user) },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatar: true,
                status: true,
                lastLoginAt: true,
                createdAt: true,
                roles: { select: { systemRole: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return apiSuccess({ staff: employees, employees });
    } catch (error) {
        console.error("[Staff API] Fetch error:", error);
        return apiError("Failed to fetch employees", 500);
    }
}

/**
 * POST /api/staff — RETIRED.
 *
 * Creating an active account with a generated temporary password (and no way to
 * deliver it) was insecure and incomplete. Staff are now onboarded exclusively
 * through the invitation flow: POST /api/staff/invite emails a single-use link,
 * and the invitee sets their own password at /onboarding/accept.
 */
export async function POST() {
    return apiError(
        "Direct staff creation has been retired. Invite the employee instead (POST /api/staff/invite).",
        410
    );
}
