// ============================================
// NEXUS DENTAL — Clinical Module Index
// ============================================

export {
    completeSession,
} from "./session";
export type {
    SessionCompleteInput,
    SessionCompleteResult,
} from "./session";

export {
    deductInventoryForProcedure,
    adjustInventory,
    getLowStockItems,
} from "./inventory";
export type {
    InventoryDeduction,
    LowStockAlert,
} from "./inventory";

export {
    executeOverride,
    overrideAppointmentStatus,
    overrideBuffer,
    getOverrideHistory,
} from "./overrides";
export type { OverrideRequest } from "./overrides";
