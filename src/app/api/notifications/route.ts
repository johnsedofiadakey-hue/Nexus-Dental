// ============================================
// NEXUS DENTAL — Notifications API
// GET  /api/notifications — List notifications
// POST /api/notifications/send — Send notification
// ============================================

import { NextRequest } from "next/server";
import {
    requireAuth,
    enforceTenantScope,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import { sendNotification, getNotificationHistory } from "@/lib/support";
import type { JWTPayload, PatientJWTPayload } from "@/lib/auth";
import type { NotificationChannel, NotificationStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get("tenantId");
        const type = searchParams.get("type");
        const status = searchParams.get("status") as NotificationStatus | null;
        const channel = searchParams.get("channel") as NotificationChannel | null;
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        if (!tenantId) return apiError("tenantId is required", 400);

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        // Patients only see their own notifications
        const recipientId =
            user.type === "PATIENT"
                ? (user as PatientJWTPayload).patientId
                : searchParams.get("recipientId") || undefined;

        const result = await getNotificationHistory(tenantId, recipientId, {
            type: type || undefined,
            status: status || undefined,
            channel: channel || undefined,
            page,
            limit,
        });

        return apiSuccess(result);
    } catch (error) {
        console.error("[Notifications] List error:", error);
        return apiError("Internal server error", 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;

        if (user.type === "PATIENT") {
            return apiError("Patients cannot send notifications", 403);
        }

        const staffUser = user as JWTPayload;
        const body = await request.json();
        const { tenantId, recipientId, type, title, content, preferredChannel } =
            body;

        if (!tenantId || !recipientId || !type || !title || !content) {
            return apiError(
                "tenantId, recipientId, type, title, and content are required",
                400
            );
        }

        const tenantCheck = enforceTenantScope(user, tenantId);
        if (tenantCheck) return tenantCheck;

        const result = await sendNotification({
            tenantId,
            recipientId,
            type,
            title,
            content,
            preferredChannel,
            metadata: { sentBy: staffUser.userId },
        });

        return apiSuccess(result);
    } catch (error) {
        console.error("[Notifications] Send error:", error);
        return apiError("Internal server error", 500);
    }
}
