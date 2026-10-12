/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma-shaped stand-ins */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { memTable } from "./helpers/memdb";
import { planReminders, reminderCreateData, enqueueAndSummarise, cancelPendingReminders, scheduleAppointmentReminders, enqueueReminderJob } from "@/lib/reminders/schedule";
import { dispatchReminder, ReminderDeliveryError, MIN_MINUTES_BEFORE_APPOINTMENT } from "@/lib/reminders/dispatch";
import { reconcileReminders } from "@/lib/reminders/reconcile";
import { REMINDER_CLAIM_LEASE_MS, reminderJobId } from "@/lib/reminders/constants";
import { reminderMessage } from "@/lib/reminders/copy";
import { SmsError } from "@/lib/sms";
import { zonedWallTimeToUtc } from "@/lib/utils/timezone";

const NOW = new Date("2026-10-12T12:00:00Z");
const minutes = (m: number, from = NOW) => new Date(from.getTime() + m * 60_000);

describe("which reminders a booking creates (60 and 30 minutes before, nothing in the past)", () => {
    const plan = (minutesAway: number) => planReminders(minutes(minutesAway), NOW).filter((p) => !p.skippedPast).map((p) => p.offsetMinutes);

    it("more than 60 minutes away: both", () => expect(plan(61)).toEqual([60, 30]));
    it("a day away: both (and no 24-hour reminder exists)", () => expect(plan(24 * 60)).toEqual([60, 30]));
    it("between 30 and 60 minutes away: only the 30-minute reminder", () => {
        expect(plan(45)).toEqual([30]);
        expect(plan(59)).toEqual([30]);
        expect(plan(31)).toEqual([30]);
    });
    it("at or below 30 minutes: neither", () => {
        expect(plan(30)).toEqual([]);
        expect(plan(10)).toEqual([]);
        expect(plan(0)).toEqual([]);
        expect(plan(-5)).toEqual([]);
    });
    it("exactly 60 minutes away: the 60-minute reminder would be due 'now' = past, so only 30", () => expect(plan(60)).toEqual([30]));

    it("schedules at exact UTC instants for a Ghana wall-clock time, independent of the host zone", () => {
        const at = zonedWallTimeToUtc("2026-10-12", "14:30", "Africa/Accra")!;
        const p = planReminders(at, new Date("2026-10-12T08:00:00Z"));
        expect(p.map((x) => x.scheduledFor.toISOString())).toEqual(["2026-10-12T13:30:00.000Z", "2026-10-12T14:00:00.000Z"]);
        // and for a zone that is NOT UTC the stored instants differ accordingly
        const lagos = zonedWallTimeToUtc("2026-10-12", "14:30", "Africa/Lagos")!; // UTC+1
        expect(planReminders(lagos, new Date("2026-10-12T08:00:00Z")).map((x) => x.scheduledFor.toISOString())).toEqual(["2026-10-12T12:30:00.000Z", "2026-10-12T13:00:00.000Z"]);
    });

    it("reminderCreateData only returns rows that should exist", () => {
        expect(reminderCreateData("t", minutes(45), NOW).map((r) => r.offsetMinutes)).toEqual([30]);
        expect(reminderCreateData("t", minutes(500), NOW)).toHaveLength(2);
        expect(reminderCreateData("t", minutes(10), NOW)).toEqual([]);
    });
});

describe("the message", () => {
    const base = { firstName: "Ama Serwaa", clinicName: "Dentoc Dental", doctorLastName: "Mensah", time: "14:30" };
    it("says the real time remaining, never promises reply-to-cancel, and omits the surname", () => {
        const sixty = reminderMessage({ ...base, minutesUntil: 60 });
        expect(sixty).toContain("in about an hour");
        expect(reminderMessage({ ...base, minutesUntil: 30 })).toContain("in about 30 minutes");
        expect(reminderMessage({ ...base, minutesUntil: 17 })).toContain("in about 17 minutes"); // a late job does not say "an hour"
        expect(sixty).toContain("Hi Ama,");
        expect(sixty).not.toMatch(/reply|cancel/i);
        expect(sixty.length).toBeLessThan(200);
    });
});

