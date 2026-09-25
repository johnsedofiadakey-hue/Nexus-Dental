"use client";

import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";
import { Toaster } from "@/components/ui/sonner";
import { useCurrentUser, roleLabel, type UserRole } from "@/lib/hooks/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";
import { PatientBottomNav } from "./PatientBottomNav";
import { useState } from "react";

interface DashboardLayoutProps {
    children: React.ReactNode;
    title: string;
    // Optional overrides — if omitted, values come from the JWT via useCurrentUser
    role?: UserRole;
    roles?: UserRole[];
    userName?: string;
    userRoleLabel?: string;
}

export function DashboardLayout({
    children,
    title,
    role: roleProp,
    roles: rolesProp = [],
    userName: userNameProp,
    userRoleLabel: userRoleLabelProp,
}: DashboardLayoutProps) {
    const { data: user, isLoading } = useCurrentUser();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const resolvedRole: UserRole = roleProp ?? user?.role ?? "RECEPTIONIST";
    const resolvedRoles: UserRole[] = rolesProp.length > 0 ? rolesProp : (user?.roles ?? [resolvedRole]);
    const resolvedName = userNameProp ?? (user ? `${user.firstName} ${user.lastName}` : "");
    const resolvedRoleLabel = userRoleLabelProp ?? roleLabel(resolvedRole);

    if (isLoading && !roleProp) {
        return (
            <div className="flex h-screen bg-slate-50 items-center justify-center">
                <div className="space-y-3 w-64">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar role={resolvedRole} roles={resolvedRoles} className="hidden lg:flex" />
            {mobileNavOpen && (
                <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
                    <button type="button" className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" />
                    <Sidebar role={resolvedRole} roles={resolvedRoles} onNavigate={() => setMobileNavOpen(false)} className="relative z-10 max-w-[86vw] shadow-2xl" />
                </div>
            )}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <DashboardHeader
                    title={title}
                    userName={resolvedName}
                    userRole={resolvedRoleLabel}
                    onMenuClick={() => setMobileNavOpen(true)}
                />
                <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${resolvedRole === "PATIENT" ? "pb-24 lg:pb-8" : "pb-8"}`}>
                    <div className="max-w-[1440px] mx-auto">
                        {children}
                    </div>
                </main>
            </div>
            {resolvedRole === "PATIENT" && <PatientBottomNav onMore={() => setMobileNavOpen(true)} />}
            <Toaster />
        </div>
    );
}
