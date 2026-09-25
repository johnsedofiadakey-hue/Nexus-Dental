import * as admin from "firebase-admin";

const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || "nexusdentalsystem.appspot.com";

function getBucket() {
    if (!admin.apps.length) {
        admin.initializeApp({
            // In Firebase App Hosting, credentials are automatically inferred from the environment.
            storageBucket,
        });
    }

    // Resolve lazily and pass the bucket explicitly. Another Firebase module may have
    // initialized the shared default app without a storageBucket before this module loads.
    return admin.storage().bucket(storageBucket);
}

/**
 * Generates a presigned URL for uploading a file directly to Firebase Storage.
 * @param key The destination path in the Storage bucket (e.g., `tenants/tenant1/logo.png`)
 * @param contentType The MIME type of the file being uploaded
 * @returns The presigned upload URL and the final public file URL
 */
export async function generatePresignedUploadUrl(key: string, contentType: string) {
    const bucket = getBucket();
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

export async function generatePresignedDownloadUrl(key: string) {
    const file = getBucket().file(key);
    const [downloadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 10 * 60 * 1000,
    });
    return downloadUrl;
}
