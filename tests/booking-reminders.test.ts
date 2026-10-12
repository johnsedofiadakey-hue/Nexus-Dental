/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma-shaped stand-ins */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
    const fn = () => vi.fn();
    const db: any = {
        tenant: { findUnique: fn() },
        tenantSettings: { findUnique: fn() },
        user: { findFirst: fn() },
        patient: { findFirst: fn(), findMany: fn(), create: fn() },
        service: { findMany: fn() },
        appointment: { create: fn() },
        appointmentReminder: { findMany: fn(), updateMany: fn(), upsert: fn() },
        auditLog: { create: fn() },
    };
    db.$transaction = vi.fn(async (cb: any) => cb(db));
    return {
        db,
        queueAdd: vi.fn(async (...args: unknown[]) => { void args; return {}; }),
        queueRemove: vi.fn(async () => {}),
        acquire: vi.fn(async () => "lock-1"),
        confirm: vi.fn(async () => {}),
        release: vi.fn(async () => {}),
        sendSms: vi.fn(async (...args: unknown[]) => { void args; return {}; }),
        audit: vi.fn(async (entry: unknown) => { void entry; }),
    };
});

vi.mock("@/lib/db/prisma", () => ({ default: m.db, prisma: m.db }));
vi.mock("@/lib/audit/logger", () => ({ logAudit: m.audit, getClientIP: () => "127.0.0.1", getUserAgent: () => "vitest" }));
vi.mock("@/lib/queue/queues", () => ({ appointmentQueue: { add: m.queueAdd, remove: m.queueRemove } }));
vi.mock("@/lib/booking", () => ({ acquireSlotLock: m.acquire, confirmSlotLock: m.confirm, releaseSlotLock: m.release }));
vi.mock("@/lib/sms", async (orig) => ({ ...(await orig<typeof import("@/lib/sms")>()), sendSms: m.sendSms }));

import { staffToken, patientToken, makeRequest, params } from "./helpers/auth";
import { POST as book } from "@/app/api/appointments/book/route";
import { PATCH as patchStatus } from "@/app/api/appointments/[id]/status/route";
import { GET as history } from "@/app/api/appointments/[id]/reminders/route";

const A = "tenant-a";
const NOW = new Date("2026-10-12T12:00:00Z");
const SMS_ENV = { SMS_PROVIDER: "mnotify", MNOTIFY_API_KEY: "k".repeat(20), MNOTIFY_SENDER_ID: "Dentoc" };
const saved = { ...process.env };

beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    Object.assign(process.env, SMS_ENV);
    delete process.env.ENABLED_FEATURES;
    delete process.env.DEMO_MODE;
    m.db.tenant.findUnique.mockResolvedValue({ name: "Dentoc Dental", timezone: "Africa/Accra" });
    m.db.tenantSettings.findUnique.mockResolvedValue(null); // no settings => reminders default ON
    m.db.user.findFirst.mockResolvedValue({ id: "doc-1" });
    m.db.service.findMany.mockResolvedValue([{ id: "svc-1", isActive: true, duration: 30 }]);
    m.db.patient.findMany.mockResolvedValue([]);
    m.db.patient.findFirst.mockResolvedValue({ id: "pat-1" });
    m.db.patient.create.mockImplementation(async ({ data }: any) => ({ id: "pat-new", ...data }));
    m.db.appointment.create.mockImplementation(async ({ data }: any) => ({
        id: "appt-1", dateTime: data.dateTime, endTime: data.endTime, tenantId: A,
        patient: { id: data.patientId }, doctor: {}, service: {}, additionalServices: [],
        reminders: (data.reminders?.create ?? []).map((r: any, i: number) => ({ id: `rem-${r.offsetMinutes}`, generation: 0, appointmentId: "appt-1", ...r, i })),
    }));
    m.queueAdd.mockResolvedValue({});
    m.acquire.mockResolvedValue("lock-1");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); process.env = { ...saved }; });

const guest = (over: Record<string, unknown> = {}, token?: string) =>
    book(makeRequest("/api/appointments/book", { method: "POST", token, body: { serviceIds: ["svc-1"], doctorId: "doc-1", date: "2026-10-12", time: "14:30", firstName: "Ama", lastName: "Mensah", phone: "0244123456", ...over } }));
