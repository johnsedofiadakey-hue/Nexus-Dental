"use client";

import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";
import { Toaster } from "@/components/ui/sonner";

interface DashboardLayoutProps {
    children: React.ReactNode;
    role: "SYSTEM_OWNER" | "STAFF" | "PATIENT";
    title: string;
    userName: string;
    userRoleLabel: string;
}

export function DashboardLayout({
    children,
    role,
    title,
    userName,
    userRoleLabel,
}: DashboardLayoutProps) {
    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            {/* Navigation Sidebar */}
            <Sidebar role={role} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <DashboardHeader
                    title={title}
                    userName={userName}
                    userRole={userRoleLabel}
                />

                <main className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-[1440px] mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
