/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures and database stand-ins are intentionally loosely typed */
// A small stateful stand-in for the session-related tables, so the REAL
// session code (src/lib/auth/session.ts) runs against realistic behaviour:
// rows persist between calls, `updateMany` really filters, `include` really joins.
import { vi } from "vitest";
import { createHash } from "crypto";

export const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export interface FakeState {
    sessions: any[];
    users: Record<string, any>;
    patients: Record<string, any>;
    tenants: Record<string, any>;
}

export function makeFakeStore() {
    const state: FakeState = { sessions: [], users: {}, patients: {}, tenants: {} };
    let seq = 0;

    const matches = (row: any, where: any): boolean =>
        Object.entries(where ?? {}).every(([k, v]) => {
            if (k === "NOT") return !matches(row, v);
            if (v && typeof v === "object" && !(v instanceof Date)) return false;
            return row[k] === v;
        });

    const join = (row: any) => {
        const user = row.userId ? state.users[row.userId] : null;
        const patient = row.patientId ? state.patients[row.patientId] : null;
        return {
            ...row,
            user: user ? { ...user, tenant: user.tenantId ? state.tenants[user.tenantId] ?? null : null } : null,
            patient: patient ? { ...patient, tenant: state.tenants[patient.tenantId] ?? null } : null,
        };
    };

    const db: any = {
        authSession: {
            create: vi.fn(async ({ data }: any) => {
                const row = { id: `s${++seq}`, createdAt: new Date(), revokedAt: null, revokedReason: null, ...data };
                state.sessions.push(row);
                return row;
            }),
            findUnique: vi.fn(async ({ where }: any) => {
                const row = state.sessions.find((r) => matches(r, where));
                return row ? join(row) : null;
            }),
            updateMany: vi.fn(async ({ where, data }: any) => {
                const hit = state.sessions.filter((r) => matches(r, where));
                hit.forEach((r) => Object.assign(r, data));
                return { count: hit.length };
            }),
        },
        rolePermission: { findMany: vi.fn(async () => []) },
        userOverride: { findMany: vi.fn(async () => []) },
    };
    return { db, state };
}

export const activeUser = (over: object = {}) => ({
    id: "u1",
    tenantId: "tenant-a",
    status: "ACTIVE",
    deletedAt: null,
    roles: [{ systemRole: "DOCTOR" }],
    ...over,
});
export const activePatient = (over: object = {}) => ({ id: "p1", tenantId: "tenant-a", deletedAt: null, ...over });
export const activeTenant = (over: object = {}) => ({ id: "tenant-a", status: "ACTIVE", ...over });
