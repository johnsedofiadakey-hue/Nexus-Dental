"use client";

import { Bell, Search, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
    title: string;
    userName: string;
    userRole: string;
}

export function DashboardHeader({ title, userName, userRole }: DashboardHeaderProps) {
    const [notifications] = useState(3);

    return (
        <header className="h-[80px] border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-30 px-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-heading font-semibold text-slate-900">{title}</h1>
            </div>

            <div className="flex items-center gap-6">
                {/* Search */}
                <div className="relative hidden md:block w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Search anything..."
                        className="pl-10 h-10 bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 transition-all"
                    />
                </div>

                {/* Notifications */}
                <div className="relative">
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100 relative">
                        <Bell className="w-5 h-5 text-slate-600" />
                        {notifications > 0 && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                        )}
                    </Button>
                </div>

                {/* User Profile */}
                <div className="flex items-center gap-3 pl-6 border-l border-slate-100">
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
