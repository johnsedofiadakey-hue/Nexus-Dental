import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    isPatientUser,
    revokeUserSessions,
    revokePatientSessions,
    apiError,
} from "@/lib/auth";
import type { JWTPayload, PatientJWTPayload } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";

// POST /api/auth/logout-all — "sign out of all devices" for the caller's own
// identity (staff or patient). Revokes every live session including this one.
export async function POST(request: NextRequest) {
    try {
        const authResult = await requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        let revoked: number;
        let subjectId: string;
        if (isPatientUser(user)) {
            subjectId = (user as PatientJWTPayload).patientId;
            revoked = await revokePatientSessions(prisma, subjectId, "SIGN_OUT_ALL");
        } else {
            subjectId = (user as JWTPayload).userId;
            revoked = await revokeUserSessions(prisma, subjectId, "SIGN_OUT_ALL");
        }

        await logAudit({
            tenantId: user.tenantId,
            userId: isPatientUser(user) ? null : subjectId,
            action: "SESSION_SIGN_OUT_ALL",
            entity: isPatientUser(user) ? "Patient" : "User",
            entityId: subjectId,
            newValue: { sessionsRevoked: revoked },
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });

        const res = NextResponse.json({ success: true, data: { sessionsRevoked: revoked } });
        const secure = process.env.NODE_ENV === "production";
        for (const name of ["nexus_token", "nexus_patient_token"]) {
            res.cookies.set(name, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
        }
        return res;
    } catch (error) {
        // Fail closed: do not report success when revocation did not happen.
        console.error("[Logout All] Error:", error instanceof Error ? error.message : "unknown");
        return apiError("Could not sign out of all devices", 500);
    }
}
