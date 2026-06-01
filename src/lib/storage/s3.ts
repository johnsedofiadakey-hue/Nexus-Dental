import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || "nexus-dental-assets";

/**
 * Generates a presigned URL for uploading a file directly to S3.
 * @param key The destination path in the S3 bucket (e.g., `tenants/tenant1/logo.png`)
 * @param contentType The MIME type of the file being uploaded
 * @returns The presigned upload URL and the final public file URL
 */
export async function generatePresignedUploadUrl(key: string, contentType: string) {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        // Optional: ACL: 'public-read' if your bucket supports it
    });

    // URL expires in 5 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    
    // Determine the public URL (assumes standard AWS S3 format, adjust if using custom domain or R2)
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;

    return { uploadUrl, publicUrl };
}
