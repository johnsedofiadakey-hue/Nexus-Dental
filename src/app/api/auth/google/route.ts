import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { signToken, hashPassword, apiError, apiSuccess } from "@/lib/auth";
import { resolveUserPermissions } from "@/lib/auth/permissions";
import type { UserRoleType } from "@/lib/auth/types";
import type { UserRole } from "@prisma/client";

const GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const EXPECTED_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleTokenPayload {
    sub: string;
    email: string;
    email_verified: string;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    aud: string;
}

// POST /api/auth/google
// Body: { idToken: string; inviteToken?: string }
//
// Two paths:
//  1. inviteToken present → first-time accept: validate invite, create account, log in.
//  2. No inviteToken → returning login: look up existing account by email, log in.
//
// In both cases, Google identity must match the email on record / invite.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { idToken, inviteToken } = body as { idToken: string; inviteToken?: string };

        if (!idToken) return apiError("idToken is required", 400);
        if (!EXPECTED_CLIENT_ID) return apiError("Google OAuth is not configured on this server", 503);

        // ── Verify with Google ─────────────────────────────────
        const tokenRes = await fetch(`${GOOGLE_TOKEN_INFO_URL}?id_token=${idToken}`);
        if (!tokenRes.ok) return apiError("Invalid Google token", 401);

        const gPayload = await tokenRes.json() as GoogleTokenPayload;

        if (gPayload.aud !== EXPECTED_CLIENT_ID) {
            return apiError("Token audience mismatch", 401);
        }
        if (gPayload.email_verified !== "true") {
            return apiError("Google account email is not verified", 401);
        }

        // ── PATH 1: Accept an invite (first-time sign-up) ──────
        if (inviteToken) {
            const invite = await prisma.staffInvite.findUnique({
                where: { token: inviteToken },
                include: { tenant: { select: { id: true, name: true, status: true } } },
            });

            if (!invite) return apiError("Invite not found or already used", 404);
            if (invite.acceptedAt) return apiError("This invitation has already been accepted", 410);
            if (invite.expiresAt < new Date()) return apiError("Invite expired. Ask your admin to resend it.", 410);

            // Google email must match the invited email
            if (gPayload.email.toLowerCase() !== invite.email.toLowerCase()) {
                return apiError(
                    `This invite was sent to ${invite.email}. Please sign in with that Google account.`,
                    403
                );
            }

            if (invite.tenant.status !== "ACTIVE") {
                return apiError("This clinic account is suspended.", 403);
            }

            // Create the user account in a transaction
            const newUser = await prisma.$transaction(async (tx: any) => {
                const user = await tx.user.create({
                    data: {
                        tenantId: invite.tenantId,
                        email: invite.email,
                        firstName: gPayload.given_name || gPayload.name.split(" ")[0],
                        lastName: gPayload.family_name || gPayload.name.split(" ").slice(1).join(" ") || "—",
                        // No password — Google-only account. Set a random unusable hash.
                        passwordHash: await hashPassword(crypto.randomUUID()),
                        avatar: gPayload.picture || null,
                        lastLoginAt: new Date(),
                        roles: { create: [{ systemRole: invite.role as UserRole }] },
                    },
                    include: { roles: { select: { systemRole: true } } },
                });

                await tx.staffInvite.update({
                    where: { id: invite.id },
                    data: { acceptedAt: new Date() },
                });

                return user;
            });

            const userRoles = newUser.roles.map((r: any) => r.systemRole).filter(Boolean) as UserRoleType[];
            const primaryRole = userRoles[0] || (invite.role as UserRoleType);
            const permissions = await resolveUserPermissions(newUser.id, userRoles, invite.tenantId);

            const token = signToken({
                userId: newUser.id,
                tenantId: invite.tenantId,
                type: "STAFF",
                role: primaryRole,
                roles: userRoles,
                permissions,
                featureFlags: [],
            });

            const response = apiSuccess({
                firstLogin: true,
                user: {
                    id: newUser.id,
                    firstName: newUser.firstName,
                    lastName: newUser.lastName,
                    email: newUser.email,
                    avatar: newUser.avatar,
                    role: primaryRole,
                    tenantId: invite.tenantId,
                    clinicName: invite.tenant.name,
                },
            });

            response.headers.set(
                "Set-Cookie",
                `nexus_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
            );
            return response;
        }

        // ── PATH 2: Returning login ────────────────────────────
        const user = await prisma.user.findUnique({
            where: { email: gPayload.email },
            include: {
                roles: { select: { systemRole: true } },
                tenant: { select: { id: true, status: true } },
            },
        });

        if (!user) {
            return apiError(
                "No Nexus Dental account found for this Google email. Check your invitation email or contact your admin.",
                404
            );
        }

        if (user.status !== "ACTIVE") {
            return apiError("Your account has been deactivated. Contact your admin.", 403);
        }

        if (user.tenant && user.tenant.status !== "ACTIVE") {
            return apiError("Your clinic account is suspended. Contact support.", 403);
        }

        // Sync avatar on first Google login
        await prisma.user.update({
            where: { id: user.id },
            data: {
                lastLoginAt: new Date(),
                ...((!user.avatar && gPayload.picture) ? { avatar: gPayload.picture } : {}),
            },
        });

        const userRoles = user.roles.map((r: any) => r.systemRole).filter(Boolean) as UserRoleType[];
        const primaryRole = userRoles[0] || "RECEPTIONIST";
        const permissions = await resolveUserPermissions(user.id, userRoles, user.tenantId ?? null);
        const isSystemOwner = primaryRole === "SYSTEM_OWNER";

        const token = signToken({
            userId: user.id,
            tenantId: user.tenantId ?? null,
            type: isSystemOwner ? "SYSTEM_OWNER" : "STAFF",
            role: primaryRole,
            roles: userRoles,
            permissions,
            featureFlags: [],
        });

        const response = apiSuccess({
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                avatar: user.avatar ?? gPayload.picture,
                role: primaryRole,
                roles: userRoles,
                tenantId: user.tenantId,
            },
        });

        response.headers.set(
            "Set-Cookie",
            `nexus_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
        );
        return response;
    } catch (error) {
        console.error("[Google Auth] Error:", error);
        return apiError("Internal server error", 500);
    }
}
