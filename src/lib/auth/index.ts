// ============================================
// NEXUS DENTAL — Auth Module Index
// ============================================

export { signToken, signPatientToken, verifyToken, extractTokenFromHeader } from "./jwt";
export { hashPassword, verifyPassword, validatePasswordStrength } from "./password";
export { generateOTP, storeOTP, verifyOTP, invalidateOTP } from "./otp";
export { resolveUserPermissions, hasPermission, hasAllPermissions, hasAnyPermission } from "./permissions";
export {
    apiError,
    apiSuccess,
    authenticateRequest,
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
    EMERGENCY_KEYWORDS,
    AUTH_CONFIG,
} from "./types";
