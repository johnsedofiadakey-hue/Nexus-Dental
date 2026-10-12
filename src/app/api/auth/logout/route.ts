import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { authenticateRequest, revokeSessionBySid } from "@/lib/auth";
import { logAudit, getClientIP, getUserAgent } from "@/lib/audit/logger";

const COOKIE = { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 } as const;

function clearCookies(response: NextResponse) {
    const secure = process.env.NODE_ENV === "production";
    response.cookies.set("nexus_token", "", { ...COOKIE, secure });
    response.cookies.set("nexus_patient_token", "", { ...COOKIE, secure });
    return response;
}

// POST /api/auth/logout — ends THIS device's session on the server, then clears cookies.
//
// Cookies are cleared only once the server session is really revoked. If
// revocation fails we answer 500 and leave the cookie in place so the client can retry.
export async function POST(request: NextRequest) {
    // Signature-only read is enough here: we are revoking, not authorising.
    const claims = authenticateRequest(request);
    const sid = claims?.sid;

    if (sid) {
        try {
            await revokeSessionBySid(prisma, sid, "LOGOUT");
        } catch (error) {
            console.error("[Logout] Session revocation failed:", error instanceof Error ? error.message : "unknown");
            await logAudit({
                tenantId: claims?.tenantId ?? null,
                userId: null,
                action: "SESSION_REVOKE_FAILED",
                entity: "AuthSession",
                entityId: "unknown",
                newValue: { reason: "LOGOUT" },
                ipAddress: getClientIP(request.headers),
                userAgent: getUserAgent(request.headers),
            });
            // Keep the cookie: it is the only handle the browser has to retry the
            // revocation. Deleting it would leave a live server session that the
            // user can no longer end.
            return NextResponse.json(
                { success: false, error: "Could not end your session. Please try again.", retry: true },
                { status: 500 }
            );
        }
        await logAudit({
            tenantId: claims?.tenantId ?? null,
            userId: claims && "userId" in claims ? claims.userId : null,
            action: "SESSION_LOGOUT",
            entity: claims?.type === "PATIENT" ? "Patient" : "User",
            entityId: claims ? ("userId" in claims ? claims.userId : claims.patientId) : "unknown",
            ipAddress: getClientIP(request.headers),
            userAgent: getUserAgent(request.headers),
        });
    }

    return clearCookies(NextResponse.json({ success: true }));
}
