import { describe, expect, it } from "vitest";
import {
    PERMISSIONS,
    DEFAULT_ROLE_PERMISSIONS,
    VALID_APPOINTMENT_TRANSITIONS,
    REOPENABLE_STATUSES,
    REOPEN_ALLOWED_ROLES,
    ROLE_PRIORITY,
    pickPrimaryRole,
    type UserRoleType,
} from "@/lib/auth/types";
import { validatePasswordStrength } from "@/lib/auth/password";

const ALL_PERMISSIONS = new Set<string>(Object.values(PERMISSIONS));
const has = (role: UserRoleType, perm: string) => DEFAULT_ROLE_PERMISSIONS[role].includes(perm);

describe("password strength policy", () => {
    it("accepts a password with every required character class", () => {
        expect(validatePasswordStrength("Str0ng!Passw0rd").valid).toBe(true);
    });

    it.each([
        ["too short", "Aa1!aaa"],
        ["no uppercase", "lowercase1!only"],
        ["no lowercase", "UPPERCASE1!ONLY"],
        ["no digit", "NoDigits!Here"],
        ["no special character", "NoSpecial1Here"],
    ])("rejects a password that is %s", (_label, pw) => {
        const result = validatePasswordStrength(pw);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("reports every failing rule, not just the first", () => {
        expect(validatePasswordStrength("a").errors.length).toBeGreaterThanOrEqual(4);
    });
});

describe("primary role selection", () => {
    it("picks the highest-authority role regardless of input order", () => {
        expect(pickPrimaryRole(["RECEPTIONIST", "DOCTOR"])).toBe("DOCTOR");
        expect(pickPrimaryRole(["DOCTOR", "RECEPTIONIST"])).toBe("DOCTOR");
        expect(pickPrimaryRole(["BILLING_STAFF", "ADMIN", "NURSE"])).toBe("ADMIN");
        expect(pickPrimaryRole(["ADMIN", "CLINIC_OWNER"])).toBe("CLINIC_OWNER");
    });

    it("falls back to the least-privileged staff role when there are none", () => {
        expect(pickPrimaryRole([])).toBe("RECEPTIONIST");
    });

    it("ranks every known role exactly once", () => {
        const known = Object.keys(DEFAULT_ROLE_PERMISSIONS).sort();
        expect([...ROLE_PRIORITY].sort()).toEqual(known);
    });
});

describe("role permission matrix (regression guard)", () => {
    it("only references permissions that exist (no typos)", () => {
        for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
            for (const p of perms) {
                expect(ALL_PERMISSIONS.has(p), `${role} has unknown permission ${p}`).toBe(true);
            }
        }
    });

    it("gives the system owner everything and clinic owners nothing platform-level", () => {
        expect(DEFAULT_ROLE_PERMISSIONS.SYSTEM_OWNER.length).toBe(ALL_PERMISSIONS.size);
        expect(DEFAULT_ROLE_PERMISSIONS.CLINIC_OWNER.some((p) => p.startsWith("system:"))).toBe(false);
    });

    it("limits refunds/voids (BILLING_VOID) to admins and owners", () => {
        const holders = (Object.keys(DEFAULT_ROLE_PERMISSIONS) as UserRoleType[]).filter((r) =>
            has(r, PERMISSIONS.BILLING_VOID)
        );
        expect(holders.sort()).toEqual(["ADMIN", "CLINIC_OWNER", "SYSTEM_OWNER"]);
    });

    it("limits staff management and clinic settings to admins and owners", () => {
        for (const perm of [PERMISSIONS.STAFF_VIEW, PERMISSIONS.STAFF_UPDATE, PERMISSIONS.SETTINGS_UPDATE]) {
            const holders = (Object.keys(DEFAULT_ROLE_PERMISSIONS) as UserRoleType[]).filter((r) => has(r, perm));
            expect(holders.sort(), perm).toEqual(["ADMIN", "CLINIC_OWNER", "SYSTEM_OWNER"]);
        }
    });

    it("only lets clinical roles dispense medication", () => {
        for (const role of ["DOCTOR", "NURSE", "ADMIN"] as UserRoleType[]) {
            expect(has(role, PERMISSIONS.PRESCRIPTIONS_DISPENSE), role).toBe(true);
        }
        for (const role of ["RECEPTIONIST", "BILLING_STAFF", "INVENTORY_MANAGER"] as UserRoleType[]) {
            expect(has(role, PERMISSIONS.PRESCRIPTIONS_DISPENSE), role).toBe(false);
        }
    });

    it("keeps front-desk and back-office roles away from clinical and financial authority", () => {
        expect(has("RECEPTIONIST", PERMISSIONS.BILLING_UPDATE)).toBe(false);
        expect(has("RECEPTIONIST", PERMISSIONS.PRESCRIPTIONS_CREATE)).toBe(false);
        expect(has("BILLING_STAFF", PERMISSIONS.PATIENTS_UPDATE)).toBe(false);
        expect(has("INVENTORY_MANAGER", PERMISSIONS.BILLING_VIEW)).toBe(false);
        expect(has("NURSE", PERMISSIONS.PRESCRIPTIONS_CREATE)).toBe(false);
    });
});

describe("appointment state machine", () => {
    const statuses = Object.keys(VALID_APPOINTMENT_TRANSITIONS);

    it("only transitions to statuses that exist", () => {
        for (const [from, targets] of Object.entries(VALID_APPOINTMENT_TRANSITIONS)) {
            for (const to of targets) {
                expect(statuses.includes(to), `${from} -> ${to}`).toBe(true);
            }
        }
    });

    it("does not allow skipping the clinical flow", () => {
        expect(VALID_APPOINTMENT_TRANSITIONS.SCHEDULED).not.toContain("COMPLETED");
        expect(VALID_APPOINTMENT_TRANSITIONS.SCHEDULED).not.toContain("IN_CHAIR");
        expect(VALID_APPOINTMENT_TRANSITIONS.CHECKED_IN).not.toContain("COMPLETED");
    });

    it("lets finished appointments only be reopened back to SCHEDULED", () => {
        for (const status of REOPENABLE_STATUSES) {
            expect(VALID_APPOINTMENT_TRANSITIONS[status], status).toEqual(["SCHEDULED"]);
        }
    });

    it("restricts reopening to owners and admins", () => {
        expect([...REOPEN_ALLOWED_ROLES].sort()).toEqual(["ADMIN", "CLINIC_OWNER", "SYSTEM_OWNER"]);
        for (const role of ["RECEPTIONIST", "DOCTOR", "NURSE", "BILLING_STAFF"]) {
            expect((REOPEN_ALLOWED_ROLES as readonly string[]).includes(role), role).toBe(false);
        }
    });
});