// ─────────────────────────── dispatch ───────────────────────────
function world(over: { appointment?: Record<string, unknown>; patient?: Record<string, unknown>; reminder?: Record<string, unknown> } = {}) {
    const appointmentAt = minutes(60);
    const reminders = memTable([
        { id: "r1", tenantId: "t1", appointmentId: "a1", offsetMinutes: 60, appointmentAt, scheduledFor: NOW, generation: 0, status: "PENDING", attempts: 0, claimToken: null, claimedAt: null, lastError: null, provider: null, providerMessageId: null, sentAt: null, ...over.reminder },
    ], { key: "id" });
    const appointments = memTable([
        { id: "a1", tenantId: "t1", status: "SCHEDULED", dateTime: appointmentAt, deletedAt: null,
          patient: { id: "p1", firstName: "Ama", phone: "+233244123456", ...over.patient }, doctor: { lastName: "Mensah" }, tenant: { name: "Dentoc Dental", timezone: "Africa/Accra", settings: { platformName: null } }, ...over.appointment },
    ], { key: "id" });
    const notifications = memTable();
    const db: any = { appointmentReminder: reminders, appointment: appointments, notification: notifications };
    const sms = vi.fn(async (to: string, message: string) => { void to; void message; return { provider: "mnotify" as const, providerMessageId: "camp-1", accepted: 1, rejected: 0, responseStatus: "success", status: "SENT" as const }; });
    const audit = vi.fn(async (entry: unknown) => { void entry; });
    const deps = { db, sms, audit, now: () => NOW, remindersEnabled: async () => ({ enabled: true }) } as any;
    return { db, reminders, appointments, notifications, sms, audit, deps, row: () => reminders.rows[0] };
}

beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); vi.spyOn(console, "log").mockImplementation(() => {}); });

describe("dispatch: one reminder, one SMS, one recorded result", () => {
    it("sends one SMS, records SENT + the provider campaign id (never DELIVERED), a Notification and an audit entry", async () => {
        const w = world();
        expect(await dispatchReminder("r1", w.deps)).toEqual({ result: "sent", providerMessageId: "camp-1" });
        expect(w.sms).toHaveBeenCalledTimes(1);
        expect(w.sms.mock.calls[0][0]).toBe("+233244123456");
        expect(w.sms.mock.calls[0][1]).toContain("13:00"); // appointment = 13:00Z; Africa/Accra is UTC+0
        expect(w.row()).toMatchObject({ status: "SENT", provider: "mnotify", providerMessageId: "camp-1", claimToken: null, lastError: null });
        expect(w.row().sentAt).toEqual(NOW);
        expect(JSON.stringify(w.row())).not.toContain("DELIVERED");
        expect(w.notifications.rows).toHaveLength(1);
        expect(w.notifications.rows[0]).toMatchObject({ channel: "SMS", type: "APPOINTMENT_REMINDER", status: "SENT", recipientId: "p1" });
        expect(w.notifications.rows[0].metadata).toMatchObject({ appointmentId: "a1", reminderId: "r1", offsetMinutes: 60, provider: "mnotify", providerMessageId: "camp-1" });
        expect(JSON.stringify(w.notifications.rows[0])).not.toMatch(/Ama|244123456|key=/);
        expect(w.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "APPOINTMENT_REMINDER_SENT", entityId: "r1" }));
        expect(JSON.stringify(w.audit.mock.calls)).not.toContain("244123456");
    });

    it("uses the clinic's name (settings override first) and its time zone for the printed time", async () => {
        const w = world({ appointment: { tenant: { name: "Legal Name Ltd", timezone: "Europe/London", settings: { platformName: "Smile Studio" } }, dateTime: new Date("2026-10-12T13:00:00Z") }, reminder: { appointmentAt: new Date("2026-10-12T13:00:00Z") } });
        await dispatchReminder("r1", w.deps);
        const text = w.sms.mock.calls[0][1];
        expect(text).toContain("Smile Studio");
        expect(text).toContain("14:00"); // 13:00Z is 14:00 BST in London
    });

    it("CONCURRENCY: ten simultaneous jobs for the same reminder send exactly one SMS", async () => {
        const w = world();
        w.sms.mockImplementation(async () => { await new Promise((r) => setTimeout(r, 15)); return { provider: "mnotify", providerMessageId: "camp-1", accepted: 1, rejected: 0, responseStatus: "success", status: "SENT" } as any; });
        const results = await Promise.all(Array.from({ length: 10 }, () => dispatchReminder("r1", w.deps)));
        expect(w.sms).toHaveBeenCalledTimes(1);
        expect(results.filter((r) => r.result === "sent")).toHaveLength(1);
        expect(results.filter((r) => r.result === "skipped").every((r: any) => ["NOT_CLAIMED", "ALREADY_SENT"].includes(r.reason))).toBe(true);
        expect(w.notifications.rows).toHaveLength(1);
        expect(w.row().attempts).toBe(1);
    });

    it("a re-delivered job for an already SENT reminder sends nothing", async () => {
        const w = world();
        await dispatchReminder("r1", w.deps);
        expect(await dispatchReminder("r1", w.deps)).toEqual({ result: "skipped", reason: "ALREADY_SENT" });
        expect(w.sms).toHaveBeenCalledTimes(1);
    });

    it("two different offsets for one appointment are two independent reminders, each sent once", async () => {
        const w = world();
        w.reminders.rows.push({ ...w.row(), id: "r2", offsetMinutes: 30, scheduledFor: minutes(30), status: "PENDING", claimToken: null });
        await Promise.all([dispatchReminder("r1", w.deps), dispatchReminder("r2", w.deps), dispatchReminder("r1", w.deps), dispatchReminder("r2", w.deps)]);
        expect(w.sms).toHaveBeenCalledTimes(2);
        expect(w.reminders.rows.map((r: any) => r.status)).toEqual(["SENT", "SENT"]);
    });

    it("never touches WhatsApp or a second notification path (SMS function is the only sender)", async () => {
        const w = world();
        await dispatchReminder("r1", w.deps);
        expect(w.sms).toHaveBeenCalledTimes(1);
        expect(w.notifications.create).toHaveBeenCalledTimes(1); // the evidence record, not a second send
        expect(w.notifications.rows[0].channel).toBe("SMS");
    });
});

