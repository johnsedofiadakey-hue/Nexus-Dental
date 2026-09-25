"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard, Users, Calendar, Stethoscope, Package, LifeBuoy,
    Settings, ShieldAlert, ChevronLeft, ChevronRight, LogOut, Building2,
    Activity, MessageSquare, Video, Pill, Globe, DollarSign, BarChart2,
    Star, FileText, Stethoscope as DocIcon, ClipboardList, Shield,
    FlaskConical, Truck, Receipt, Clock, ScrollText, Sigma, Scan
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type UserRoleType = "SYSTEM_OWNER" | "CLINIC_OWNER" | "ADMIN" | "DOCTOR" | "NURSE" | "RECEPTIONIST" | "INVENTORY_MANAGER" | "BILLING_STAFF" | "PATIENT";
type NavItem = { label: string; icon: React.ElementType; href: string };

const NAV_ITEMS: Record<UserRoleType, NavItem[]> = {
    SYSTEM_OWNER: [
        { label: "Overview",   icon: LayoutDashboard, href: "/system/dashboard" },
        { label: "Tenants",    icon: Building2,        href: "/system/dashboard/tenants" },
        { label: "Audit Logs", icon: ShieldAlert,      href: "/system/dashboard/audit" },
        { label: "Health",     icon: Activity,         href: "/system/dashboard/health" },
        { label: "Settings",   icon: Settings,         href: "/system/dashboard/settings" },
    ],
    CLINIC_OWNER: [
        { label: "Dashboard",        icon: LayoutDashboard, href: "/dashboard" },
        { label: "Staff",            icon: Users,           href: "/dashboard/staff" },
        { label: "Appointments",     icon: Calendar,        href: "/appointments" },
        { label: "Patients",         icon: Users,           href: "/patients" },
        { label: "Dental Chart",     icon: Scan,            href: "/dental-chart" },
        { label: "Treatment Plans",  icon: ClipboardList,   href: "/treatment-plans" },
        { label: "Lab Orders",       icon: FlaskConical,    href: "/lab-orders" },
        { label: "Consent Forms",    icon: ScrollText,      href: "/consent" },
        { label: "Services",         icon: Sigma,           href: "/clinic-services" },
        { label: "Inventory",        icon: Package,         href: "/inventory" },
        { label: "Pharmacy",         icon: Pill,            href: "/pharmacy" },
        { label: "Suppliers",        icon: Truck,           href: "/suppliers" },
        { label: "Expenses",         icon: Receipt,         href: "/expenses" },
        { label: "Waitlist",         icon: Clock,           href: "/waitlist" },
        { label: "Finance",          icon: DollarSign,      href: "/finance" },
        { label: "Invoices",         icon: FileText,        href: "/finance/invoices" },
        { label: "Insurance",        icon: Shield,          href: "/insurance" },
        { label: "Analytics",        icon: BarChart2,       href: "/analytics" },
        { label: "Reviews",          icon: Star,            href: "/reviews" },
        { label: "Content",          icon: Globe,           href: "/content" },
        { label: "Support",          icon: LifeBuoy,        href: "/support" },
        { label: "Settings",         icon: Settings,        href: "/dashboard/settings" },
        { label: "Security",         icon: ShieldAlert,     href: "/dashboard/security" },
    ],
    ADMIN: [
        { label: "Dashboard",        icon: LayoutDashboard, href: "/dashboard" },
        { label: "Staff",            icon: Users,           href: "/dashboard/staff" },
        { label: "Appointments",     icon: Calendar,        href: "/appointments" },
        { label: "Patients",         icon: Users,           href: "/patients" },
        { label: "Dental Chart",     icon: Scan,            href: "/dental-chart" },
        { label: "Treatment Plans",  icon: ClipboardList,   href: "/treatment-plans" },
        { label: "Lab Orders",       icon: FlaskConical,    href: "/lab-orders" },
        { label: "Consent Forms",    icon: ScrollText,      href: "/consent" },
        { label: "Services",         icon: Sigma,           href: "/clinic-services" },
        { label: "Inventory",        icon: Package,         href: "/inventory" },
        { label: "Pharmacy",         icon: Pill,            href: "/pharmacy" },
        { label: "Suppliers",        icon: Truck,           href: "/suppliers" },
        { label: "Expenses",         icon: Receipt,         href: "/expenses" },
        { label: "Waitlist",         icon: Clock,           href: "/waitlist" },
        { label: "Finance",          icon: DollarSign,      href: "/finance" },
        { label: "Invoices",         icon: FileText,        href: "/finance/invoices" },
        { label: "Insurance",        icon: Shield,          href: "/insurance" },
        { label: "Analytics",        icon: BarChart2,       href: "/analytics" },
        { label: "Reviews",          icon: Star,            href: "/reviews" },
        { label: "Content",          icon: Globe,           href: "/content" },
        { label: "Support",          icon: LifeBuoy,        href: "/support" },
        { label: "Settings",         icon: Settings,        href: "/dashboard/settings" },
        { label: "Security",         icon: ShieldAlert,     href: "/dashboard/security" },
    ],
    DOCTOR: [
        { label: "My Schedule",      icon: DocIcon,         href: "/doctor" },
        { label: "Appointments",     icon: Calendar,        href: "/appointments" },
        { label: "Patients",         icon: Users,           href: "/patients" },
        { label: "Clinical",         icon: Stethoscope,     href: "/clinical" },
        { label: "Dental Chart",     icon: Scan,            href: "/dental-chart" },
        { label: "Treatment Plans",  icon: ClipboardList,   href: "/treatment-plans" },
        { label: "Lab Orders",       icon: FlaskConical,    href: "/lab-orders" },
        { label: "Consent Forms",    icon: ScrollText,      href: "/consent" },
    ],
    NURSE: [
        { label: "Clinical",         icon: Stethoscope,     href: "/clinical" },
        { label: "Pharmacy",         icon: Pill,            href: "/pharmacy" },
        { label: "Appointments",     icon: Calendar,        href: "/appointments" },
        { label: "Patients",         icon: Users,           href: "/patients" },
        { label: "Consent Forms",    icon: ScrollText,      href: "/consent" },
    ],
    RECEPTIONIST: [
        { label: "Dashboard",        icon: LayoutDashboard, href: "/dashboard" },
        { label: "Appointments",     icon: Calendar,        href: "/appointments" },
        { label: "Patients",         icon: Users,           href: "/patients" },
        { label: "Waitlist",         icon: Clock,           href: "/waitlist" },
        { label: "Support",          icon: LifeBuoy,        href: "/support" },
    ],
    INVENTORY_MANAGER: [
        { label: "Inventory",        icon: Package,         href: "/inventory" },
        { label: "Pharmacy",         icon: Pill,            href: "/pharmacy" },
        { label: "Suppliers",        icon: Truck,           href: "/suppliers" },
        { label: "Expenses",         icon: Receipt,         href: "/expenses" },
    ],
    BILLING_STAFF: [
        { label: "Finance",          icon: DollarSign,      href: "/finance" },
        { label: "Invoices",         icon: FileText,        href: "/finance/invoices" },
        { label: "Insurance",        icon: Shield,          href: "/insurance" },
        { label: "Analytics",        icon: BarChart2,       href: "/analytics" },
        { label: "Expenses",         icon: Receipt,         href: "/expenses" },
    ],
    PATIENT: [
        { label: "Home",          icon: LayoutDashboard, href: "/portal" },
        { label: "My Records",    icon: FileText,        href: "/portal/records" },
        { label: "Prescriptions", icon: Pill,            href: "/portal/prescriptions" },
        { label: "Telehealth",    icon: Video,           href: "/portal/telehealth" },
        { label: "Messages",      icon: MessageSquare,   href: "/portal/messages" },
    ],
};

