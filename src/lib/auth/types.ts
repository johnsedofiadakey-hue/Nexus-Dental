// ============================================
// NEXUS DENTAL — Auth Types & Constants
// ============================================

export interface JWTPayload {
    userId: string;
    tenantId: string | null;
    role: UserRoleType;
    permissions: string[];
    featureFlags: string[];
    type: "STAFF" | "PATIENT" | "SYSTEM_OWNER";
}

export interface PatientJWTPayload {
    patientId: string;
    tenantId: string;
    role: "PATIENT";
    type: "PATIENT";
}

export interface SystemOwnerJWTPayload {
    userId: string;
    tenantId: null;
    role: "SYSTEM_OWNER";
    permissions: string[];
    featureFlags: string[];
    type: "SYSTEM_OWNER";
}

export type UserRoleType =
    | "SYSTEM_OWNER"
    | "ADMIN"
    | "DOCTOR"
    | "NURSE"
    | "RECEPTIONIST"
    | "INVENTORY_MANAGER"
    | "BILLING_STAFF";

export type AuthUser = JWTPayload | PatientJWTPayload;

export interface OTPRequest {
    phone: string;
    tenantId: string;
}

export interface OTPVerification {
    phone: string;
    tenantId: string;
    otp: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface AuthResponse {
    success: boolean;
    token?: string;
    user?: {
        id: string;
        email?: string;
        firstName: string;
        lastName: string;
        role: string;
        tenantId?: string | null;
    };
    message?: string;
}

// ─────────────────────────────────────────────
// Permission Constants
// ─────────────────────────────────────────────

export const PERMISSIONS = {
    // Appointments
    APPOINTMENTS_VIEW: "appointments:view",
    APPOINTMENTS_CREATE: "appointments:create",
    APPOINTMENTS_UPDATE: "appointments:update",
    APPOINTMENTS_DELETE: "appointments:delete",
    APPOINTMENTS_OVERRIDE: "appointments:override",

    // Patients
    PATIENTS_VIEW: "patients:view",
    PATIENTS_CREATE: "patients:create",
    PATIENTS_UPDATE: "patients:update",
    PATIENTS_DELETE: "patients:delete",

    // Inventory
    INVENTORY_VIEW: "inventory:view",
    INVENTORY_CREATE: "inventory:create",
    INVENTORY_UPDATE: "inventory:update",
    INVENTORY_ADJUST: "inventory:adjust",
    INVENTORY_OVERRIDE: "inventory:override",

    // Billing
    BILLING_VIEW: "billing:view",
    BILLING_CREATE: "billing:create",
    BILLING_UPDATE: "billing:update",
    BILLING_VOID: "billing:void",

    // Prescriptions
    PRESCRIPTIONS_VIEW: "prescriptions:view",
    PRESCRIPTIONS_CREATE: "prescriptions:create",
    PRESCRIPTIONS_UPDATE: "prescriptions:update",

    // Support
    SUPPORT_VIEW: "support:view",
    SUPPORT_RESPOND: "support:respond",
    SUPPORT_ESCALATE: "support:escalate",
    SUPPORT_CLOSE: "support:close",

    // Reports
    REPORTS_VIEW: "reports:view",
    REPORTS_EXPORT: "reports:export",

    // Staff Management
    STAFF_VIEW: "staff:view",
    STAFF_CREATE: "staff:create",
    STAFF_UPDATE: "staff:update",
    STAFF_DELETE: "staff:delete",

    // Settings
    SETTINGS_VIEW: "settings:view",
    SETTINGS_UPDATE: "settings:update",

    // Audit
    AUDIT_VIEW: "audit:view",

    // System (System Owner only)
    SYSTEM_TENANTS_VIEW: "system:tenants:view",
    SYSTEM_TENANTS_MANAGE: "system:tenants:manage",
    SYSTEM_BACKUP: "system:backup",
    SYSTEM_RESTORE: "system:restore",
    SYSTEM_KILL_SWITCH: "system:kill_switch",
    SYSTEM_AUDIT: "system:audit",
    SYSTEM_API_KEYS: "system:api_keys",
} as const;

// ─────────────────────────────────────────────
// Default Role Permissions
// ─────────────────────────────────────────────

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRoleType, string[]> = {
    SYSTEM_OWNER: Object.values(PERMISSIONS),

    ADMIN: [
        PERMISSIONS.APPOINTMENTS_VIEW,
        PERMISSIONS.APPOINTMENTS_CREATE,
        PERMISSIONS.APPOINTMENTS_UPDATE,
        PERMISSIONS.APPOINTMENTS_DELETE,
        PERMISSIONS.APPOINTMENTS_OVERRIDE,
        PERMISSIONS.PATIENTS_VIEW,
        PERMISSIONS.PATIENTS_CREATE,
        PERMISSIONS.PATIENTS_UPDATE,
        PERMISSIONS.PATIENTS_DELETE,
        PERMISSIONS.INVENTORY_VIEW,
        PERMISSIONS.INVENTORY_CREATE,
        PERMISSIONS.INVENTORY_UPDATE,
        PERMISSIONS.INVENTORY_ADJUST,
        PERMISSIONS.INVENTORY_OVERRIDE,
        PERMISSIONS.BILLING_VIEW,
        PERMISSIONS.BILLING_CREATE,
        PERMISSIONS.BILLING_UPDATE,
        PERMISSIONS.BILLING_VOID,
        PERMISSIONS.PRESCRIPTIONS_VIEW,
        PERMISSIONS.PRESCRIPTIONS_CREATE,
        PERMISSIONS.PRESCRIPTIONS_UPDATE,
        PERMISSIONS.SUPPORT_VIEW,
        PERMISSIONS.SUPPORT_RESPOND,
        PERMISSIONS.SUPPORT_ESCALATE,
        PERMISSIONS.SUPPORT_CLOSE,
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.REPORTS_EXPORT,
        PERMISSIONS.STAFF_VIEW,
        PERMISSIONS.STAFF_CREATE,
        PERMISSIONS.STAFF_UPDATE,
        PERMISSIONS.STAFF_DELETE,
        PERMISSIONS.SETTINGS_VIEW,
        PERMISSIONS.SETTINGS_UPDATE,
        PERMISSIONS.AUDIT_VIEW,
    ],

    DOCTOR: [
        PERMISSIONS.APPOINTMENTS_VIEW,
        PERMISSIONS.APPOINTMENTS_UPDATE,
        PERMISSIONS.PATIENTS_VIEW,
        PERMISSIONS.PATIENTS_UPDATE,
        PERMISSIONS.PRESCRIPTIONS_VIEW,
        PERMISSIONS.PRESCRIPTIONS_CREATE,
        PERMISSIONS.PRESCRIPTIONS_UPDATE,
        PERMISSIONS.SUPPORT_VIEW,
        PERMISSIONS.SUPPORT_RESPOND,
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.INVENTORY_VIEW,
    ],

    NURSE: [
        PERMISSIONS.APPOINTMENTS_VIEW,
        PERMISSIONS.APPOINTMENTS_UPDATE,
        PERMISSIONS.PATIENTS_VIEW,
        PERMISSIONS.PATIENTS_UPDATE,
        PERMISSIONS.PRESCRIPTIONS_VIEW,
        PERMISSIONS.SUPPORT_VIEW,
        PERMISSIONS.INVENTORY_VIEW,
    ],

    RECEPTIONIST: [
        PERMISSIONS.APPOINTMENTS_VIEW,
        PERMISSIONS.APPOINTMENTS_CREATE,
        PERMISSIONS.APPOINTMENTS_UPDATE,
        PERMISSIONS.PATIENTS_VIEW,
        PERMISSIONS.PATIENTS_CREATE,
        PERMISSIONS.PATIENTS_UPDATE,
        PERMISSIONS.BILLING_VIEW,
        PERMISSIONS.BILLING_CREATE,
        PERMISSIONS.SUPPORT_VIEW,
        PERMISSIONS.SUPPORT_RESPOND,
    ],

    INVENTORY_MANAGER: [
        PERMISSIONS.INVENTORY_VIEW,
        PERMISSIONS.INVENTORY_CREATE,
        PERMISSIONS.INVENTORY_UPDATE,
        PERMISSIONS.INVENTORY_ADJUST,
        PERMISSIONS.REPORTS_VIEW,
    ],

    BILLING_STAFF: [
        PERMISSIONS.BILLING_VIEW,
        PERMISSIONS.BILLING_CREATE,
        PERMISSIONS.BILLING_UPDATE,
        PERMISSIONS.PATIENTS_VIEW,
        PERMISSIONS.APPOINTMENTS_VIEW,
        PERMISSIONS.REPORTS_VIEW,
    ],
};

// ─────────────────────────────────────────────
// Appointment State Machine
// ─────────────────────────────────────────────

export const VALID_APPOINTMENT_TRANSITIONS: Record<string, string[]> = {
    SCHEDULED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
    CHECKED_IN: ["IN_IMAGING", "IN_CHAIR"],
    IN_IMAGING: ["IN_CHAIR"],
    IN_CHAIR: ["COMPLETED"],
    COMPLETED: ["CHECKOUT"],
    CHECKOUT: [],
    CANCELLED: [],
    NO_SHOW: [],
};

// ─────────────────────────────────────────────
// Emergency Keywords for Support Triage
// ─────────────────────────────────────────────

export const EMERGENCY_KEYWORDS = [
    "bleeding",
    "severe pain",
    "swelling",
    "knocked out",
    "broken tooth",
    "abscess",
    "trauma",
    "unbearable",
    "can't stop bleeding",
    "face swollen",
];

// ─────────────────────────────────────────────
// Configuration Constants
// ─────────────────────────────────────────────

export const AUTH_CONFIG = {
    JWT_EXPIRATION: "24h",
    PATIENT_JWT_EXPIRATION: "7d",
    OTP_TTL_SECONDS: 300, // 5 minutes
    OTP_LENGTH: 6,
    MAX_OTP_ATTEMPTS: 3,
    SLOT_LOCK_TTL_SECONDS: 600, // 10 minutes
    SANITIZATION_BUFFER_MINUTES: 15,
    BCRYPT_ROUNDS: 12,
} as const;
