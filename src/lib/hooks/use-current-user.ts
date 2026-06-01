"use client";

import { useQuery } from "@tanstack/react-query";

export type UserRole =
    | "SYSTEM_OWNER"
    | "CLINIC_OWNER"
    | "ADMIN"
    | "DOCTOR"
    | "NURSE"
    | "RECEPTIONIST"
    | "INVENTORY_MANAGER"
    | "BILLING_STAFF"
    | "PATIENT";

export interface CurrentUser {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    role: UserRole;
    roles: UserRole[];
    tenantId: string | null;
    type: "STAFF" | "PATIENT" | "SYSTEM_OWNER";
    permissions?: string[];
    featureFlags?: string[];
}

async function fetchCurrentUser(): Promise<CurrentUser> {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) throw new Error("Not authenticated");
    const json = await res.json();
    return json.data as CurrentUser;
}

export function useCurrentUser() {
    return useQuery<CurrentUser, Error>({
        queryKey: ["current-user"],
        queryFn: fetchCurrentUser,
        staleTime: 5 * 60 * 1000,
        retry: false,
    });
}

export function roleLabel(role: UserRole): string {
    const map: Record<UserRole, string> = {
        SYSTEM_OWNER: "System Owner",
        CLINIC_OWNER: "Clinic Owner",
        ADMIN: "Administrator",
        DOCTOR: "Doctor",
        NURSE: "Nurse",
        RECEPTIONIST: "Receptionist",
        INVENTORY_MANAGER: "Inventory Manager",
        BILLING_STAFF: "Billing Staff",
        PATIENT: "Patient",
    };
    return map[role] ?? role;
}
