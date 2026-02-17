"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Users,
    Calendar,
    Stethoscope,
    Package,
    LifeBuoy,
    Settings,
    ShieldAlert,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Building2,
    Activity,
    MessageSquare,
    Video,
    Pill,
    Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

/**
 * Sidebar Navigation Links based on Role
 */
const NAV_ITEMS = {
    SYSTEM_OWNER: [
        { label: "Overview", icon: LayoutDashboard, href: "/system/dashboard" },
        { label: "Tenants", icon: Building2, href: "/system/dashboard/tenants" },
        { label: "Audit Logs", icon: ShieldAlert, href: "/system/dashboard/audit" },
        { label: "Health", icon: Activity, href: "/system/dashboard/health" },
        { label: "Settings", icon: Settings, href: "/system/dashboard/settings" },
    ],
    CLINIC_OWNER: [
        { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
        { label: "Employees", icon: Users, href: "/dashboard/staff" },
        { label: "Appointments", icon: Calendar, href: "/appointments" },
        { label: "Patients", icon: Users, href: "/patients" },
        { label: "Inventory", icon: Package, href: "/inventory" },
        { label: "Pharmacy", icon: Pill, href: "/dashboard/pharmacy" },
        { label: "Content Manager", icon: Globe, href: "/dashboard/content" },
        { label: "Settings", icon: Settings, href: "/dashboard/settings" },
    ],
    ADMIN: [
        { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
        { label: "Employees", icon: Users, href: "/dashboard/staff" },
        { label: "Appointments", icon: Calendar, href: "/appointments" },
        { label: "Patients", icon: Users, href: "/patients" },
        { label: "Inventory", icon: Package, href: "/inventory" },
        { label: "Pharmacy", icon: Pill, href: "/dashboard/pharmacy" },
        { label: "Content Manager", icon: Globe, href: "/dashboard/content" },
        { label: "Support", icon: LifeBuoy, href: "/support" },
        { label: "Settings", icon: Settings, href: "/dashboard/settings" },
    ],

    DOCTOR: [
        { label: "Clinical", icon: Stethoscope, href: "/clinical" },
        { label: "My Appointments", icon: Calendar, href: "/appointments/mine" },
        { label: "Patients", icon: Users, href: "/patients" },
    ],
    NURSE: [
        { label: "Clinical", icon: Stethoscope, href: "/clinical" },
        { label: "Pharmacy", icon: Pill, href: "/dashboard/pharmacy" },
        { label: "Appointments", icon: Calendar, href: "/appointments" },
        { label: "Patients", icon: Users, href: "/patients" },
    ],
    RECEPTIONIST: [
        { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
        { label: "Appointments", icon: Calendar, href: "/appointments" },
        { label: "Patients", icon: Users, href: "/patients" },
        { label: "Support", icon: LifeBuoy, href: "/support" },
    ],
    INVENTORY_MANAGER: [
        { label: "Inventory", icon: Package, href: "/inventory" },
        { label: "Purchase Orders", icon: ShieldAlert, href: "/inventory/orders" },
        { label: "Suppliers", icon: Building2, href: "/inventory/suppliers" },
    ],
    BILLING_STAFF: [
        { label: "Dashboard", icon: LayoutDashboard, href: "/finance" },
        { label: "Invoices", icon: Calendar, href: "/finance/invoices" },
        { label: "Payments", icon: Activity, href: "/finance/payments" },
        { label: "Reports", icon: ShieldAlert, href: "/finance/reports" },
    ],
    PATIENT: [
        { label: "Home", icon: LayoutDashboard, href: "/portal" },
        { label: "My Bookings", icon: Calendar, href: "/portal/bookings" },
        { label: "Telehealth", icon: Video, href: "/portal/telehealth" },
        { label: "Messages", icon: MessageSquare, href: "/portal/messages" },
    ],
};

interface SidebarProps {
    role?: UserRoleType; // DEPRECATED: Current primary role (still used for some logic)
    roles?: UserRoleType[]; // NEW: All assigned roles
    className?: string;
}

type UserRoleType = "SYSTEM_OWNER" | "CLINIC_OWNER" | "ADMIN" | "DOCTOR" | "NURSE" | "RECEPTIONIST" | "INVENTORY_MANAGER" | "BILLING_STAFF" | "PATIENT";

export function Sidebar({ role, roles = [], className }: SidebarProps) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    // Combine roles if roles prop is provided, otherwise fallback to singular role
    const activeRoles = roles.length > 0 ? roles : (role ? [role] : []);

    // Merge navigation items from all active roles
    const navItems = activeRoles.reduce((acc, r) => {
        const items = NAV_ITEMS[r as keyof typeof NAV_ITEMS] || [];
        items.forEach(item => {
            if (!acc.find(a => a.href === item.href)) {
                acc.push(item);
            }
        });
        return acc;
    }, [] as any[]);

    return (
        <div
            className={cn(
                "relative flex flex-col h-screen border-r border-slate-200 bg-white transition-all duration-300",
                collapsed ? "w-[80px]" : "w-[260px]",
                className
            )}
        >
            {/* Brand Logo */}
            <div className="flex h-[80px] items-center px-6">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="min-w-[40px] h-[40px] rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold">
                        ND
                    </div>
                    {!collapsed && (
                        <span className="font-heading text-xl font-bold text-slate-900 whitespace-nowrap">
                            Nexus Dental
                        </span>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
                                isActive
                                    ? "bg-teal-50 text-teal-700 shadow-sm"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <Icon
                                className={cn(
                                    "w-5 h-5 transition-colors",
                                    isActive ? "text-teal-600" : "text-slate-400 group-hover:text-slate-600"
                                )}
                            />
                            {!collapsed && (
                                <span className="text-sm font-medium">{item.label}</span>
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* Footer / User */}
            <div className="p-3 border-t border-slate-100">
                <Button
                    variant="ghost"
                    onClick={() => {
                        // Clear auth token
                        document.cookie = "nexus_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
                        // Redirect to appropriate login portal
                        const loginPortal = role === "PATIENT" ? "/auth/patient" : "/auth/staff";
                        window.location.href = loginPortal;
                    }}
                    className={cn(
                        "w-full justify-start gap-3 rounded-xl hover:bg-red-50 hover:text-red-700",
                        collapsed && "justify-center px-0"
                    )}
                >
                    <LogOut className="w-5 h-5" />
                    {!collapsed && <span>Logout</span>}
                </Button>
            </div>

            {/* Toggle Button */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-10 w-6 h-6 rounded-full border border-slate-200 bg-white flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors z-10"
            >
                {collapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
                )}
            </button>
        </div>
    );
}
