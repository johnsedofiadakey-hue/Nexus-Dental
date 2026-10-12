// ============================================
// NEXUS DENTAL — Reminder dispatch (one reminder, at most one SMS)
//
// Called by the appointment worker for a reminder job, and by the reconciler's jobs.
//
//   1. look the reminder up; SENT / CANCELLED  => nothing to do (idempotent)
//   2. check the appointment is still SCHEDULED, at the time the reminder was made for,
//      and that the clinic still has reminders on
//   3. CLAIM it with one conditional UPDATE - concurrent or retried jobs cannot both win
//   4. send ONE SMS through the provider-neutral service
//   5. record SENT + the provider's campaign id (accepted, not delivered), a Notification
//      row and an audit entry - or record FAILED with a redacted reason and let the queue retry
//
// "At most once after a provider-accepted response has been recorded": a reminder that is
// SENT is never sent again. The one unavoidable window is a crash BETWEEN the provider
// accepting the message and us recording it; the claim lease (10 min) bounds it and the
// risk is documented in docs/LIVE_DEMO_AND_SMS.md.
// ============================================

import { randomUUID } from "crypto";
import { logAudit } from "@/lib/audit/logger";
import { toE164 } from "@/lib/phone";
import { SmsError, sendSms, type SmsSendResult } from "@/lib/sms";
import { clinicTimeZone, formatInZone } from "@/lib/utils/timezone";
import { redactText } from "@/lib/utils/redact";
import { REMINDER_CLAIM_LEASE_MS, NO_REMINDER_APPOINTMENT_STATUSES } from "./constants";
import { reminderMessage } from "./copy";
import { smsRemindersState } from "./settings";

export type DispatchOutcome =
    | { result: "sent"; providerMessageId: string }
    | { result: "skipped"; reason: "NOT_FOUND" | "ALREADY_SENT" | "CANCELLED" | "NOT_SCHEDULED" | "APPOINTMENT_CHANGED" | "DISABLED" | "TOO_LATE" | "NOT_CLAIMED" };

/** Thrown after a failure has been recorded, so the queue's retry policy takes over. */
export class ReminderDeliveryError extends Error {
    constructor(message: string, public retryable: boolean, public code: string) {
        super(message);
        this.name = "ReminderDeliveryError";
    }
}

export interface DispatchDeps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: any;
    sms?: (to: string, message: string) => Promise<SmsSendResult>;
    now?: () => Date;
    remindersEnabled?: (tenantId: string) => Promise<{ enabled: boolean; reason?: string }>;
    audit?: typeof logAudit;
}

/** A reminder this close to (or past) the appointment is no use to anyone. */
export const MIN_MINUTES_BEFORE_APPOINTMENT = 5;