function navigationGroup(item: NavItem) {
    if (["/dashboard", "/appointments", "/patients", "/doctor", "/clinical"].includes(item.href)) return "Daily work";
    if (["/dental-chart", "/treatment-plans", "/lab-orders", "/consent"].includes(item.href)) return "Clinical care";
    if (["/clinic-services", "/inventory", "/pharmacy", "/suppliers", "/expenses", "/waitlist"].includes(item.href)) return "Operations";
    if (item.href.startsWith("/finance") || ["/insurance", "/analytics"].includes(item.href)) return "Finance";
    if (["/reviews", "/content", "/support"].includes(item.href)) return "Patient experience";
    if (item.href.includes("staff") || item.href.includes("settings")) return "Administration";
    return "Navigation";
}

interface SidebarProps {
    role?: UserRoleType;
    roles?: UserRoleType[];
    className?: string;
    onNavigate?: () => void;
}

export function Sidebar({ role, roles = [], className, onNavigate }: SidebarProps) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    const activeRoles = roles.length > 0 ? roles : (role ? [role] : []);

    const navItems = activeRoles.reduce((acc, r) => {
        const items = NAV_ITEMS[r as keyof typeof NAV_ITEMS] || [];
        items.forEach(item => {
            if (!acc.find(a => a.href === item.href)) acc.push(item);
        });
        return acc;
    }, [] as NavItem[]);

    const groupedItems = navItems.reduce<Record<string, NavItem[]>>((groups, item) => {
        const group = navItems.length > 8 ? navigationGroup(item) : "Navigation";
        groups[group] = [...(groups[group] || []), item];
        return groups;
    }, {});

    return (
        <div className={cn(
            "relative flex flex-col h-screen border-r border-slate-200 bg-white transition-all duration-300",
            collapsed ? "w-[80px]" : "w-[260px]",
            className
        )}>
            {/* Brand */}
            <div className="flex h-[80px] items-center px-6 shrink-0">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="min-w-[40px] h-[40px] rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        ND
                    </div>
                    {!collapsed && (
                        <span className="font-bold text-xl text-slate-900 whitespace-nowrap">Nexus Dental</span>
                    )}
                </div>
            </div>

            {/* Nav */}
            <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
                {Object.entries(groupedItems).map(([group, items]) => (
                    <div key={group} className="space-y-0.5">
                        {!collapsed && navItems.length > 8 && <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{group}</p>}
                        {items.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                            return (
                                <Link key={item.href} href={item.href} onClick={onNavigate}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
                                        isActive ? "bg-teal-50 text-teal-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    )}>
                                    <Icon className={cn("w-5 h-5 shrink-0 transition-colors", isActive ? "text-teal-600" : "text-slate-400 group-hover:text-slate-600")} />
                                    {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Logout */}
            <div className="p-3 border-t border-slate-100 shrink-0">
                <Button variant="ghost"
                    onClick={async () => {
                        await fetch("/api/auth/logout", {
                            method: "POST",
                            credentials: "include",
                        }).catch(() => undefined);
                        onNavigate?.();
                        window.location.href = role === "PATIENT" ? "/auth/patient" : "/auth/staff";
                    }}
                    className={cn("w-full justify-start gap-3 rounded-xl hover:bg-red-50 hover:text-red-700", collapsed && "justify-center px-0")}>
                    <LogOut className="w-5 h-5 shrink-0" />
                    {!collapsed && <span>Logout</span>}
                </Button>
            </div>

            {/* Collapse toggle */}
            <button onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-10 w-6 h-6 rounded-full border border-slate-200 bg-white flex items-center justify-center shadow-sm hover:bg-slate-50 z-10">
                {collapsed
                    ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    : <ChevronLeft  className="w-3.5 h-3.5 text-slate-500" />}
            </button>
        </div>
    );
}
