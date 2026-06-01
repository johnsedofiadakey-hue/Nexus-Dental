import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/db/prisma";
import { requireAuth, enforceTenantScope, apiError, apiSuccess } from "@/lib/auth";
import { sendEmail, staffInviteEmailHtml } from "@/lib/email/sender";
import type { JWTPayload } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

const INVITE_EXPIRES_HOURS = 48;
const ALLOWED_ROLES: UserRole[] = [
    "DOCTOR", "NURSE", "RECEPTIONIST",
    "INVENTORY_MANAGER", "BILLING_STAFF", "ADMIN",
];

// POST /api/staff/invite — send an invite email to a new staff member
export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const staffUser = user as JWTPayload;
        if (!["CLINIC_OWNER", "ADMIN"].includes(staffUser.role)) {
            return apiError("Only clinic owners and admins can invite staff", 403);
        }

        const body = await request.json();
        const { email, role, tenantId } = body as { email: string; role: UserRole; tenantId: string };

        if (!email || !role || !tenantId) {
            return apiError("email, role, and tenantId are required", 400);
        }

        if (!ALLOWED_ROLES.includes(role)) {
            return apiError(`Role must be one of: ${ALLOWED_ROLES.join(", ")}`, 400);
        }

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        // Don't invite someone who already has an account
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return apiError("A staff account with this email already exists.", 409);
        }

        // Upsert invite — allow re-sending if previous invite expired
        const token = randomUUID();
        const expiresAt = new Date(Date.now() + INVITE_EXPIRES_HOURS * 60 * 60 * 1000);

        const existing = await prisma.staffInvite.findUnique({
            where: { tenantId_email: { tenantId, email } },
        });

        if (existing?.acceptedAt) {
            return apiError("This person has already accepted an invitation.", 409);
        }

        const invite = existing
            ? await prisma.staffInvite.update({
                where: { id: existing.id },
                data: { token, role, expiresAt, invitedById: staffUser.userId },
            })
            : await prisma.staffInvite.create({
                data: { tenantId, email, role, token, invitedById: staffUser.userId, expiresAt },
            });

        // Fetch inviter + tenant names for the email
        const [inviter, tenant] = await Promise.all([
            prisma.user.findUnique({ where: { id: staffUser.userId }, select: { firstName: true, lastName: true } }),
            prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
        ]);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const acceptUrl = `${appUrl}/onboarding/accept?token=${token}`;

        await sendEmail({
            to: email,
            subject: `You're invited to join ${tenant?.name ?? "a clinic"} on Nexus Dental`,
            html: staffInviteEmailHtml({
                clinicName: tenant?.name ?? "your clinic",
                inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}` : "Your admin",
                role,
                acceptUrl,
                expiresHours: INVITE_EXPIRES_HOURS,
            }),
        });

        return apiSuccess({ inviteId: invite.id, email, role, expiresAt });
    } catch (error) {
        console.error("[Staff Invite] Error:", error);
        return apiError("Internal server error", 500);
    }
}

// GET /api/staff/invite?tenantId=xxx — list pending invites for a tenant
export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");
        if (!tenantId) return apiError("tenantId is required", 400);

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const invites = await prisma.staffInvite.findMany({
            where: { tenantId, acceptedAt: null },
            include: { invitedBy: { select: { firstName: true, lastName: true } } },
            orderBy: { createdAt: "desc" },
        });

        return apiSuccess({ invites });
    } catch (error) {
        return apiError("Internal server error", 500);
    }
}

// DELETE /api/staff/invite?id=xxx — revoke a pending invite
export async function DELETE(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) return apiError("id is required", 400);

        const invite = await prisma.staffInvite.findUnique({ where: { id } });
        if (!invite) return apiError("Invite not found", 404);

        const tenantCheck = enforceTenantScope(user, invite.tenantId);
        if (tenantCheck) return tenantCheck;

        await prisma.staffInvite.delete({ where: { id } });
        return apiSuccess({ revoked: true });
    } catch (error) {
        return apiError("Internal server error", 500);
    }
}
