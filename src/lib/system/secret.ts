// ============================================
// NEXUS DENTAL — Shared-secret comparison for system-to-system callers
//
// The backup callback and the operations watchdog authenticate with their own
// dedicated secrets (never a user JWT, never each other's secret). Comparison is
// constant-time and length-independent: both sides are hashed first.
// ============================================

import { createHash, timingSafeEqual } from "crypto";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/** True only when a secret is configured, one was supplied, and they are identical. */
export function secretMatches(provided: string | null | undefined, expected: string | null | undefined): boolean {
    if (!expected || !provided) return false;
    return timingSafeEqual(digest(provided), digest(expected));
}

/** Minimum length for a secret the app will accept as configured (openssl rand -hex 32 is 64). */
export const MIN_SHARED_SECRET_LENGTH = 24;

export function isUsableSecret(value: string | undefined): value is string {
    return typeof value === "string" && value.length >= MIN_SHARED_SECRET_LENGTH && !/^(?:generate-with|changeme|change-me|your[-_]|placeholder)/i.test(value);
}
