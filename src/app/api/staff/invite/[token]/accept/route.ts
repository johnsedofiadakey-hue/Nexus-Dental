import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    signToken,
    hashPassword,
    validatePasswordStrength,
    resolveUserPermissions,
    pickPrimaryRole,
    apiError,
} from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import type { JWTPayload, UserRoleType } from "@/lib/auth";

// POST /api/staff/invite/[token]/accept  (public — the invite token is the credential)
// Body: { firstName, lastName, password }
//
// Consumes a single-use invitation: creates the staff account with the invited
// role in the inviting clinic, then signs the new user in.
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const body = await request.json().catch(() => ({}));
        const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
        const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";

        if (!firstName || !lastName) {
            return apiError("First name and last name are required", 400);
        }
        if (firstName.length > 80 || lastName.length > 80) {
            return apiError("Name is too long", 400);
        }

        const strength = validatePasswordStrength(password);
        if (!strength.valid) {
            return apiError(strength.errors.join(". "), 400);
        }

        const invite = await prisma.staffInvite.findUnique({
            where: { token },
            include: { tenant: { select: { id: true, name: true, status: true } } },
        });

        if (!invite) return apiError("Invite not found or already used", 404);
        if (invite.acceptedAt) return apiError("This invitation has already been accepted", 410);
        if (invite.expiresAt < new Date()) {
            return apiError("This invitation has expired. Ask your admin to resend it.", 410);
        }
        if (invite.tenant.status !== "ACTIVE") {
            return apiError("This clinic is not currently active. Contact support.", 403);
        }

        const email = invite.email.toLowerCase().trim();
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return apiError("An account with this email already exists. Try signing in instead.", 409);
        }

        const passwordHash = await hashPassword(password);

        // Consume the invite and create the user atomically. The conditional
        // updateMany makes acceptance single-use even under concurrent requests.
        const user = await prisma.$transaction(async (tx: any) => {
            const claimed = await tx.staffInvite.updateMany({
                where: { id: invite.id, acceptedAt: null },
                data: { acceptedAt: new Date() },
            });
            if (claimed.count !== 1) {
                throw new Error("INVITE_ALREADY_USED");
            }

            return tx.user.create({
                data: {
                    email,
                    passwordHash,
                    firstName,
                    lastName,
                    status: "ACTIVE",
                    tenantId: invite.tenantId,
                    roles: { create: { systemRole: invite.role } },
                },
                include: { roles: true },
            });
        }).catch((err: unknown) => {
            if (err instanceof Error && err.message === "INVITE_ALREADY_USED") return null;
            throw err;
        });

        if (!user) return apiError("This invitation has already been accepted", 410);

        const userRoles = user.roles
            .map((r: { systemRole: UserRoleType | null }) => r.systemRole)
            .filter(Boolean) as UserRoleType[];
        const primaryRole = pickPrimaryRole(userRoles);
        const permissions = await resolveUserPermissions(user.id, userRoles, user.tenantId);

        const tokenPayload: JWTPayload = {
            userId: user.id,
            tenantId: user.tenantId,
            role: primaryRole,
            roles: userRoles,
            permissions,
            featureFlags: [],
            type: "STAFF",
        };
        const sessionToken = signToken(tokenPayload);

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        await logAudit({
            tenantId: user.tenantId,
            userId: user.id,
            action: "STAFF_INVITE_ACCEPTED",
            entity: "StaffInvite",
            entityId: invite.id,
            newValue: { role: invite.role },
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        const res = NextResponse.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: primaryRole,
                    clinicName: invite.tenant.name,
                },
            },
        });

        res.cookies.set("nexus_token", sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24,
        });

        return res;
    } catch (error) {
        console.error("[Staff Invite Accept] Error:", error);
        return apiError("Internal server error", 500);
    }
}
