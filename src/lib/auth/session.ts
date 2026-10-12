// ============================================
// NEXUS DENTAL — Server-controlled sessions
//
// A signed token proves nothing on its own: it carries an opaque random session
// id (`sid`), and a request is authenticated only while the matching
// `auth_sessions` row is live. Every request re-resolves the account, clinic,
// roles and permissions from the database, so suspending a user, changing a
// role, resetting a password or signing out takes effect immediately.
//
// Only the SHA-256 hash of the sid is stored. A database leak therefore yields
// no usable session id, and nothing here logs a token or a sid.
// ============================================

import { createHash, randomBytes } from "crypto";
import prisma from "@/lib/db/prisma";
import { resolveUserPermissions } from "./permissions";
import {
    SESSION_POLICY,
    pickPrimaryRole,
    type JWTPayload,
    type PatientJWTPayload,
    type UserRoleType,
} from "./types";

export type SessionRevokeReason =
    | "LOGOUT"
    | "SIGN_OUT_ALL"
    | "PASSWORD_RESET"
    | "PASSWORD_CHANGED"
    | "ACCOUNT_SUSPENDED"
    | "ROLE_CHANGED"
    | "PERMISSIONS_CHANGED"
    | "INVITE_ACCEPTED"
    | "PHONE_CHANGED";

export type SessionDenyReason =
    | "NO_SESSION" // legacy token without a sid
    | "UNKNOWN"
    | "MISMATCH"
    | "REVOKED"
    | "EXPIRED"
    | "IDLE_EXPIRED"
    | "ACCOUNT_INACTIVE"
    | "CLINIC_INACTIVE";

export type SessionResult =
    | { ok: true; user: JWTPayload | PatientJWTPayload; expiresAt: Date }
    | { ok: false; reason: SessionDenyReason };

/** Minimal client surface so callers can pass `prisma` or a transaction client. */
type SessionDb = {
    authSession: {
        create(args: { data: Record<string, unknown> }): Promise<unknown>;
        updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
    };
};

/** What a verified token tells us about itself — claims, not authority. */
export interface SessionClaims {
    sid?: string;
    type: "STAFF" | "PATIENT" | "SYSTEM_OWNER";
    userId?: string;
    patientId?: string;
}

export function generateSid(): string {
    return randomBytes(32).toString("base64url");
}

export function hashSid(sid: string): string {
    return createHash("sha256").update(sid).digest("hex");
}

const seconds = (n: number) => n * 1000;

function truncateAgent(userAgent?: string | null): string | null {
    return userAgent ? userAgent.slice(0, 200) : null;
}

export interface CreatedSession {
    sid: string;
    expiresAt: Date;
    /** Seconds the browser cookie should live (capped by the absolute limit). */
    maxAgeSeconds: number;
}

export async function createStaffSession(
    db: SessionDb,
    input: { userId: string; tenantId: string | null; userAgent?: string | null },
    now: Date = new Date()
): Promise<CreatedSession> {
    const sid = generateSid();
    const absolute = new Date(now.getTime() + seconds(SESSION_POLICY.STAFF_ABSOLUTE_SECONDS));
    await db.authSession.create({
        data: {
            sidHash: hashSid(sid),
            subjectType: "STAFF",
            tenantId: input.tenantId,
            userId: input.userId,
            idleExpiresAt: new Date(now.getTime() + seconds(SESSION_POLICY.STAFF_IDLE_SECONDS)),
            absoluteExpiresAt: absolute,
            lastSeenAt: now,
            userAgent: truncateAgent(input.userAgent),
        },
    });
    return { sid, expiresAt: absolute, maxAgeSeconds: SESSION_POLICY.STAFF_ABSOLUTE_SECONDS };
}

export async function createPatientSession(
    db: SessionDb,
    input: { patientId: string; tenantId: string; userAgent?: string | null },
    now: Date = new Date()
): Promise<CreatedSession> {
    const sid = generateSid();
    const absolute = new Date(now.getTime() + seconds(SESSION_POLICY.PATIENT_ABSOLUTE_SECONDS));
    const idle = new Date(now.getTime() + seconds(SESSION_POLICY.PATIENT_IDLE_SECONDS));
    await db.authSession.create({
        data: {
            sidHash: hashSid(sid),
            subjectType: "PATIENT",
            tenantId: input.tenantId,
            patientId: input.patientId,
            idleExpiresAt: idle,
            absoluteExpiresAt: absolute,
            lastSeenAt: now,
            userAgent: truncateAgent(input.userAgent),
        },
    });
    return { sid, expiresAt: idle, maxAgeSeconds: SESSION_POLICY.PATIENT_IDLE_SECONDS };
}

/**
 * Resolve a token payload to the CURRENT authority of its account.
 *
 * Throws on any database failure — the caller must treat a throw as "deny"
 * (fail closed), never as "allow".
 */
