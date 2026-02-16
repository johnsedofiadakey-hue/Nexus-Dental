// ============================================
// NEXUS DENTAL — OTP Service (Redis-backed)
// ============================================

import crypto from "crypto";
import redis from "@/lib/db/redis";
import { AUTH_CONFIG } from "./types";

/**
 * Generate a cryptographically-secure random OTP.
 */
export function generateOTP(): string {
    const max = Math.pow(10, AUTH_CONFIG.OTP_LENGTH);
    const min = Math.pow(10, AUTH_CONFIG.OTP_LENGTH - 1);
    const otp = crypto.randomInt(min, max);
    return otp.toString();
}

/**
 * Hash an OTP for secure storage.
 */
export function hashOTP(otp: string): string {
    return crypto.createHash("sha256").update(otp).digest("hex");
}

/**
 * Store a hashed OTP in Redis with TTL.
 * Key format: otp:{tenantId}:{phone}
 */
export async function storeOTP(
    tenantId: string,
    phone: string,
    otp: string
): Promise<void> {
    const key = `otp:${tenantId}:${phone}`;
    const hashedOTP = hashOTP(otp);
    const attemptsKey = `otp_attempts:${tenantId}:${phone}`;

    // Store hashed OTP with TTL
    await redis.set(key, hashedOTP, "EX", AUTH_CONFIG.OTP_TTL_SECONDS);

    // Reset attempts counter
    await redis.set(attemptsKey, "0", "EX", AUTH_CONFIG.OTP_TTL_SECONDS);
}

/**
 * Verify an OTP against the stored hash.
 * Enforces max attempts and cleans up on success.
 */
export async function verifyOTP(
    tenantId: string,
    phone: string,
    otp: string
): Promise<{ valid: boolean; error?: string }> {
    const key = `otp:${tenantId}:${phone}`;
    const attemptsKey = `otp_attempts:${tenantId}:${phone}`;

    // Check attempts
    const attempts = await redis.get(attemptsKey);
    if (attempts && parseInt(attempts) >= AUTH_CONFIG.MAX_OTP_ATTEMPTS) {
        // Clean up
        await redis.del(key, attemptsKey);
        return { valid: false, error: "Maximum OTP attempts exceeded. Please request a new code." };
    }

    // Get stored hash
    const storedHash = await redis.get(key);
    if (!storedHash) {
        return { valid: false, error: "OTP expired or not found. Please request a new code." };
    }

    // Verify
    const inputHash = hashOTP(otp);
    if (inputHash !== storedHash) {
        // Increment attempts
        await redis.incr(attemptsKey);
        return { valid: false, error: "Invalid OTP. Please try again." };
    }

    // Clean up on success
    await redis.del(key, attemptsKey);
    return { valid: true };
}

/**
 * Invalidate any existing OTP for a phone number.
 */
export async function invalidateOTP(
    tenantId: string,
    phone: string
): Promise<void> {
    const key = `otp:${tenantId}:${phone}`;
    const attemptsKey = `otp_attempts:${tenantId}:${phone}`;
    await redis.del(key, attemptsKey);
}