describe("dispatch: failures are recorded, retryable ones recover", () => {
    it("a transient provider failure records FAILED (redacted), throws a RETRYABLE error, and a retry then sends exactly once", async () => {
        const w = world();
        w.sms.mockRejectedValueOnce(new SmsError("HTTP_ERROR", "mNotify answered HTTP 503 for ama@mail.test", true, 503));
        await expect(dispatchReminder("r1", w.deps)).rejects.toMatchObject({ name: "ReminderDeliveryError", retryable: true, code: "HTTP_ERROR" });
        expect(w.row()).toMatchObject({ status: "FAILED", claimToken: null, providerMessageId: null });
        expect(w.row().lastError).toContain("HTTP_ERROR");
        expect(w.row().lastError).not.toContain("ama@mail.test");
        expect(w.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "APPOINTMENT_REMINDER_FAILED" }));
        expect(w.notifications.rows).toHaveLength(0); // no "sent" evidence for a failure

        expect((await dispatchReminder("r1", w.deps)).result).toBe("sent");
        expect(w.sms).toHaveBeenCalledTimes(2);
        expect(w.row()).toMatchObject({ status: "SENT", lastError: null, attempts: 2 });
        // and a third delivery of the same job must not send again
        await dispatchReminder("r1", w.deps);
        expect(w.sms).toHaveBeenCalledTimes(2);
    });

    it.each([
        ["DEMO_BLOCKED", false],
        ["NOT_CONFIGURED", false],
        ["INVALID_RECIPIENT", false],
        ["TIMEOUT", true],
        ["NETWORK", true],
    ])("%s is recorded with retryable=%s", async (code, retryable) => {
        const w = world();
        w.sms.mockRejectedValue(new SmsError(code as any, "x", retryable as boolean));
        const e = await dispatchReminder("r1", w.deps).catch((x) => x);
        expect(e).toBeInstanceOf(ReminderDeliveryError);
        expect(e.retryable).toBe(retryable);
        expect(w.row().status).toBe("FAILED");
    });

    it("an invalid stored phone number fails without calling the provider", async () => {
        const w = world({ patient: { phone: "not a number" } });
        await expect(dispatchReminder("r1", w.deps)).rejects.toMatchObject({ retryable: false, code: "INVALID_RECIPIENT" });
        expect(w.sms).not.toHaveBeenCalled();
    });

    it("an unexpected error is recorded as FAILED and retryable, with no raw error text stored", async () => {
        const w = world();
        w.sms.mockRejectedValue(new Error("secret key=abc123 leaked"));
        const e = await dispatchReminder("r1", w.deps).catch((x) => x);
        expect(e.retryable).toBe(true);
        expect(w.row().lastError).not.toContain("abc123");
    });

    it("if the evidence write fails AFTER the provider accepted, the reminder stays SENT and is not retried", async () => {
        const w = world();
        w.notifications.create.mockRejectedValueOnce(new Error("db blip"));
        expect((await dispatchReminder("r1", w.deps)).result).toBe("sent");
        expect(w.row().status).toBe("SENT");
        await dispatchReminder("r1", w.deps);
        expect(w.sms).toHaveBeenCalledTimes(1);
    });
});

