import type { ElementType } from "react";
import {
    Activity,
    BarChart2,
    Building2,
    Calendar,
    ClipboardList,
    Clock,
    DollarSign,
    FileText,
    FlaskConical,
    Globe,
    LayoutDashboard,
    LifeBuoy,
    MessageSquare,
    Package,
    Pill,
    Receipt,
    Scan,
    ScrollText,
    Settings,
    Shield,
    ShieldAlert,
    Sigma,
    Star,
    Stethoscope,
    Truck,
    Users,
    Video,
} from "lucide-react";
import type { UserRole } from "@/lib/hooks/use-current-user";

export type NavigationGroup =
    | "Today"
    | "Care"
    | "Operations"
    | "Finance"
    | "Patient experience"
    | "Administration"
    | "System";

export type NavigationItem = {
    label: string;
    shortLabel?: string;
    icon: ElementType;
    href: string;
    group: NavigationGroup;
    roles: UserRole[];
    permission?: string;
    featureFlag?: string;
    exact?: boolean;
};

const OWNER_ADMIN: UserRole[] = ["CLINIC_OWNER", "ADMIN"];
const CLINICAL: UserRole[] = ["CLINIC_OWNER", "ADMIN", "DOCTOR", "NURSE"];

const NAVIGATION: NavigationItem[] = [
    // System owner workspace
    { label: "Overview", icon: LayoutDashboard, href: "/system/dashboard", group: "System", roles: ["SYSTEM_OWNER"], exact: true },
    { label: "Clinics", icon: Building2, href: "/system/dashboard/tenants", group: "System", roles: ["SYSTEM_OWNER"], permission: "system:tenants:view" },
    { label: "Audit logs", icon: ShieldAlert, href: "/system/dashboard/audit", group: "System", roles: ["SYSTEM_OWNER"], permission: "system:audit" },
    { label: "System health", shortLabel: "Health", icon: Activity, href: "/system/dashboard/health", group: "System", roles: ["SYSTEM_OWNER"] },
    { label: "Settings", icon: Settings, href: "/system/dashboard/settings", group: "System", roles: ["SYSTEM_OWNER"], permission: "settings:view" },

    // Daily work
    { label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, href: "/dashboard", group: "Today", roles: ["CLINIC_OWNER", "ADMIN", "RECEPTIONIST"], exact: true },
    { label: "My schedule", shortLabel: "Home", icon: Stethoscope, href: "/doctor", group: "Today", roles: ["DOCTOR"], exact: true },
    { label: "Clinical workspace", shortLabel: "Clinical", icon: Stethoscope, href: "/clinical", group: "Today", roles: ["NURSE", "DOCTOR"], permission: "patients:view", exact: true },
    { label: "Appointments", shortLabel: "Schedule", icon: Calendar, href: "/appointments", group: "Today", roles: ["CLINIC_OWNER", "ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "BILLING_STAFF"], permission: "appointments:view" },
    { label: "Patients", icon: Users, href: "/patients", group: "Today", roles: ["CLINIC_OWNER", "ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "BILLING_STAFF"], permission: "patients:view" },
    { label: "Waitlist", shortLabel: "Queue", icon: Clock, href: "/waitlist", group: "Today", roles: ["CLINIC_OWNER", "ADMIN", "RECEPTIONIST"], permission: "appointments:view" },

    // Care delivery
    { label: "Dental chart", shortLabel: "Chart", icon: Scan, href: "/dental-chart", group: "Care", roles: CLINICAL, permission: "patients:view" },
    { label: "Treatment plans", shortLabel: "Treatment", icon: ClipboardList, href: "/treatment-plans", group: "Care", roles: CLINICAL, permission: "patients:view" },
    { label: "Lab orders", shortLabel: "Labs", icon: FlaskConical, href: "/lab-orders", group: "Care", roles: CLINICAL, permission: "patients:view" },
    { label: "Consent forms", shortLabel: "Consent", icon: ScrollText, href: "/consent", group: "Care", roles: CLINICAL, permission: "patients:view" },
    { label: "Pharmacy", icon: Pill, href: "/pharmacy", group: "Care", roles: ["CLINIC_OWNER", "ADMIN", "NURSE", "INVENTORY_MANAGER"], permission: "inventory:view", featureFlag: "enablePharmacy" },

    // Clinic operations
    { label: "Services", icon: Sigma, href: "/clinic-services", group: "Operations", roles: OWNER_ADMIN, permission: "services:view" },
    { label: "Inventory", icon: Package, href: "/inventory", group: "Operations", roles: ["CLINIC_OWNER", "ADMIN", "INVENTORY_MANAGER"], permission: "inventory:view", exact: true },
    { label: "Suppliers", icon: Truck, href: "/suppliers", group: "Operations", roles: ["CLINIC_OWNER", "ADMIN", "INVENTORY_MANAGER"], permission: "inventory:view" },
    { label: "Expenses", icon: Receipt, href: "/expenses", group: "Operations", roles: ["CLINIC_OWNER", "ADMIN", "INVENTORY_MANAGER", "BILLING_STAFF"], permission: "billing:view" },

    // Finance and reporting
    { label: "Finance", icon: DollarSign, href: "/finance", group: "Finance", roles: ["CLINIC_OWNER", "ADMIN", "BILLING_STAFF"], permission: "billing:view", exact: true },
    { label: "Invoices", icon: FileText, href: "/finance/invoices", group: "Finance", roles: ["CLINIC_OWNER", "ADMIN", "BILLING_STAFF"], permission: "billing:view" },
    { label: "Insurance", icon: Shield, href: "/insurance", group: "Finance", roles: ["CLINIC_OWNER", "ADMIN", "BILLING_STAFF"], permission: "billing:view" },
    { label: "Analytics", shortLabel: "Reports", icon: BarChart2, href: "/analytics", group: "Finance", roles: ["CLINIC_OWNER", "ADMIN", "BILLING_STAFF", "INVENTORY_MANAGER"], permission: "reports:view" },

    // Patient experience
    { label: "Reviews", icon: Star, href: "/reviews", group: "Patient experience", roles: OWNER_ADMIN, permission: "support:view" },
    { label: "Website content", shortLabel: "Website", icon: Globe, href: "/content", group: "Patient experience", roles: OWNER_ADMIN, permission: "settings:view" },
    { label: "Support", icon: LifeBuoy, href: "/support", group: "Patient experience", roles: ["CLINIC_OWNER", "ADMIN", "RECEPTIONIST"], permission: "support:view" },

    // Administration
    { label: "Staff & access", shortLabel: "Staff", icon: Users, href: "/dashboard/staff", group: "Administration", roles: OWNER_ADMIN, permission: "staff:view" },
    { label: "Clinic settings", shortLabel: "Settings", icon: Settings, href: "/dashboard/settings", group: "Administration", roles: OWNER_ADMIN, permission: "settings:view" },
    { label: "Security", icon: ShieldAlert, href: "/dashboard/security", group: "Administration", roles: OWNER_ADMIN, permission: "audit:view" },

    // Patient portal
    { label: "Home", icon: LayoutDashboard, href: "/portal", group: "Today", roles: ["PATIENT"], exact: true },
    { label: "My records", shortLabel: "Records", icon: FileText, href: "/portal/records", group: "Care", roles: ["PATIENT"] },
    { label: "Prescriptions", shortLabel: "Medicine", icon: Pill, href: "/portal/prescriptions", group: "Care", roles: ["PATIENT"], featureFlag: "enablePharmacy" },
    { label: "Telehealth", icon: Video, href: "/portal/telehealth", group: "Care", roles: ["PATIENT"], featureFlag: "enableTelehealth" },
    { label: "Messages", icon: MessageSquare, href: "/portal/messages", group: "Patient experience", roles: ["PATIENT"] },
];

const MOBILE_PRIORITIES: Record<UserRole, string[]> = {
    SYSTEM_OWNER: ["/system/dashboard", "/system/dashboard/tenants", "/system/dashboard/audit", "/system/dashboard/health"],
    CLINIC_OWNER: ["/dashboard", "/appointments", "/patients", "/waitlist"],
    ADMIN: ["/dashboard", "/appointments", "/patients", "/waitlist"],
    DOCTOR: ["/doctor", "/appointments", "/patients", "/clinical"],
    NURSE: ["/clinical", "/appointments", "/patients", "/pharmacy"],
    RECEPTIONIST: ["/dashboard", "/appointments", "/patients", "/waitlist"],
    INVENTORY_MANAGER: ["/inventory", "/pharmacy", "/suppliers", "/analytics"],
    BILLING_STAFF: ["/finance", "/finance/invoices", "/insurance", "/analytics"],
    PATIENT: ["/portal", "/portal/records", "/portal/prescriptions", "/portal/messages"],
};

type NavigationContext = {
    roles: UserRole[];
    permissions?: string[];
    featureFlags?: Record<string, boolean> | string[];
};

function featureIsEnabled(flags: NavigationContext["featureFlags"], feature?: string) {
    if (!feature || flags === undefined) return true;
    if (Array.isArray(flags)) return flags.includes(feature);
    return flags[feature] !== false;
}

export function buildNavigation({ roles, permissions, featureFlags }: NavigationContext) {
    const roleSet = new Set(roles);
    const permissionSet = permissions === undefined ? null : new Set(permissions);

    return NAVIGATION.filter((item) => {
        if (!item.roles.some((role) => roleSet.has(role))) return false;
        if (item.permission && permissionSet && !permissionSet.has(item.permission)) return false;
        return featureIsEnabled(featureFlags, item.featureFlag);
    });
}

export function buildMobileNavigation(items: NavigationItem[], primaryRole: UserRole) {
    const priority = MOBILE_PRIORITIES[primaryRole];
    const selected = priority
        .map((href) => items.find((item) => item.href === href))
        .filter((item): item is NavigationItem => Boolean(item));

    for (const item of items) {
        if (selected.length >= 4) break;
        if (!selected.some((candidate) => candidate.href === item.href)) selected.push(item);
    }

    return selected.slice(0, 4);
}

export function isNavigationItemActive(pathname: string, item: NavigationItem) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

