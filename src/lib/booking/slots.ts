// ============================================
// NEXUS DENTAL — Slot Locking Service (Redis)
// Prevents double-booking via distributed locks
// ============================================

import redis from "@/lib/db/redis";
import { AUTH_CONFIG } from "@/lib/auth/types";

/**
 * Generate a unique slot key.
 * Format: slot:{tenantId}:{doctorId}:{date}:{time}
 */
function slotKey(
    tenantId: string,
    doctorId: string,
    date: string,
    time: string
): string {
    return `slot:${tenantId}:${doctorId}:${date}:${time}`;
}

/**
 * Attempt to acquire a lock on a time slot.
 * Uses Redis SET NX (set if not exists) with TTL.
 *
 * @returns lockId if acquired, null if slot is taken
 */
export async function acquireSlotLock(
    tenantId: string,
    doctorId: string,
    date: string,
    time: string,
    patientId: string
): Promise<string | null> {
    const key = slotKey(tenantId, doctorId, date, time);
    const lockId = `lock:${patientId}:${Date.now()}`;

    // SET key lockId NX EX ttl — only sets if key doesn't exist
    const result = await redis.set(
        key,
        lockId,
        "EX",
        AUTH_CONFIG.SLOT_LOCK_TTL_SECONDS,
        "NX"
    );

    if (result === "OK") {
        return lockId;
    }

    return null; // Slot already locked
}

/**
 * Release a slot lock (e.g., if patient cancels before confirming).
 * Only the holder of the lock can release it.
 */
export async function releaseSlotLock(
    tenantId: string,
    doctorId: string,
    date: string,
    time: string,
    lockId: string
): Promise<boolean> {
    const key = slotKey(tenantId, doctorId, date, time);

    // Verify this is the correct lock holder
    const currentLock = await redis.get(key);
    if (currentLock !== lockId) {
        return false; // Not the lock holder
    }

    await redis.del(key);
    return true;
}

/**
 * Confirm a slot (convert temporary lock to permanent booking).
 * Extends TTL to 24 hours (appointment window).
 */
export async function confirmSlotLock(
    tenantId: string,
    doctorId: string,
    date: string,
    time: string,
    lockId: string
): Promise<boolean> {
    const key = slotKey(tenantId, doctorId, date, time);

    const currentLock = await redis.get(key);
    if (currentLock !== lockId) {
        return false;
    }

    // Mark as confirmed and extend TTL
    await redis.set(key, `confirmed:${lockId}`, "EX", 86400); // 24 hours
    return true;
}

/**
 * Check if a slot is available.
 */
export async function isSlotAvailable(
    tenantId: string,
    doctorId: string,
    date: string,
    time: string
): Promise<boolean> {
    const key = slotKey(tenantId, doctorId, date, time);
    const exists = await redis.exists(key);
    return exists === 0;
}

/**
 * Get all locked slots for a doctor on a given date.
 * Used to calculate availability.
 */
export async function getLockedSlots(
    tenantId: string,
    doctorId: string,
    date: string
): Promise<string[]> {
    const pattern = slotKey(tenantId, doctorId, date, "*");
    const keys = await redis.keys(pattern);
    return keys.map((key) => {
        const parts = key.split(":");
        return parts[parts.length - 1]; // Extract time portion
    });
}