describe("dispatch: state checks (a stale queue job can never send)", () => {
    it.each(["CANCELLED", "CHECKED_IN", "IN_IMAGING", "IN_CHAIR", "COMPLETED", "CHECKOUT", "NO_SHOW"])("appointment %s => no SMS and the reminder is CANCELLED", async (status) => {
        const w = world({ appointment: { status } });
        expect(await dispatchReminder("r1", w.deps)).toEqual({ result: "skipped", reason: "NOT_SCHEDULED" });
        expect(w.sms).not.toHaveBeenCalled();
        expect(w.row().status).toBe("CANCELLED");
    });

    it("a deleted or missing appointment sends nothing", async () => {
        const w = world({ appointment: { deletedAt: new Date() } });
        expect((await dispatchReminder("r1", w.deps)).result).toBe("skipped");
        expect(w.sms).not.toHaveBeenCalled();
        const w2 = world();
        w2.appointments.rows.length = 0;
        expect(await dispatchReminder("r1", w2.deps)).toMatchObject({ result: "skipped", reason: "NOT_FOUND" });
        expect(await dispatchReminder("nope", w2.deps)).toMatchObject({ result: "skipped", reason: "NOT_FOUND" });
    });

    it("an already CANCELLED reminder is never sent", async () => {
        const w = world({ reminder: { status: "CANCELLED" } });
        expect(await dispatchReminder("r1", w.deps)).toEqual({ result: "skipped", reason: "CANCELLED" });
        expect(w.sms).not.toHaveBeenCalled();
    });

    it("an appointment moved to a different time is not reminded for its OLD time", async () => {
        const w = world({ appointment: { dateTime: minutes(180) } });
        expect(await dispatchReminder("r1", w.deps)).toEqual({ result: "skipped", reason: "APPOINTMENT_CHANGED" });
        expect(w.sms).not.toHaveBeenCalled();
    });

    it("a clinic that switched reminders off (or has no provider) sends nothing", async () => {
        const w = world();
        const r = await dispatchReminder("r1", { ...w.deps, remindersEnabled: async () => ({ enabled: false, reason: "DISABLED_BY_CLINIC" }) });
        expect(r).toEqual({ result: "skipped", reason: "DISABLED" });
        expect(w.sms).not.toHaveBeenCalled();
        expect(w.row().status).toBe("CANCELLED");
    });

    it("a reminder that fires too close to the appointment is dropped, not sent", async () => {
        const w = world({ appointment: { dateTime: minutes(MIN_MINUTES_BEFORE_APPOINTMENT - 1) }, reminder: { appointmentAt: minutes(MIN_MINUTES_BEFORE_APPOINTMENT - 1) } });
        expect(await dispatchReminder("r1", w.deps)).toEqual({ result: "skipped", reason: "TOO_LATE" });
        expect(w.sms).not.toHaveBeenCalled();
    });

    it("the appointment is checked in WHILE the claim is being taken: the SMS is not sent", async () => {
        const w = world();
        // flip the appointment to CHECKED_IN as soon as the reminder is claimed
        const realUpdateMany = w.reminders.updateMany.getMockImplementation()!;
        w.reminders.updateMany.mockImplementation(async (a: any) => {
            const r = await realUpdateMany(a);
            if (a.data?.status === "PROCESSING") w.appointments.rows[0].status = "CHECKED_IN";
            return r;
        });
        expect((await dispatchReminder("r1", w.deps)).result).toBe("skipped");
        expect(w.sms).not.toHaveBeenCalled();
        expect(w.row().status).toBe("CANCELLED");
    });
});