const json = async (res: Response) => (await res.json()).data;

describe("booking creates 60/30-minute reminders, truthfully", () => {
    it("more than 60 minutes ahead: both reminders, written with the appointment and queued with stable ids and exact delays", async () => {
        const res = await guest();
        expect(res.status).toBe(201);
        const data = await json(res);
        expect(data.remindersScheduled).toMatchObject({ enabled: true, complete: true, timeZone: "Africa/Accra" });
        expect(data.remindersScheduled.items).toEqual([
            { offsetMinutes: 60, scheduledFor: "2026-10-12T13:30:00.000Z", status: "PENDING" },
            { offsetMinutes: 30, scheduledFor: "2026-10-12T14:00:00.000Z", status: "PENDING" },
        ]);
        const created = m.db.appointment.create.mock.calls[0][0].data;
        expect(created.dateTime.toISOString()).toBe("2026-10-12T14:30:00.000Z"); // 14:30 in Africa/Accra, explicit
        expect(created.reminders.create.map((r: any) => r.offsetMinutes)).toEqual([60, 30]); // durable rows in the SAME create
        expect(m.queueAdd).toHaveBeenCalledTimes(2);
        expect((m.queueAdd.mock.calls[0] as any)[2]).toEqual({ jobId: "reminder-rem-60-g0", delay: 90 * 60_000 });
        expect((m.queueAdd.mock.calls[1] as any)[2]).toEqual({ jobId: "reminder-rem-30-g0", delay: 120 * 60_000 });
        expect(m.queueAdd.mock.calls.some((c: any) => /24H|1H/.test(JSON.stringify(c)))).toBe(false); // the old 24h/1h jobs are gone
    });

    it("30-60 minutes ahead: only the 30-minute reminder; the 60-minute one is reported as skipped, not scheduled", async () => {
        const data = await json(await guest({ time: "12:45" }));
        expect(data.remindersScheduled.items.map((i: any) => [i.offsetMinutes, i.status])).toEqual([[60, "SKIPPED_PAST"], [30, "PENDING"]]);
        expect(data.remindersScheduled.complete).toBe(true);
        expect(m.db.appointment.create.mock.calls[0][0].data.reminders.create).toHaveLength(1);
        expect(m.queueAdd).toHaveBeenCalledTimes(1);
    });

    it("30 minutes or less ahead: no reminder rows, no jobs, and the summary says so", async () => {
        const data = await json(await guest({ time: "12:20" }));
        expect(data.remindersScheduled.items.map((i: any) => i.status)).toEqual(["SKIPPED_PAST", "SKIPPED_PAST"]);
        expect(m.db.appointment.create.mock.calls[0][0].data.reminders.create).toEqual([]);
        expect(m.queueAdd).not.toHaveBeenCalled();
    });

    it("Redis is down: the booking succeeds but is NOT reported as fully scheduled, and the shortfall is audited", async () => {
        m.queueAdd.mockRejectedValue(new Error("ECONNREFUSED"));
        const res = await guest();
        expect(res.status).toBe(201);
        const data = await json(res);
        expect(data.remindersScheduled.complete).toBe(false);
        expect(data.remindersScheduled.items.map((i: any) => i.status)).toEqual(["NOT_QUEUED", "NOT_QUEUED"]);
        expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "APPOINTMENT_REMINDERS_INCOMPLETE" }));
        // durable rows were still written, so the worker's reconciler can queue them later
        expect(m.db.appointment.create.mock.calls[0][0].data.reminders.create).toHaveLength(2);
    });

    it("the durable write fails: the booking fails (500), the slot lock is released and nothing is queued or claimed as scheduled", async () => {
        m.db.appointment.create.mockRejectedValue(new Error("db down"));
        const res = await guest();
        expect(res.status).toBe(500);
        expect(m.release).toHaveBeenCalled();
        expect(m.queueAdd).not.toHaveBeenCalled();
    });

    it("clinic has switched reminders off: no rows, no jobs, and the response says reminders are disabled", async () => {
        m.db.tenantSettings.findUnique.mockResolvedValue({ featureFlags: { enableSmsReminders: false } });
        const data = await json(await guest());
        expect(data.remindersScheduled).toMatchObject({ enabled: false, reason: "DISABLED_BY_CLINIC", items: [] });
        expect(m.db.appointment.create.mock.calls[0][0].data.reminders).toBeUndefined();
        expect(m.queueAdd).not.toHaveBeenCalled();
    });

    it("no SMS provider configured: reminders are reported unavailable, not silently 'scheduled'", async () => {
        delete process.env.SMS_PROVIDER;
        const data = await json(await guest());
        expect(data.remindersScheduled).toMatchObject({ enabled: false, reason: "PROVIDER_UNAVAILABLE", items: [] });
        expect(m.queueAdd).not.toHaveBeenCalled();
    });

    it("demo mode with an empty allowlist: reminders are unavailable", async () => {
        process.env.DEMO_MODE = "true";
        delete process.env.DEMO_SMS_ALLOWLIST;
        expect((await json(await guest())).remindersScheduled.enabled).toBe(false);
    });

    it("never leaks the reminder rows' internals into the appointment object", async () => {
        const data = await json(await guest());
        expect(data.appointment.reminders).toBeUndefined();
    });
});

