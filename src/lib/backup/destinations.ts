// ============================================
// NEXUS DENTAL — Backup destinations (UPLOAD side)
//
// A destination can only CREATE an object and report what the store says it
// created. It has no read, list, download or delete capability, by construction:
//   * the backup identity (GitHub Actions) is a create-only service account, so a
//     compromised runner can neither read earlier backups nor erase history
//   * integrity is confirmed from the metadata the store returns for the upload
//     itself (size and, on Google Cloud Storage, a checksum validated by the SDK),
//     which needs no read permission
//   * retention is the bucket's lifecycle rules, not this code
// Downloading for a restore uses a SEPARATE, operator-controlled read identity that is
// never stored in the backup workflow (see readBackupObject in restore.ts).
// ============================================

import fs from "fs";
import path from "path";
import { BackupError } from "./crypto";

/** What the store itself reports about the object it just created. */
export interface StoredObject {
    /** Size in bytes, as confirmed by the store (not echoed from what we sent). */
    size: number;
}

export interface BackupDestination {
    /** Create an object at `key` from a local file and return the store's own account of it. */
    put(key: string, filePath: string): Promise<StoredObject>;
    describe(): string;
}

/** Filesystem destination: used by tests, drills and local rehearsals. */
export class LocalDestination implements BackupDestination {
    constructor(private root: string) {}

    private resolve(key: string) {
        const full = path.resolve(this.root, key);
        if (!full.startsWith(path.resolve(this.root) + path.sep)) {
            throw new BackupError("UPLOAD_FAILED", "Refusing a key that escapes the destination.");
        }
        return full;
    }
    async put(key: string, filePath: string): Promise<StoredObject> {
        const target = this.resolve(key);
        fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
        // Create-only, like the real store: never overwrite an existing backup.
        fs.copyFileSync(filePath, target, fs.constants.COPYFILE_EXCL);
        fs.chmodSync(target, 0o600);
        return { size: fs.statSync(target).size };
    }
    describe() {
        return `local:${this.root}`;
    }
}

/**
 * Google Cloud Storage in a SEPARATE project from the app, using its own
 * write-only service account. Not exercised by the automated tests (no real
 * bucket is ever contacted from them); see docs/BACKUP_AND_RESTORE.md.
 */
export class GcsDestination implements BackupDestination {
    private bucketPromise: Promise<import("@google-cloud/storage").Bucket> | null = null;
    constructor(private bucketName: string, private serviceAccountJson: string) {}

    private bucket() {
        if (!this.bucketPromise) {
            this.bucketPromise = (async () => {
                const admin = await import("firebase-admin");
                const credential = admin.credential.cert(JSON.parse(this.serviceAccountJson));
                // A named app so it can never be confused with the application's own Firebase project.
                const app = admin.initializeApp({ credential, storageBucket: this.bucketName }, `backup-${Date.now()}`);
                return admin.storage(app).bucket(this.bucketName);
            })();
        }
        return this.bucketPromise;
    }
    async put(key: string, filePath: string): Promise<StoredObject> {
        const bucket = await this.bucket();
        // `validation: "crc32c"` makes the SDK reject a corrupted upload. The returned
        // metadata is the upload response itself, so no read permission is needed.
        // `preconditionOpts.ifGenerationMatch: 0` = create only; never overwrite.
        const [, metadata] = await bucket.upload(filePath, {
            destination: key,
            validation: "crc32c",
            resumable: false,
            preconditionOpts: { ifGenerationMatch: 0 },
        });
        return { size: Number((metadata as { size?: string | number }).size) };
    }
    describe() {
        return `gs://${this.bucketName}`;
    }
}
