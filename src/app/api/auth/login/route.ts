// ============================================
// NEXUS DENTAL — Staff Login API
// POST /api/auth/login
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { signToken, verifyPassword, resolveUserPermissions, pickPrimaryRole, apiError, apiSuccess } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import { consumeRateLimit, resetRateLimit, clientIp } from "@/lib/security/rate-limit";
import type { JWTPayload, AuthResponse, UserRoleType } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const email = body.email?.toLowerCase().trim();
        const password = body.password?.trim();

        // Validate input
        if (!email || !password) {
            return apiError("Email and password are required", 400);
        }

        // Brute-force protection (durable, shared across instances):
        //  - 8 attempts / 15 min per IP + account
        //  - 20 attempts / 15 min per account from anywhere (distributed guessing)
        const ipKey = `login:ip:${clientIp(request.headers)}:${email}`;
        const acctKey = `login:acct:${email}`;
        const [ipLimit, acctLimit] = await Promise.all([
            consumeRateLimit(ipKey, 8, 15 * 60),
            consumeRateLimit(acctKey, 20, 15 * 60),
        ]);
        if (!ipLimit.allowed || !acctLimit.allowed) {
            const retry = Math.max(ipLimit.retryAfterSeconds, acctLimit.retryAfterSeconds);
            return NextResponse.json(
                { success: false, message: "Too many sign-in attempts. Please wait and try again.", error: "Too many sign-in attempts. Please wait and try again." },
                { status: 429, headers: { "Retry-After": String(retry) } }
            );
        }


        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
            include: {
                tenant: true,
                roles: true,
            },
        });

        if (!user) {
            return apiError("Invalid email or password", 401);
        }

        // Check user status
        if (user.status !== "ACTIVE") {
            return apiError("Account is suspended or inactive. Contact your administrator.", 403);
        }

        // Check tenant status (if not system owner)
        if (user.tenant && user.tenant.status !== "ACTIVE") {
            if (user.tenant.status === "FROZEN") {
                return apiError("Your clinic account has been frozen. Contact support.", 403);
            }
            if (user.tenant.status === "MAINTENANCE") {
                return apiError("System is under maintenance. Please try again later.", 503);
            }
            return apiError("Your clinic account is not active. Contact support.", 403);
        }

        // Verify password
        const passwordValid = await verifyPassword(password, user.passwordHash);
        if (!passwordValid) {
            // Log failed attempt
            await logAudit({
                tenantId: user.tenantId,
                userId: user.id,
                action: "AUTH_LOGIN_FAILED",
                entity: "User",
                entityId: user.id,
                newValue: { reason: "Invalid password" },
                ipAddress: getClientIP(request.headers),
                userAgent: getUserAgent(request.headers),
            });
            return apiError("Invalid email or password", 401);
        }

        // Map roles to enums (prioritizing systemRole)
        const userRoles = user.roles.map((r: { systemRole: UserRoleType | null }) => r.systemRole).filter(Boolean) as UserRoleType[];
        const primaryRole = pickPrimaryRole(userRoles); // deterministic, highest-authority role

        // Resolve permissions (base role + overrides)
        const permissions = await resolveUserPermissions(
            user.id,
            userRoles,
            user.tenantId
        );

        // Build JWT payload
        const tokenPayload: JWTPayload = {
            userId: user.id,
            tenantId: user.tenantId,
            role: primaryRole,
            roles: userRoles,
            permissions,
            featureFlags: [], // TODO: Populate from tenant settings
            type: userRoles.includes("SYSTEM_OWNER") ? "SYSTEM_OWNER" : "STAFF",
        };

        // Sign token
        const token = signToken(tokenPayload);

        // Successful sign-in: clear this IP's failure counter (the per-account
        // counter is left to expire so a shared account can't be reset by an attacker).
        await resetRateLimit(ipKey);

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        // Log successful login
        await logAudit({
            tenantId: user.tenantId,
            userId: user.id,
            action: "AUTH_LOGIN_SUCCESS",
            entity: "User",
            entityId: user.id,
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        const responsePayload: AuthResponse = {
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: primaryRole,
                roles: userRoles,
                tenantId: user.tenantId,
            },
        };

        const res = NextResponse.json(responsePayload);

        // Set secure HTTP-only cookie
        res.cookies.set("nexus_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24, // 1 day to match JWT_EXPIRATION
        });

        return res;
    } catch (error: any) {
        console.error("[Login Error]", error);
        return apiError("Internal server error", 500);
    }
}