describe("time zone is explicit", () => {
    it("14:30 means 14:30 in the CLINIC's zone, whatever the server's zone", async () => {
        m.db.tenant.findUnique.mockResolvedValue({ name: "Lagos Dental", timezone: "Africa/Lagos" }); // UTC+1
        await guest();
        expect(m.db.appointment.create.mock.calls[0][0].data.dateTime.toISOString()).toBe("2026-10-12T13:30:00.000Z");
    });
    it("rejects a malformed or impossible date/time", async () => {
        for (const [date, time] of [["2026-02-31", "10:00"], ["12/10/2026", "10:00"], ["2026-10-12", "25:00"], ["2026-10-12", "ten"]]) {
            expect((await guest({ date, time })).status).toBe(400);
        }
        expect(m.db.appointment.create).not.toHaveBeenCalled();
    });
});

describe("phone numbers: one patient however it is typed", () => {
    it("looks the patient up under every historical spelling and reuses the match - never a duplicate", async () => {
        m.db.patient.findMany.mockResolvedValue([{ id: "pat-existing" }]);
        const data = await json(await guest({ phone: "0244123456" }));
        const where = m.db.patient.findMany.mock.calls[0][0].where;
        expect(where.phone.in).toEqual(expect.arrayContaining(["+233244123456", "0244123456", "233244123456", "244123456"]));
        expect(m.db.patient.create).not.toHaveBeenCalled();
        expect(data.isNewPatient).toBe(false);
        expect(m.db.appointment.create.mock.calls[0][0].data.patientId).toBe("pat-existing");
    });

    it("024… and +23324… resolve to the same lookup set", async () => {
        await guest({ phone: "0244123456" });
        await guest({ phone: "+233 24 412 3456" });
        const [a, b] = m.db.patient.findMany.mock.calls.map((c: any) => [...c[0].where.phone.in].sort());
        expect(a).toEqual(b);
    });

    it("a new patient is created with the canonical E.164 number", async () => {
        await guest({ phone: "024 412 3456" });
        expect(m.db.patient.create.mock.calls[0][0].data.phone).toBe("+233244123456");
    });

    it("a valid international number is not rewritten as Ghanaian", async () => {
        await guest({ phone: "+44 7911 123456" });
        expect(m.db.patient.create.mock.calls[0][0].data.phone).toBe("+447911123456");
    });

    it("more than one matching record is AMBIGUOUS: 409, audited, nothing created or merged", async () => {
        m.db.patient.findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
        const res = await guest();
        expect(res.status).toBe(409);
        expect(m.db.patient.create).not.toHaveBeenCalled();
        expect(m.db.appointment.create).not.toHaveBeenCalled();
        expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "BOOKING_PHONE_AMBIGUOUS" }));
        expect(JSON.stringify(m.audit.mock.calls)).not.toContain("244123456");
    });

    it("an invalid number is a 400", async () => {
        expect((await guest({ phone: "not a phone" })).status).toBe(400);
        expect(m.db.patient.create).not.toHaveBeenCalled();
    });

    it("the welcome SMS goes through the neutral service, uses the clinic's name, and its failure never fails the booking", async () => {
        m.sendSms.mockRejectedValue(new Error("DEMO_BLOCKED"));
        const res = await guest();
        expect(res.status).toBe(201);
        expect(m.sendSms).toHaveBeenCalledTimes(1);
        expect((m.sendSms.mock.calls[0] as any)[0]).toBe("+233244123456");
        expect((m.sendSms.mock.calls[0] as any)[1]).toContain("Dentoc Dental");
        expect((m.sendSms.mock.calls[0] as any)[1]).not.toMatch(/Nexus/);
    });
});