describe("claim lease", () => {
    it("a live claim blocks everyone else; a crashed claimant's claim is taken over only after the lease", async () => {
        const w = world({ reminder: { status: "PROCESSING", claimToken: "dead", claimedAt: NOW } });
        expect(await dispatchReminder("r1", w.deps)).toEqual({ result: "skipped", reason: "NOT_CLAIMED" });
        expect(w.sms).not.toHaveBeenCalled();
        const later = { ...w.deps, now: () => new Date(NOW.getTime() + REMINDER_CLAIM_LEASE_MS + 1000) };
        w.appointments.rows[0].dateTime = minutes(120, NOW);
        w.reminders.rows[0].appointmentAt = minutes(120, NOW);
        expect((await dispatchReminder("r1", later)).result).toBe("sent");
        expect(w.sms).toHaveBeenCalledTimes(1);
    });
});

// ─────────────────────── cancellation, summary, reconcile ───────────────────────
describe("cancelling pending reminders", () => {
    it("cancels PENDING, PROCESSING and FAILED rows of the appointment and leaves SENT ones alone", async () => {
        const reminders = memTable([
            { id: "a", appointmentId: "a1", status: "PENDING" }, { id: "b", appointmentId: "a1", status: "FAILED" },
            { id: "c", appointmentId: "a1", status: "SENT" }, { id: "d", appointmentId: "other", status: "PENDING" },
        ], { key: "id" });
        expect(await cancelPendingReminders({ appointmentReminder: reminders } as any, "a1", "Appointment is now CANCELLED.")).toBe(2);
        expect(reminders.rows.map((r: any) => `${r.id}:${r.status}`)).toEqual(["a:CANCELLED", "b:CANCELLED", "c:SENT", "d:PENDING"]);
    });
});

describe("a truthful summary (never pretends)", () => {
    const rows = [{ id: "r60", tenantId: "t1", appointmentId: "a1", offsetMinutes: 60, scheduledFor: minutes(60), generation: 0 }, { id: "r30", tenantId: "t1", appointmentId: "a1", offsetMinutes: 30, scheduledFor: minutes(90), generation: 0 }];
    const at = minutes(120);

    it("complete when every needed reminder is recorded AND queued, with a stable job id and the right delay", async () => {
        const add = vi.fn(async () => {});
        const s = await enqueueAndSummarise({ rows, appointmentAt: at, queue: { add }, timeZone: "Africa/Accra", now: NOW });
        expect(s).toMatchObject({ enabled: true, complete: true, timeZone: "Africa/Accra" });
        expect(s.items.map((i) => [i.offsetMinutes, i.status])).toEqual([[60, "PENDING"], [30, "PENDING"]]);
        expect(add).toHaveBeenCalledTimes(2);
        expect(add.mock.calls[0]).toEqual(["sms-reminder", { type: "REMINDER", reminderId: "r60", appointmentId: "a1", tenantId: "t1" }, { jobId: reminderJobId("r60", 0), delay: 60 * 60_000 }]);
        expect(reminderJobId("r60", 0)).not.toContain(":");
    });

    it("Redis failure: the booking is NOT reported as fully scheduled", async () => {
        const errors: unknown[] = [];
        const s = await enqueueAndSummarise({ rows, appointmentAt: at, queue: { add: vi.fn(async () => { throw new Error("ECONNREFUSED"); }) }, timeZone: "Africa/Accra", now: NOW, onQueueError: (e) => errors.push(e) });
        expect(s.complete).toBe(false);
        expect(s.items.map((i) => i.status)).toEqual(["NOT_QUEUED", "NOT_QUEUED"]);
        expect(errors).toHaveLength(2);
    });

    it("a missing durable row is reported FAILED, and past reminders are reported as skipped, not as scheduled", async () => {
        const s = await enqueueAndSummarise({ rows: [rows[1]], appointmentAt: at, queue: { add: vi.fn(async () => {}) }, timeZone: "Africa/Accra", now: NOW });
        expect(s.items.map((i) => i.status)).toEqual(["FAILED", "PENDING"]);
        expect(s.complete).toBe(false);
        const soon = await enqueueAndSummarise({ rows: [], appointmentAt: minutes(20), queue: { add: vi.fn() }, timeZone: "Africa/Accra", now: NOW });
        expect(soon.items.map((i) => i.status)).toEqual(["SKIPPED_PAST", "SKIPPED_PAST"]);
        expect(soon.complete).toBe(true);
    });

    it("enqueueReminderJob never gives a negative delay", async () => {
        const add = vi.fn(async () => {});
        await enqueueReminderJob({ add }, { ...rows[0], scheduledFor: minutes(-10) }, NOW);
        expect((add.mock.calls[0] as any)[2].delay).toBe(0);
    });
});