export async function resolveSession(
    claims: SessionClaims,
    now: Date = new Date()
): Promise<SessionResult> {
    if (!claims.sid) return { ok: false, reason: "NO_SESSION" };

    const row = await prisma.authSession.findUnique({
        where: { sidHash: hashSid(claims.sid) },
        include: {
            user: { include: { roles: true, tenant: true } },
            patient: { include: { tenant: true } },
        },
    });

    if (!row) return { ok: false, reason: "UNKNOWN" };
    if (row.revokedAt) return { ok: false, reason: "REVOKED" };
    if (row.absoluteExpiresAt <= now) return { ok: false, reason: "EXPIRED" };
    if (row.idleExpiresAt <= now) return { ok: false, reason: "IDLE_EXPIRED" };

    let result: SessionResult;

    if (row.subjectType === "PATIENT") {
        const patient = row.patient;
        if (claims.type !== "PATIENT" || !patient || claims.patientId !== patient.id) {
            return { ok: false, reason: "MISMATCH" };
        }
        if (patient.deletedAt) return { ok: false, reason: "ACCOUNT_INACTIVE" };
        if (row.tenantId !== patient.tenantId) return { ok: false, reason: "MISMATCH" };
        if (patient.tenant && patient.tenant.status !== "ACTIVE") {
            return { ok: false, reason: "CLINIC_INACTIVE" };
        }
        result = {
            ok: true,
            expiresAt: row.idleExpiresAt,
            user: {
                patientId: patient.id,
                tenantId: patient.tenantId,
                role: "PATIENT",
                type: "PATIENT",
                sid: claims.sid,
            },
        };
    } else {
        const user = row.user;
        if (claims.type === "PATIENT" || !user || claims.userId !== user.id) {
            return { ok: false, reason: "MISMATCH" };
        }
        if (user.status !== "ACTIVE" || user.deletedAt) return { ok: false, reason: "ACCOUNT_INACTIVE" };
        if (row.tenantId !== user.tenantId) return { ok: false, reason: "MISMATCH" };
        if (user.tenant && user.tenant.status !== "ACTIVE") {
            return { ok: false, reason: "CLINIC_INACTIVE" };
        }

        const roles = user.roles
            .map((r: { systemRole: UserRoleType | null }) => r.systemRole)
            .filter(Boolean) as UserRoleType[];
        // Strict: an unreadable override table must deny, not fall back to defaults.
        const permissions = await resolveUserPermissions(user.id, roles, user.tenantId, { strict: true });

        result = {
            ok: true,
            expiresAt: row.idleExpiresAt,
            user: {
                userId: user.id,
                tenantId: user.tenantId,
                role: pickPrimaryRole(roles),
                roles,
                permissions,
                featureFlags: [],
                type: roles.includes("SYSTEM_OWNER") ? "SYSTEM_OWNER" : "STAFF",
                sid: claims.sid,
            },
        };
    }

    // Rolling idle window, written at most once per TOUCH_INTERVAL per session.
    if (now.getTime() - row.lastSeenAt.getTime() >= seconds(SESSION_POLICY.TOUCH_INTERVAL_SECONDS)) {
        const idleSeconds =
            row.subjectType === "PATIENT" ? SESSION_POLICY.PATIENT_IDLE_SECONDS : SESSION_POLICY.STAFF_IDLE_SECONDS;
        const nextIdle = new Date(
            Math.min(now.getTime() + seconds(idleSeconds), row.absoluteExpiresAt.getTime())
        );
        await prisma.authSession.updateMany({
            where: { id: row.id, revokedAt: null },
            data: { lastSeenAt: now, idleExpiresAt: nextIdle },
        });
        result.expiresAt = nextIdle;
    }

    return result;
}

/** Revoke one session by its sid. Returns how many rows changed. */
export async function revokeSessionBySid(
    db: SessionDb,
    sid: string,
    reason: SessionRevokeReason,
    now: Date = new Date()
): Promise<number> {
    const { count } = await db.authSession.updateMany({
        where: { sidHash: hashSid(sid), revokedAt: null },
        data: { revokedAt: now, revokedReason: reason },
    });
    return count;
}

/** Revoke every live session of a staff account (optionally keeping one). */
export async function revokeUserSessions(
    db: SessionDb,
    userId: string,
    reason: SessionRevokeReason,
    opts: { exceptSid?: string; now?: Date } = {}
): Promise<number> {
    const { count } = await db.authSession.updateMany({
        where: {
            userId,
            revokedAt: null,
            ...(opts.exceptSid ? { NOT: { sidHash: hashSid(opts.exceptSid) } } : {}),
        },
        data: { revokedAt: opts.now ?? new Date(), revokedReason: reason },
    });
    return count;
}

/** Revoke every live session of a patient. */
export async function revokePatientSessions(
    db: SessionDb,
    patientId: string,
    reason: SessionRevokeReason,
    now: Date = new Date()
): Promise<number> {
    const { count } = await db.authSession.updateMany({
        where: { patientId, revokedAt: null },
        data: { revokedAt: now, revokedReason: reason },
    });
    return count;
}
