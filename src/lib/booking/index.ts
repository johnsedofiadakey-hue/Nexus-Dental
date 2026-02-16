// ============================================
// NEXUS DENTAL — Booking Module Index
// ============================================

export {
    acquireSlotLock,
    releaseSlotLock,
    confirmSlotLock,
    isSlotAvailable,
    getLockedSlots,
} from "./slots";

export {
    getAvailableSlots,
    getWeekAvailability,
    getAvailableDoctors,
} from "./availability";

export type { TimeSlot, DaySchedule } from "./availability";
