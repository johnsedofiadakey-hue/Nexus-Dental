// ============================================
// NEXUS DENTAL — Auth Info (whoami)
// GET /api/auth/me
//
// Returns current authenticated user info.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    isStaffUser,
    isPatientUser,
    apiError,
    apiSuccess,
    signPatientToken,
} from "@/lib/auth";
import { AUTH_CONFIG } from "@/lib/auth/types";
import type { JWTPayload, PatientJWTPayload } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;

        const { user } = authResult;

        if (isPatientUser(user)) {
            const patient = await prisma.patient.findUnique({
                where: { id: (user as PatientJWTPayload).patientId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    email: true,
                    dateOfBirth: true,
                    isVerified: true,
                    tenantId: true,
                    lastVisitAt: true,
                },
            });

            if (!patient) {
                return apiError("Patient not found", 404);
            }

            const response = NextResponse.json({
                success: true,
                data: {
                    type: "PATIENT",
                    role: "PATIENT",
                    roles: ["PATIENT"],
                    ...patient,
                },
            });

            // Sliding patient session: every successful app load renews the
            // signed cookie. The session therefore remains active while the
            // patient uses the portal, and explicit logout remains reliable.
            const renewedToken = signPatientToken({
                patientId: patient.id,
                tenantId: patient.tenantId,
                role: "PATIENT",
                type: "PATIENT",
            });
            response.cookies.set("nexus_patient_token", renewedToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: AUTH_CONFIG.PATIENT_SESSION_MAX_AGE_SECONDS,
            });

            return response;
        }

        if (isStaffUser(user)) {
            const staffUser = user as JWTPayload;
            const dbUser = await prisma.user.findUnique({
                where: { id: staffUser.userId },
                include: {
                    roles: true,
                },
            });

            if (!dbUser) {
                return apiError("User not found", 404);
            }

            const userRoles = dbUser.roles.map((r: any) => r.systemRole).filter(Boolean) as string[];
            const primaryRole = userRoles[0] || "RECEPTIONIST";

            const { passwordHash, ...safeUser } = dbUser as any;

            return apiSuccess({
                type: staffUser.type,
                ...safeUser,
                role: primaryRole,
                roles: userRoles,
                permissions: staffUser.permissions,
                featureFlags: staffUser.featureFlags,
            });
        }

        return apiError("Unknown user type", 400);
    } catch (error) {
        console.error("[Auth] Me endpoint error:", error);
        return apiError("Internal server error", 500);
    }
}
