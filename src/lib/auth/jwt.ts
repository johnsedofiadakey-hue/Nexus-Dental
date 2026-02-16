// ============================================
// NEXUS DENTAL — JWT Utilities
// ============================================

import jwt from "jsonwebtoken";
import { JWTPayload, PatientJWTPayload, AUTH_CONFIG } from "./types";

const JWT_SECRET = process.env.JWT_SECRET || "nexus-dental-jwt-secret-change-in-production";

/**
 * Sign a JWT token for staff or system owner.
 */
export function signToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: AUTH_CONFIG.JWT_EXPIRATION,
    });
}

/**
 * Sign a JWT token for patients (longer expiration).
 */
export function signPatientToken(payload: PatientJWTPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: AUTH_CONFIG.PATIENT_JWT_EXPIRATION,
    });
}

/**
 * Verify and decode a JWT token.
 * Returns null if invalid or expired.
 */
export function verifyToken(token: string): JWTPayload | PatientJWTPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload | PatientJWTPayload;
        return decoded;
    } catch {
        return null;
    }
}

/**
 * Extract token from Authorization header.
 * Supports: "Bearer <token>"
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
    if (!authHeader) return null;
    if (authHeader.startsWith("Bearer ")) {
        return authHeader.slice(7);
    }
    return null;
}
