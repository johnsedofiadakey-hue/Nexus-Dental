"use client";

import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface DashboardHeaderProps {
    title: string;
    userName: string;
    userRole: string;
    onMenuClick?: () => void;
}

export function DashboardHeader({ title, userName, userRole, onMenuClick }: DashboardHeaderProps) {
    const [notifications] = useState(0);

    return (
        <header className="h-16 lg:h-[80px] border-b border-slate-100 bg-white/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button type="button" variant="ghost" size="icon" onClick={onMenuClick} className="lg:hidden" aria-label="Open navigation">
                    <Menu className="h-5 w-5" />
                </Button>
                <h1 className="truncate text-lg font-heading font-semibold text-slate-900 sm:text-xl">{title}</h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
                {/* Notifications */}
                <div className="relative hidden sm:block">
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 relative">
                        <Bell className="w-5 h-5 text-slate-600" />
                        {notifications > 0 && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                        )}
                    </Button>
                </div>

                {/* User Profile */}
                <div className="flex items-center gap-3 pl-2 sm:pl-4 lg:pl-6 border-l border-slate-100">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-slate-900 leading-none">{userName}</p>
                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">{userRole}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden text-slate-600 font-bold">
                        {userName.charAt(0)}
                    </div>
                </div>
            </div>
        </header>
    );
}
