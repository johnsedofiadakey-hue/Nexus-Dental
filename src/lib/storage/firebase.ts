import * as admin from "firebase-admin";

if (!admin.apps.length) {
    admin.initializeApp({
        // In Firebase App Hosting, credentials are automatically inferred from the environment.
        // The default bucket is typically project-id.appspot.com or project-id.firebasestorage.app
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "nexusdentalsystem.appspot.com",
    });
}

const bucket = admin.storage().bucket();

/**
 * Generates a presigned URL for uploading a file directly to Firebase Storage.
 * @param key The destination path in the Storage bucket (e.g., `tenants/tenant1/logo.png`)
 * @param contentType The MIME type of the file being uploaded
 * @returns The presigned upload URL and the final public file URL
 */
export async function generatePresignedUploadUrl(key: string, contentType: string) {
    const file = bucket.file(key);

    // Generate a signed URL for a PUT request
    const [uploadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 5 * 60 * 1000, // 5 minutes
        contentType: contentType,
    });

    // Firebase Storage public URLs follow a predictable pattern if made public,
    // but the easiest way to serve them publicly without making the entire bucket public 
    // is to construct the download URL using the token (though we can't generate the 
    // download token easily from admin SDK without a workaround).
    // Instead, we will construct the standard API URL. 
    // NOTE: This assumes Firebase Storage rules allow reading this path.
    const bucketName = bucket.name;
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(key)}?alt=media`;

    return { uploadUrl, publicUrl };
}
