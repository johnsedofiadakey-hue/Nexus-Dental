"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/hooks/use-current-user";
import {
    buildNavigation,
    isNavigationItemActive,
    type NavigationGroup,
    type NavigationItem,
} from "./navigation";

const GROUP_ORDER: NavigationGroup[] = [
    "Today",
    "Care",
    "Operations",
    "Finance",
    "Patient experience",
    "Administration",
    "System",
];

interface SidebarProps {
    role?: UserRole;
    roles?: UserRole[];
    permissions?: string[];
    featureFlags?: Record<string, boolean> | string[];
    clinicName?: string;
    clinicLogoUrl?: string | null;
    clinicPrimaryColor?: string | null;
    className?: string;
    onNavigate?: () => void;
    collapsible?: boolean;
}

function clinicInitials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase() || "ND";
}

export function Sidebar({
    role,
    roles = [],
    permissions,
    featureFlags,
    clinicName = "Nexus Dental",
    clinicLogoUrl,
    clinicPrimaryColor,
    className,
    onNavigate,
    collapsible = true,
}: SidebarProps) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const isCollapsed = collapsible && collapsed;
    const activeRoles = roles.length > 0 ? roles : (role ? [role] : []);
    const navItems = buildNavigation({ roles: activeRoles, permissions, featureFlags });

    const groupedItems = GROUP_ORDER.map((group) => ({
        group,
        items: navItems.filter((item) => item.group === group),
    })).filter(({ items }) => items.length > 0);

    return (
        <aside className={cn(
            "relative flex h-screen flex-col border-r border-slate-200 bg-white transition-[width] duration-300",
            isCollapsed ? "w-[80px]" : "w-[280px]",
            className,
        )}>
            <div className={cn("flex h-20 shrink-0 items-center", isCollapsed ? "justify-center px-3" : "px-5")}>
                <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-bold text-white shadow-sm"
                        style={{ backgroundColor: clinicPrimaryColor || "#0d9488" }}
                    >
                        {clinicLogoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={clinicLogoUrl} alt="" className="h-full w-full object-cover" />
                        ) : clinicInitials(clinicName)}
                    </div>
                    {!isCollapsed && (
                        <div className="min-w-0">
                            <p className="truncate text-base font-bold leading-tight text-slate-950">{clinicName}</p>
                            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">Clinic workspace</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
                {groupedItems.map(({ group, items }) => (
                    <div key={group} className="space-y-1">
                        {!isCollapsed && (
                            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                                {group}
                            </p>
                        )}
                        {items.map((item: NavigationItem) => {
                            const Icon = item.icon;
                            const isActive = isNavigationItemActive(pathname, item);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={onNavigate}
                                    title={isCollapsed ? item.label : undefined}
                                    aria-current={isActive ? "page" : undefined}
                                    className={cn(
                                        "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                                        isCollapsed && "justify-center",
                                        isActive
                                            ? "bg-teal-50 font-semibold text-teal-800"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                                    )}
                                >
                                    <Icon className={cn(
                                        "h-5 w-5 shrink-0 transition-colors",
                                        isActive ? "text-teal-600" : "text-slate-400 group-hover:text-slate-700",
                                    )} />
                                    {!isCollapsed && <span className="truncate text-sm">{item.label}</span>}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </div>

            <div className="shrink-0 border-t border-slate-100 p-3">
                <Button
                    variant="ghost"
                    onClick={async () => {
                        await fetch("/api/auth/logout", {
                            method: "POST",
                            credentials: "include",
                        }).catch(() => undefined);
                        onNavigate?.();
                        window.location.href = role === "PATIENT" ? "/auth/patient" : "/auth/staff";
                    }}
                    className={cn(
                        "w-full justify-start gap-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-700",
                        isCollapsed && "justify-center px-0",
                    )}
                >
                    <LogOut className="h-5 w-5 shrink-0" />
                    {!isCollapsed && <span>Sign out</span>}
                </Button>
            </div>

            {collapsible && (
                <button
                    type="button"
                    onClick={() => setCollapsed((current) => !current)}
                    className="absolute -right-3 top-10 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
                    aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
                >
                    {isCollapsed
                        ? <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                        : <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />}
                </button>
            )}
        </aside>
    );
}
