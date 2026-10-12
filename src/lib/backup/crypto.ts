// ============================================
// NEXUS DENTAL — Backup encryption
//
// Backups are encrypted with age (https://age-encryption.org) to one or more
// PUBLIC keys before they leave the machine that makes them. Whoever runs the
// backup (CI) therefore holds nothing that can read it; the private key is kept
// offline by the owner and supplied only to a restore, by file path.
// ============================================

import { createHash } from "crypto";
import fs from "fs";
import * as age from "age-encryption";

import { BACKUP_FORMAT_VERSION, MAX_BACKUP_BYTES } from "./constants";
export { BACKUP_FORMAT_VERSION, MAX_BACKUP_BYTES };

export type BackupErrorCode =
    | "NO_RECIPIENT"
    | "BAD_RECIPIENT"
    | "DUMP_FAILED"
    | "DUMP_TOO_SMALL"
    | "DUMP_TOO_LARGE"
    | "DUMP_INVALID"
    | "ENCRYPT_FAILED"
    | "UPLOAD_FAILED"
    | "VERIFY_FAILED"
    | "CHECKSUM_MISMATCH"
    | "DECRYPT_FAILED"
    | "BAD_IDENTITY"
    | "UNSAFE_TARGET"
    | "RESTORE_FAILED"
    | "INTEGRITY_FAILED";

export class BackupError extends Error {
    constructor(public code: BackupErrorCode, message: string) {
        super(message);
        this.name = "BackupError";
    }
}

/** Parse BACKUP_AGE_RECIPIENT: one or more `age1…` public keys separated by commas, spaces or newlines. */
export function parseRecipients(raw: string | undefined): string[] {
    const list = (raw ?? "").split(/[\s,]+/).filter(Boolean);
    if (list.length === 0) {
        throw new BackupError("NO_RECIPIENT", "BACKUP_AGE_RECIPIENT is not set; refusing to make an unencrypted backup.");
    }
    for (const r of list) {
        if (!/^age1[0-9a-z]{50,}$/.test(r)) {
            // A private key pasted here by mistake must never be echoed back.
            throw new BackupError("BAD_RECIPIENT", "BACKUP_AGE_RECIPIENT must contain only age public keys (age1…).");
        }
    }
    return list;
}

/** Short, non-secret identifier of a public key, for the backup record. */
export function recipientFingerprint(recipient: string): string {
    return createHash("sha256").update(recipient).digest("hex").slice(0, 16);
}

export async function encryptBytes(plain: Uint8Array, recipients: string[]): Promise<Uint8Array> {
    try {
        const enc = new age.Encrypter();
        for (const r of recipients) enc.addRecipient(r);
        return await enc.encrypt(plain);
    } catch {
        throw new BackupError("ENCRYPT_FAILED", "Encryption failed.");
    }
}

export async function decryptBytes(cipher: Uint8Array, identity: string): Promise<Uint8Array> {
    const key = identity.trim();
    if (!/^AGE-SECRET-KEY-1[0-9A-Z]+$/.test(key)) {
        throw new BackupError("BAD_IDENTITY", "The key file does not contain an age private key (AGE-SECRET-KEY-…).");
    }
    try {
        const dec = new age.Decrypter();
        dec.addIdentity(key);
        return await dec.decrypt(cipher);
    } catch {
        // Wrong key and tampered file are deliberately indistinguishable.
        throw new BackupError("DECRYPT_FAILED", "Could not decrypt: wrong key, or the file is damaged.");
    }
}

export function sha256Hex(data: Uint8Array): string {
    return createHash("sha256").update(data).digest("hex");
}

export function sha256File(filePath: string): string {
    return sha256Hex(fs.readFileSync(filePath));
}

/** Test/operator helper: a fresh key pair. The private half must never be stored by the app. */
export async function generateKeyPair(): Promise<{ identity: string; recipient: string }> {
    const identity = await age.generateIdentity();
    return { identity, recipient: await age.identityToRecipient(identity) };
}
