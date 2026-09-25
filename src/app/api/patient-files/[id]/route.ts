import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import {
    requireAuth,
    requirePermission,
    isPatientUser,
    PERMISSIONS,
    apiError,
    apiSuccess,
} from "@/lib/auth";
import type { PatientJWTPayload } from "@/lib/auth";
import { generatePresignedDownloadUrl } from "@/lib/storage/firebase";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const authResult = requireAuth(request);
        if ("error" in authResult) return authResult.error;
        const { user } = authResult;
        const { id } = await params;

        const file = await prisma.patientFile.findFirst({
            where: { id, tenantId: user.tenantId || undefined },
            select: { id: true, patientId: true, filename: true, fileType: true, storageKey: true },
        });
        if (!file) return apiError("File not found", 404);

        if (isPatientUser(user)) {
            if (file.patientId !== (user as PatientJWTPayload).patientId) return apiError("File not found", 404);
        } else {
            const permissionError = requirePermission(user, PERMISSIONS.PATIENTS_VIEW);
            if (permissionError) return permissionError;
        }

        const downloadUrl = await generatePresignedDownloadUrl(file.storageKey);
        if (request.nextUrl.searchParams.get("redirect") === "true") {
            return NextResponse.redirect(downloadUrl);
        }
        return apiSuccess({ id: file.id, filename: file.filename, fileType: file.fileType, downloadUrl });
    } catch (error) {
        console.error("[Patient File Download]", error);
        return apiError("Unable to open file", 500);
    }
}
