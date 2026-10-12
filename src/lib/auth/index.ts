// ============================================
// NEXUS DENTAL — Auth Module Index
// ============================================

export { signToken, signPatientToken, verifyToken, extractTokenFromHeader } from "./jwt";
export {
    createStaffSession,
    createPatientSession,
    resolveSession,
    revokeSessionBySid,
    revokeUserSessions,
    revokePatientSessions,
    hashSid,
    generateSid,
} from "./session";
export type { SessionRevokeReason, SessionDenyReason, SessionResult, CreatedSession } from "./session";
export { hashPassword, verifyPassword, validatePasswordStrength } from "./password";
export { generateOTP, storeOTP, verifyOTP, invalidateOTP } from "./otp";
export { resolveUserPermissions, hasPermission, hasAllPermissions, hasAnyPermission } from "./permissions";
export {
    apiError,
    apiSuccess,
    authenticateRequest,
    authenticateSession,
    requireAuth,
    requireRole,
    requirePermission,
    requireAnyPermission,
    enforceTenantScope,
    requireSystemOwner,
    getUserTenantId,
    composeMiddleware,
    isStaffUser,
    isPatientUser,
} from "./middleware";
export type {
    JWTPayload,
    PatientJWTPayload,
    SystemOwnerJWTPayload,
    AuthUser,
    UserRoleType,
    AuthResponse,
    LoginRequest,
    OTPRequest,
    OTPVerification,
} from "./types";
export {
    PERMISSIONS,
    DEFAULT_ROLE_PERMISSIONS,
    VALID_APPOINTMENT_TRANSITIONS,
    REOPENABLE_STATUSES,
    REOPEN_ALLOWED_ROLES,
    ROLE_PRIORITY,
    pickPrimaryRole,
    EMERGENCY_KEYWORDS,
    AUTH_CONFIG,
    SESSION_POLICY,
} from "./types";
