// ============================================
// NEXUS DENTAL — Auth Info (whoami)
// GET /api/auth/me
//
// Returns current authenticated user info.
// ============================================

import { NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    isStaffUser,
    isPatientUser,
    apiError,
    apiSuccess,
} from "@/lib/auth";
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

            return apiSuccess({
                type: "PATIENT",
                ...patient,
            });
        }

        if (isStaffUser(user)) {
            const staffUser = user as JWTPayload;
            const dbUser = await prisma.user.findUnique({
                where: { id: staffUser.userId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true,
                    status: true,
                    specialty: true,
                    avatar: true,
                    tenantId: true,
                    lastLoginAt: true,
                },
            });

            if (!dbUser) {
                return apiError("User not found", 404);
            }

            return apiSuccess({
                type: staffUser.type,
                ...dbUser,
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
