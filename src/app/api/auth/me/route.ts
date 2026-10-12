// ============================================
// NEXUS DENTAL — Auth Info (whoami)
// GET /api/auth/me
//
// Returns the current authenticated user and their effective access
// (see src/contracts/access.ts). Everything is re-resolved from the database
// for this request — roles, permissions, account and clinic status.
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
    hashSid,
} from "@/lib/auth";
import { SESSION_POLICY } from "@/lib/auth/types";
import type { JWTPayload, PatientJWTPayload } from "@/lib/auth";
import { ACCESS_CONTRACT_VERSION, type AccessContract, type AccessSubject } from "@/contracts/access";
import { resolveDeploymentMode, resolveModules, resolveProviders } from "@/lib/config/features";

async function buildAccess(
    subject: AccessSubject,
    tenantId: string | null,
    role: string,
    roles: string[],
    permissions: string[]
): Promise<AccessContract> {
    const settings = tenantId
        ? await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { featureFlags: true } })
        : null;
    return {
        version: ACCESS_CONTRACT_VERSION,
        deploymentMode: resolveDeploymentMode(),
        subject,
        role,
        roles,
        permissions,
        modules: resolveModules(settings?.featureFlags),
        providers: resolveProviders(),
    };
}

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if ("error" in authResult) return authResult.error;

        const { user } = authResult;

        if (isPatientUser(user)) {
            const patientUser = user as PatientJWTPayload;
            const patient = await prisma.patient.findUnique({
                where: { id: patientUser.patientId },
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

            const access = await buildAccess("PATIENT", patient.tenantId, "PATIENT", ["PATIENT"], []);

            const response = NextResponse.json({
                success: true,
                data: {
                    type: "PATIENT",
                    role: "PATIENT",
                    roles: ["PATIENT"],
                    ...patient,
                    access,
                },
            });

            // Rolling patient session: the server-side idle window was already
            // extended by requireAuth; renew the cookie to match, but never past
            // the session's absolute limit.
            if (patientUser.sid) {
                const row = await prisma.authSession.findUnique({
                    where: { sidHash: hashSid(patientUser.sid) },
                    select: { absoluteExpiresAt: true },
                });
                const remaining = row
                    ? Math.floor((row.absoluteExpiresAt.getTime() - Date.now()) / 1000)
                    : 0;
                const maxAge = Math.min(SESSION_POLICY.PATIENT_IDLE_SECONDS, remaining);
                if (maxAge > 0) {
                    response.cookies.set(
                        "nexus_patient_token",
                        signPatientToken({
                            patientId: patient.id,
                            tenantId: patient.tenantId,
                            role: "PATIENT",
                            type: "PATIENT",
                            sid: patientUser.sid,
                        }),
                        {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === "production",
                            sameSite: "lax",
                            path: "/",
                            maxAge,
                        }
                    );
                }
            }

            return response;
        }

        if (isStaffUser(user)) {
            // `user` is already the CURRENT authority (roles + permissions re-read
            // from the database by the session check), not the token's claims.
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

            const { passwordHash, ...safeUser } = dbUser as any;
            const access = await buildAccess(
                staffUser.type,
                staffUser.tenantId,
                staffUser.role,
                staffUser.roles,
                staffUser.permissions
            );

            return apiSuccess({
                type: staffUser.type,
                ...safeUser,
                role: staffUser.role,
                roles: staffUser.roles,
                permissions: staffUser.permissions,
                featureFlags: [],
                access,
            });
        }

        return apiError("Unknown user type", 400);
    } catch (error) {
        console.error("[Auth] Me endpoint error:", error);
        return apiError("Internal server error", 500);
    }
}