describe("booking for a patient chosen in Patient 360 (patientId)", () => {
    const staff = () => staffToken({ userId: "rec-1", tenantId: A, roles: ["RECEPTIONIST"] });

    it("uses exactly that patient: no phone lookup, no create, no welcome SMS", async () => {
        const res = await guest({ patientId: "pat-chosen", firstName: undefined, lastName: undefined, phone: undefined }, staff());
        expect(res.status).toBe(201);
        expect(m.db.patient.findFirst).toHaveBeenCalledWith({ where: { id: "pat-chosen", tenantId: A, deletedAt: null } });
        expect(m.db.patient.findMany).not.toHaveBeenCalled();
        expect(m.db.patient.create).not.toHaveBeenCalled();
        expect(m.sendSms).not.toHaveBeenCalled();
        expect(m.db.appointment.create.mock.calls[0][0].data.patientId).toBe("pat-chosen");
    });

    it("ignores a different name/phone in the body when a patientId is given", async () => {
        await guest({ patientId: "pat-chosen", phone: "0200000009", firstName: "Someone", lastName: "Else" }, staff());
        expect(m.db.patient.create).not.toHaveBeenCalled();
        expect(m.db.appointment.create.mock.calls[0][0].data.patientId).toBe("pat-chosen");
    });

    it("a patient from another clinic (or deleted) is a 404 and nothing is booked", async () => {
        m.db.patient.findFirst.mockResolvedValue(null);
        const res = await guest({ patientId: "pat-other-clinic" }, staff());
        expect(res.status).toBe(404);
        expect(m.db.appointment.create).not.toHaveBeenCalled();
    });

    it("needs the appointments:create permission", async () => {
        // a staff token that lacks it: build one by hand with no permissions
        const { signToken } = await import("@/lib/auth/jwt");
        const none = signToken({ userId: "u", tenantId: A, role: "RECEPTIONIST", roles: ["RECEPTIONIST"], permissions: [], featureFlags: [], type: "STAFF" });
        // the test setup trusts claims, so an empty permission list is what the route sees
        const res = await guest({ patientId: "pat-chosen" }, none);
        expect(res.status).toBe(403);
        expect(m.db.appointment.create).not.toHaveBeenCalled();
    });

    it("a PATIENT token always books for themselves, whatever patientId they send", async () => {
        const res = await guest({ patientId: "someone-elses" }, patientToken({ patientId: "pat-me", tenantId: A }));
        expect(res.status).toBe(201);
        expect(m.db.appointment.create.mock.calls[0][0].data.patientId).toBe("pat-me");
    });

    it("rejects a non-string patientId", async () => {
        expect((await guest({ patientId: { $ne: null } }, staff())).status).toBe(400);
    });
});

