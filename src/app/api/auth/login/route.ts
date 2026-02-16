// ============================================
// NEXUS DENTAL — Staff Login API
// POST /api/auth/login
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { signToken, verifyPassword, resolveUserPermissions, apiError, apiSuccess } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";
import type { JWTPayload, AuthResponse, UserRoleType } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        // Validate input
        if (!email || !password) {
            return apiError("Email and password are required", 400);
        }

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
            include: {
                tenant: true,
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

        // Resolve permissions (base role + overrides)
        const permissions = await resolveUserPermissions(
            user.id,
            user.role as UserRoleType,
            user.tenantId
        );

        // Build JWT payload
        const tokenPayload: JWTPayload = {
            userId: user.id,
            tenantId: user.tenantId,
            role: user.role as UserRoleType,
            permissions,
            featureFlags: [], // TODO: Populate from tenant settings
            type: user.role === "SYSTEM_OWNER" ? "SYSTEM_OWNER" : "STAFF",
        };

        // Sign token
        const token = signToken(tokenPayload);

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
                role: user.role,
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
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return res;
    } catch (error) {
        console.error("[Auth] Login error:", error);
        return apiError("Internal server error", 500);
    }
}