export async function dispatchReminder(reminderId: string, deps: DispatchDeps): Promise<DispatchOutcome> {
    const db = deps.db;
    const now = (deps.now ?? (() => new Date()))();
    const send = deps.sms ?? ((to: string, message: string) => sendSms(to, message));
    const audit = deps.audit ?? logAudit;
    const enabled = deps.remindersEnabled ?? ((tenantId: string) => smsRemindersState(tenantId));

    const reminder = await db.appointmentReminder.findUnique({ where: { id: reminderId } });
    if (!reminder) return { result: "skipped", reason: "NOT_FOUND" };
    if (reminder.status === "SENT") return { result: "skipped", reason: "ALREADY_SENT" };
    if (reminder.status === "CANCELLED") return { result: "skipped", reason: "CANCELLED" };

    const cancel = async (reason: string, outcome: DispatchOutcome): Promise<DispatchOutcome> => {
        await db.appointmentReminder.updateMany({
            where: { id: reminderId, status: { in: ["PENDING", "FAILED", "PROCESSING"] } },
            data: { status: "CANCELLED", lastError: reason, claimToken: null, claimedAt: null },
        });
        return outcome;
    };

    const load = () =>
        db.appointment.findUnique({
            where: { id: reminder.appointmentId },
            include: { patient: true, doctor: true, tenant: { include: { settings: true } } },
        });
    let appointment = await load();
    if (!appointment || appointment.deletedAt) return cancel("The appointment no longer exists.", { result: "skipped", reason: "NOT_FOUND" });

    const stale = (a: typeof appointment): DispatchOutcome | null => {
        if (a.status !== "SCHEDULED" || (NO_REMINDER_APPOINTMENT_STATUSES as readonly string[]).includes(a.status)) return { result: "skipped", reason: "NOT_SCHEDULED" };
        if (new Date(a.dateTime).getTime() !== new Date(reminder.appointmentAt).getTime()) return { result: "skipped", reason: "APPOINTMENT_CHANGED" };
        return null;
    };
    const early = stale(appointment);
    if (early) return cancel(early.result === "skipped" && early.reason === "APPOINTMENT_CHANGED" ? "The appointment time changed." : `Appointment is ${appointment.status}.`, early);

    const minutesUntil = (new Date(appointment.dateTime).getTime() - now.getTime()) / 60_000;
    if (minutesUntil < MIN_MINUTES_BEFORE_APPOINTMENT) return cancel("Too close to (or past) the appointment time.", { result: "skipped", reason: "TOO_LATE" });

    const state = await enabled(reminder.tenantId);
    if (!state.enabled) return cancel(`Reminders are off (${state.reason ?? "disabled"}).`, { result: "skipped", reason: "DISABLED" });

    // ── CLAIM: one conditional UPDATE decides who sends ─────────────────────────────
    const token = randomUUID();
    const claim = await db.appointmentReminder.updateMany({
        where: {
            id: reminderId,
            OR: [
                { status: { in: ["PENDING", "FAILED"] } },
                { status: "PROCESSING", claimedAt: { lte: new Date(now.getTime() - REMINDER_CLAIM_LEASE_MS) } },
            ],
        },
        data: { status: "PROCESSING", claimToken: token, claimedAt: now, attempts: { increment: 1 } },
    });
    if (claim.count !== 1) return { result: "skipped", reason: "NOT_CLAIMED" };

    const fail = async (error: unknown): Promise<never> => {
        const sms = error instanceof SmsError ? error : null;
        const code = sms?.code ?? "UNEXPECTED";
        const message = redactText(sms ? `${sms.code}: ${sms.message}` : "Unexpected error while sending the reminder.", 200);
        await db.appointmentReminder.updateMany({
            where: { id: reminderId, claimToken: token },
            data: { status: "FAILED", lastError: message, claimToken: null, claimedAt: null },
        });
        await audit({
            tenantId: reminder.tenantId, userId: null, action: "APPOINTMENT_REMINDER_FAILED", entity: "AppointmentReminder", entityId: reminderId,
            newValue: { offsetMinutes: reminder.offsetMinutes, code, retryable: sms?.retryable ?? true },
        });
        throw new ReminderDeliveryError(message, sms?.retryable ?? true, code);
    };

    try {
        // The state may have changed while we were claiming: look again immediately before sending.
        appointment = await load();
        const again = appointment && !appointment.deletedAt ? stale(appointment) : { result: "skipped", reason: "NOT_FOUND" } as DispatchOutcome;
        if (again) {
            await cancel("The appointment changed before the reminder was sent.", again);
            return again;
        }

        const patient = appointment.patient;
        const phone = toE164(patient.phone);
        if (!phone) throw new SmsError("INVALID_RECIPIENT", "The patient's phone number is not valid.", false);

        const tenant = appointment.tenant;
        const zone = clinicTimeZone(tenant.timezone);
        const { time } = formatInZone(new Date(appointment.dateTime), zone);
        const text = reminderMessage({
            firstName: patient.firstName,
            clinicName: tenant.settings?.platformName || tenant.name,
            doctorLastName: appointment.doctor.lastName,
            time,
            minutesUntil: (new Date(appointment.dateTime).getTime() - now.getTime()) / 60_000,
        });

        const result = await send(phone, text);

        // The provider ACCEPTED it. Record that immediately: from here a retry must never send again.
        const recorded = await db.appointmentReminder.updateMany({
            where: { id: reminderId, claimToken: token },
            data: { status: "SENT", provider: result.provider, providerMessageId: result.providerMessageId, sentAt: now, lastError: null, claimToken: null, claimedAt: null },
        });
        if (recorded.count !== 1) {
            // Cancelled while the SMS was in flight. It has gone out; say so rather than hide it.
            console.error(`[Reminder] ${reminderId}: SMS accepted but the reminder was cancelled meanwhile`);
        }

        // Evidence trail. A failure here must not turn an accepted SMS into a retry (which would send twice).
        try {
            await db.notification.create({
                data: {
                    tenantId: reminder.tenantId, recipientId: patient.id, channel: "SMS", type: "APPOINTMENT_REMINDER",
                    title: `Appointment reminder (${reminder.offsetMinutes} minutes before)`,
                    content: `SMS appointment reminder, ${reminder.offsetMinutes} minutes before the appointment.`,
                    metadata: { appointmentId: appointment.id, reminderId, offsetMinutes: reminder.offsetMinutes, provider: result.provider, providerMessageId: result.providerMessageId },
                    status: "SENT", sentAt: now,
                },
            });
            await audit({
                tenantId: reminder.tenantId, userId: null, action: "APPOINTMENT_REMINDER_SENT", entity: "AppointmentReminder", entityId: reminderId,
                newValue: { appointmentId: appointment.id, offsetMinutes: reminder.offsetMinutes, provider: result.provider, providerMessageId: result.providerMessageId, status: "SENT" },
            });
        } catch (error) {
            console.error(`[Reminder] ${reminderId}: sent, but the evidence record failed:`, error instanceof Error ? error.message : "unknown");
        }
        return { result: "sent", providerMessageId: result.providerMessageId };
    } catch (error) {
        if (error instanceof ReminderDeliveryError) throw error;
        return fail(error);
    }
}