describe("reconciliation: the database is the source of truth", () => {
    const seed = () => memTable([
        { id: "due", status: "PENDING", scheduledFor: minutes(30), appointmentAt: minutes(90), generation: 2, tenantId: "t", appointmentId: "a" },
        { id: "later", status: "PENDING", scheduledFor: minutes(60 * 5), appointmentAt: minutes(60 * 6), generation: 0, tenantId: "t", appointmentId: "a" },
        { id: "sent", status: "SENT", scheduledFor: minutes(10), appointmentAt: minutes(60), generation: 0, tenantId: "t", appointmentId: "a" },
        { id: "cancelled", status: "CANCELLED", scheduledFor: minutes(10), appointmentAt: minutes(60), generation: 0, tenantId: "t", appointmentId: "a" },
        { id: "failed", status: "FAILED", scheduledFor: minutes(10), appointmentAt: minutes(60), generation: 0, tenantId: "t", appointmentId: "a" },
        { id: "past", status: "PENDING", scheduledFor: minutes(-30), appointmentAt: minutes(-5), generation: 0, tenantId: "t", appointmentId: "a" },
    ], { key: "id" });

    it("queues only PENDING reminders that are due soon for an appointment still ahead, using the stable job id", async () => {
        const add = vi.fn(async () => {});
        const r = await reconcileReminders({ db: { appointmentReminder: seed() }, queue: { add }, now: NOW });
        expect(r).toEqual({ checked: 1, enqueued: 1, failed: 0 });
        expect((add.mock.calls[0] as any)[2].jobId).toBe(reminderJobId("due", 2));
    });

    it("repairs a Redis outage later: the same call succeeds when the queue is back, and failures are counted", async () => {
        const table = seed();
        const down = await reconcileReminders({ db: { appointmentReminder: table }, queue: { add: vi.fn(async () => { throw new Error("down"); }) }, now: NOW });
        expect(down).toEqual({ checked: 1, enqueued: 0, failed: 1 });
        const up = await reconcileReminders({ db: { appointmentReminder: table }, queue: { add: vi.fn(async () => {}) }, now: NOW });
        expect(up.enqueued).toBe(1);
    });
});

describe("recreating reminders when an appointment is reopened", () => {
    it("revives CANCELLED rows (new generation = new job id), creates missing ones, never touches SENT", async () => {
        const at = minutes(180);
        const reminders = memTable([
            { id: "r60", appointmentId: "a1", offsetMinutes: 60, appointmentAt: at, scheduledFor: minutes(120), status: "CANCELLED", generation: 0, tenantId: "t" },
            { id: "r30", appointmentId: "a1", offsetMinutes: 30, appointmentAt: at, scheduledFor: minutes(150), status: "SENT", generation: 0, tenantId: "t" },
        ], { key: "id" });
        reminders.upsert.mockImplementation(async ({ create }: any) => {
            const existing = reminders.rows.find((r: any) => r.appointmentId === create.appointmentId && r.offsetMinutes === create.offsetMinutes && r.appointmentAt.getTime() === create.appointmentAt.getTime());
            return existing ?? (await reminders.create({ data: { id: `new-${create.offsetMinutes}`, status: "PENDING", generation: 0, ...create } }));
        });
        const pending = await scheduleAppointmentReminders({ appointmentReminder: reminders } as any, { id: "a1", tenantId: "t", dateTime: at }, NOW);
        expect(pending.map((r: any) => `${r.id}:g${r.generation}`)).toEqual(["r60:g1"]);
        expect(reminders.rows.find((r: any) => r.id === "r30")).toMatchObject({ status: "SENT", generation: 0 }); // not re-sent
    });
});