describe("status changes cancel or recreate reminders", () => {
    const staff = () => staffToken({ userId: "rec-1", tenantId: A, roles: ["ADMIN"] });
    const patch = (status: string) => patchStatus(makeRequest("/api/appointments/appt-1/status", { method: "PATCH", token: staff(), body: { status } }), params({ id: "appt-1" }));
    const appt = (status: string) => ({ id: "appt-1", tenantId: A, status, dateTime: new Date("2026-10-12T14:30:00Z") });
    beforeEach(() => {
        m.db.appointment.create.mockReset();
        (m.db.appointment as any).findUnique = vi.fn();
        (m.db.appointment as any).update = vi.fn(async ({ data }: any) => ({ id: "appt-1", ...data, patient: {}, doctor: {}, service: {}, additionalServices: [] }));
        (m.db as any).appointmentTransition = { create: vi.fn() };
        m.db.appointmentReminder.findMany.mockResolvedValue([{ id: "rem-60", generation: 0 }, { id: "rem-30", generation: 0 }]);
        m.db.appointmentReminder.updateMany.mockResolvedValue({ count: 2 });
    });

    it.each(["CANCELLED", "CHECKED_IN", "NO_SHOW"])("-> %s cancels the pending reminders in the same transaction and removes the queued jobs", async (status) => {
        (m.db.appointment as any).findUnique.mockResolvedValue(appt("SCHEDULED"));
        expect((await patch(status)).status).toBe(200);
        expect(m.db.appointmentReminder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { appointmentId: "appt-1", status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
            data: expect.objectContaining({ status: "CANCELLED" }),
        }));
        expect(m.queueRemove).toHaveBeenCalledTimes(2);
        expect((m.queueRemove.mock.calls[0] as any)[0]).toBe("reminder-rem-60-g0");
    });

    it("reopening (CANCELLED -> SCHEDULED) recreates the reminders from the database and queues them", async () => {
        (m.db.appointment as any).findUnique.mockResolvedValue(appt("CANCELLED"));
        m.db.appointmentReminder.upsert.mockResolvedValue({});
        m.db.appointmentReminder.findMany.mockResolvedValue([{ id: "rem-30", tenantId: A, appointmentId: "appt-1", offsetMinutes: 30, scheduledFor: new Date("2026-10-12T14:00:00Z"), generation: 1 }]);
        expect((await patch("SCHEDULED")).status).toBe(200);
        expect(m.db.appointmentReminder.upsert).toHaveBeenCalled();
        expect(m.db.appointmentReminder.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PENDING", generation: { increment: 1 } }) }));
        expect(m.queueAdd).toHaveBeenCalledTimes(1);
        expect((m.queueAdd.mock.calls[0] as any)[2].jobId).toBe("reminder-rem-30-g1");
    });
});

describe("GET /api/appointments/[id]/reminders", () => {
    const row = { id: "rem-60", offsetMinutes: 60, scheduledFor: new Date("2026-10-12T13:30:00Z"), status: "SENT", sentAt: new Date("2026-10-12T13:30:02Z"), provider: "mnotify", providerMessageId: "camp-9", attempts: 1, lastError: "internal detail" };
    const get = (token: string) => history(makeRequest("/api/appointments/appt-1/reminders", { token }), params({ id: "appt-1" }));
    beforeEach(() => {
        (m.db.appointment as any).findUnique = vi.fn(async () => ({ id: "appt-1", tenantId: A, patientId: "pat-1" }));
        m.db.appointmentReminder.findMany.mockResolvedValue([row]);
    });

    it("staff with appointments:view see status, provider and campaign id", async () => {
        const res = await get(staffToken({ tenantId: A, roles: ["RECEPTIONIST"] }));
        expect(res.status).toBe(200);
        const { items } = await json(res);
        expect(items[0]).toMatchObject({ offsetMinutes: 60, status: "SENT", provider: "mnotify", providerMessageId: "camp-9", error: "internal detail" });
    });

    it("the patient sees their own reminder status, but not the provider id or internal error", async () => {
        const { items } = await json(await get(patientToken({ patientId: "pat-1", tenantId: A })));
        expect(items[0]).toMatchObject({ status: "SENT", error: null });
        expect(items[0].providerMessageId).toBeUndefined();
    });

    it("another patient, another clinic's staff, and a missing appointment all get the same 404", async () => {
        expect((await get(patientToken({ patientId: "pat-2", tenantId: A }))).status).toBe(404);
        expect((await get(staffToken({ tenantId: "tenant-b", roles: ["ADMIN"] }))).status).toBe(404);
        (m.db.appointment as any).findUnique = vi.fn(async () => null);
        expect((await get(staffToken({ tenantId: A, roles: ["ADMIN"] }))).status).toBe(404);
    });

    it("staff without the permission are refused; unauthenticated is 401", async () => {
        const { signToken } = await import("@/lib/auth/jwt");
        const none = signToken({ userId: "u", tenantId: A, role: "RECEPTIONIST", roles: ["RECEPTIONIST"], permissions: [], featureFlags: [], type: "STAFF" });
        expect((await get(none)).status).toBe(403);
        expect((await history(makeRequest("/api/appointments/appt-1/reminders"), params({ id: "appt-1" }))).status).toBe(401);
    });
});
