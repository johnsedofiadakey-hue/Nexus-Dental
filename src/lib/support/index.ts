// ============================================
// NEXUS DENTAL — Support & Telehealth Module Index
// ============================================

export {
    triageTicket,
    shouldEscalate,
} from "./triage";
export type { TriageResult, TriageSeverity } from "./triage";

export {
    sendNotification,
    notifyAppointmentConfirmed,
    notifyAppointmentReminder,
    notifySupportUpdate,
    getNotificationHistory,
} from "./notifications";
export type { NotificationPayload, SendResult } from "./notifications";

export {
    createTelehealthSession,
    generateConsultationSummary,
} from "./telehealth";
export type {
    TelehealthSession,
    ConsultationSummary,
} from "./telehealth";
