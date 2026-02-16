// ============================================
// NEXUS DENTAL — System Owner Module Index
// ============================================

export {
    getTenantStats,
    changeTenantStatus,
    killSwitch,
    listTenants,
} from "./tenants";

export {
    enableMaintenance,
    disableMaintenance,
    isInMaintenance,
} from "./maintenance";

export {
    triggerBackup,
    listBackups,
    getBackupById,
} from "./backups";
export type { BackupMetadata } from "./backups";

export { getSystemHealth } from "./health";
export type { HealthReport } from "./health";

export { getTenantAnalytics } from "./analytics";
export type { AnalyticsSummary } from "./analytics";
