import { NextRequest } from "next/server";
import { requireAuth, isStaffUser, apiError, apiSuccess } from "@/lib/auth";
import { generatePresignedUploadUrl } from "@/lib/storage/firebase";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
    try {
        const auth = requireAuth(request);
        if ("error" in auth) return auth.error;
        if (!isStaffUser(auth.user)) return apiError("Staff access required", 403);

        const tenantId = auth.user.tenantId;
        if (!tenantId) return apiError("Tenant context required", 400);

        const body = await request.json();
        const { filename, contentType, folder = "general" } = body;

        if (!filename || !contentType) {
            return apiError("filename and contentType are required", 400);
        }

        // Clean filename to prevent issues
        const cleanName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "");
        const cleanFolder = String(folder)
            .split("/")
            .map((segment) => segment.replace(/[^a-zA-Z0-9_-]/g, ""))
            .filter(Boolean)
            .join("/") || "general";
        const uniqueKey = `tenants/${tenantId}/${cleanFolder}/${uuidv4()}-${cleanName}`;

        const { uploadUrl, publicUrl } = await generatePresignedUploadUrl(uniqueKey, contentType);

        return apiSuccess({
            uploadUrl,
            publicUrl,
            key: uniqueKey
        });

    } catch (error: any) {
        console.error("[Upload URL] Error generating presigned URL:", error);
        return apiError("Failed to generate upload URL", 500);
    }
}
