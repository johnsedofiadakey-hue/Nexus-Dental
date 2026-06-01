"use client";

import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";
import { Toaster } from "@/components/ui/sonner";
import { useCurrentUser, roleLabel, type UserRole } from "@/lib/hooks/use-current-user";
import { Skeleton } from "@/components/ui/skeleton";

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
            <Sidebar role={resolvedRole} roles={resolvedRoles} />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <DashboardHeader
                    title={title}
                    userName={resolvedName}
                    userRole={resolvedRoleLabel}
                />
                <main className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-[1440px] mx-auto">
                        {children}
                    </div>
                </main>
            </div>
            <Toaster />
        </div>
    );
}
