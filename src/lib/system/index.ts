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
    recordBackup,
    triggerManualBackup,
    listBackups,
    getBackupById,
} from "./backups";
export type { BackupRecordInput } from "./backups";

export { getSystemHealth } from "./health";
export type { HealthReport } from "./health";

export { getTenantAnalytics } from "./analytics";
export type { AnalyticsSummary } from "./analytics";
