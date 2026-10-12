/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma-shaped stand-ins */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
    const fn = () => vi.fn();
    const db: any = {
        invoice: { findUnique: fn(), update: fn(), create: fn() },
        appointment: { findUnique: fn(), update: fn(), findFirst: fn() },
        appointmentTransition: { create: fn() },
        prescription: { create: fn() },
        patient: { findFirst: fn(), findUnique: fn(), create: fn(), update: fn() },
        treatmentPlan: { findFirst: fn() },
        treatmentStep: { findFirst: fn(), create: fn() },
        authSession: { updateMany: vi.fn(async () => ({ count: 1 })) },
        auditLog: { create: fn() },
        $executeRaw: vi.fn(async () => 1),
    };
    db.$transaction = vi.fn(async (cb: any) => cb(db));
    return { db, verifyPayment: vi.fn(), reconcile: vi.fn(), audit: vi.fn(async (entry: unknown) => { void entry; }), deduct: vi.fn(async () => ({ deductions: [], lowStockAlerts: [] })) };
});
vi.mock("@/lib/db/prisma", () => ({ default: m.db, prisma: m.db }));
vi.mock("@/lib/audit/logger", () => ({ logAudit: m.audit, getClientIP: () => "127.0.0.1", getUserAgent: () => "vitest" }));
vi.mock("@/lib/payments/paystack", () => ({ verifyPayment: m.verifyPayment, verifyWebhookSignature: vi.fn(() => true) }));
vi.mock("@/lib/payments/reconcile", () => ({ reconcilePaystackReference: m.reconcile }));
vi.mock("@/lib/clinical/inventory", () => ({ deductInventoryForProcedure: m.deduct }));

import { staffToken, makeRequest, params } from "./helpers/auth";
import { POST as pay } from "@/app/api/invoices/[id]/pay/route";
import { POST as addStep } from "@/app/api/treatment-plans/[id]/steps/route";
import { POST as createPatient } from "@/app/api/patients/route";
import { PATCH as patchPatient } from "@/app/api/patients/[id]/route";
import { buildInvoiceItems, completeSession } from "@/lib/clinical/session";

const A = "tenant-a";
const saved = { ...process.env };
beforeEach(() => {
    vi.clearAllMocks();
    m.db.$transaction.mockImplementation(async (cb: any) => cb(m.db));
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { process.env = { ...saved }; });

// ───────────────────────── payments ─────────────────────────
describe("manual payments are recorded truthfully", () => {
    const owner = () => staffToken({ userId: "u", tenantId: A, roles: ["ADMIN"] });
    const call = (body: unknown, token = owner()) => pay(makeRequest("/api/invoices/inv-1/pay", { method: "POST", token, body }), params({ id: "inv-1" }));
    beforeEach(() => {
        m.db.invoice.findUnique.mockResolvedValue({ id: "inv-1", tenantId: A, status: "UNPAID", notes: null, paystackRef: null });
        m.db.invoice.update.mockImplementation(async ({ data }: any) => ({ id: "inv-1", ...data }));
    });

    it.each(["CARD", "card", "MOMO", "MOBILE_MONEY", "TRANSFER", "CHEQUE", "BITCOIN", "", "  ", 5, null, {}, []])("refuses the unsupported method %j and records NOTHING (it is never relabelled as cash)", async (method) => {
        const res = await call({ method });
        expect(res.status).toBe(400);
        expect(await res.json()).toMatchObject({ success: false, code: "UNSUPPORTED_PAYMENT_METHOD", supported: ["CASH", "PAYSTACK"] });
        expect(m.db.invoice.update).not.toHaveBeenCalled();
    });

    it("cash (explicit or the default) is recorded as CASH, flagged staff-attested", async () => {
        for (const body of [{ method: "CASH" }, { method: "cash" }, {}]) {
            m.db.invoice.update.mockClear();
            expect((await call(body)).status).toBe(200);
            const data = m.db.invoice.update.mock.calls[0][0].data;
            expect(data).toMatchObject({ status: "PAID", paymentMethod: "CASH" });
            expect(data.notes).toMatch(/not independently verified/);
        }
    });

    it("a Paystack reference cannot be recorded as cash", async () => {
        expect((await call({ method: "CASH", paystackRef: "ref_1" })).status).toBe(400);
        expect(m.db.invoice.update).not.toHaveBeenCalled();
    });

    it("Paystack is refused with FEATURE_DISABLED where the deployment has no Paystack", async () => {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        process.env.ENABLED_FEATURES = "none";
        const res = await call({ method: "PAYSTACK", paystackRef: "ref_1" });
        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ code: "FEATURE_DISABLED", feature: "paystack" });
        expect(m.verifyPayment).not.toHaveBeenCalled();
        expect(m.db.invoice.update).not.toHaveBeenCalled();
    });

    describe("with Paystack configured", () => {
        beforeEach(() => { Object.assign(process.env, { PAYSTACK_SECRET_KEY: "sk_test_x" }); });
        it("requires a reference and verifies it with Paystack before recording", async () => {
            expect((await call({ method: "PAYSTACK" })).status).toBe(400);
            m.reconcile.mockResolvedValue({ result: "NOT_SUCCESSFUL", reason: "failed" });
            expect((await call({ method: "PAYSTACK", paystackRef: "ref_bad" })).status).toBe(400);
            expect(m.db.invoice.update).not.toHaveBeenCalled();
            m.reconcile.mockResolvedValue({ result: "PAID", invoiceId: "inv-1" });
            expect((await call({ method: "paystack", paystackRef: "ref_ok" })).status).toBe(200);
            expect(m.reconcile).toHaveBeenCalledWith("ref_ok");
        });
    });

    it("an already-paid invoice and another clinic's invoice are refused", async () => {
        m.db.invoice.findUnique.mockResolvedValue({ id: "inv-1", tenantId: A, status: "PAID" });
        expect((await call({ method: "CASH" })).status).toBe(400);
        m.db.invoice.findUnique.mockResolvedValue({ id: "inv-1", tenantId: "tenant-b", status: "UNPAID" });
        expect((await call({ method: "CASH" })).status).toBe(403);
    });
});

// ───────────────────────── invoice totals ─────────────────────────
describe("the invoice covers every service on the appointment, exactly once", () => {
    const svc = (id: string, name: string, price: number) => ({ id, name, price });

    it("primary first, additional services in a deterministic order, exact pesewa arithmetic", () => {
        const r = buildInvoiceItems(svc("s1", "Scale & polish", 0.1), [svc("s3", "X-ray", 0.2), svc("s2", "Filling", 10.15)]);
        expect(r.items.map((i) => i.serviceName)).toEqual(["Scale & polish", "Filling", "X-ray"]);
        expect(r.subtotal).toBe(10.45); // exact in whole pesewas
        expect(0.1 + 0.2).not.toBe(0.3); // ...whereas the naive floating-point sum drifts
        expect(buildInvoiceItems(svc("a", "A", 0.1), [svc("b", "B", 0.2)]).subtotal).toBe(0.3);
        const reversed = buildInvoiceItems(svc("s1", "Scale & polish", 0.1), [svc("s2", "Filling", 10.15), svc("s3", "X-ray", 0.2)]);
        expect(reversed).toEqual(r); // input order does not change the invoice
    });

    it("a service listed twice (or the primary repeated) is billed once", () => {
        const r = buildInvoiceItems(svc("s1", "A", 50), [svc("s1", "A", 50), svc("s2", "B", 25), svc("s2", "B", 25)]);
        expect(r.items.map((i) => i.serviceId)).toEqual(["s1", "s2"]);
        expect(r.subtotal).toBe(75);
    });

    it("one service: unchanged behaviour", () => {
        expect(buildInvoiceItems(svc("s1", "A", 80), [])).toEqual({ items: [{ serviceId: "s1", serviceName: "A", price: 80, quantity: 1 }], subtotal: 80 });
    });

    describe("completeSession", () => {
        const appointment = (extra: any[] = []) => ({
            id: "appt-1", tenantId: A, doctorId: "doc-1", status: "IN_CHAIR", serviceId: "s1", patientId: "p1", notes: null,
            service: svc("s1", "Consultation", 100), additionalServices: extra, patient: {},
        });
        const run = (input: object = {}) => completeSession({ appointmentId: "appt-1", tenantId: A, doctorId: "doc-1", ...input } as any);
        beforeEach(() => {
            m.db.appointment.update.mockResolvedValue({});
            m.db.invoice.create.mockImplementation(async ({ data }: any) => ({ id: "inv-1", ...data }));
        });

        it("asks the database for the additional services and invoices all of them with the authoritative prices", async () => {
            (m.db.appointment as any).findUnique.mockResolvedValue(appointment([svc("s2", "Filling", 250.5), svc("s3", "X-ray", 49.5)]));
            const result = await run();
            expect(m.db.appointment.findUnique.mock.calls[0][0].include).toMatchObject({ service: true, additionalServices: true });
            const data = m.db.invoice.create.mock.calls[0][0].data;
            expect(data.items.map((i: any) => [i.serviceName, i.price])).toEqual([["Consultation", 100], ["Filling", 250.5], ["X-ray", 49.5]]);
            expect(data.amount).toBe(400);
            expect(data.totalAmount).toBe(400);
            expect(result.invoice?.totalAmount).toBe(400);
        });

        it("applies a valid discount to the combined total; an impossible discount aborts the whole completion", async () => {
            (m.db.appointment as any).findUnique.mockResolvedValue(appointment([svc("s2", "Filling", 300)]));
            await run({ discount: 40 });
            expect(m.db.invoice.create.mock.calls[0][0].data).toMatchObject({ amount: 400, discount: 40, totalAmount: 360 });
            m.db.invoice.create.mockClear();
            for (const discount of [-1, 400.01, Number.NaN, Infinity]) {
                await expect(run({ discount })).rejects.toThrow(/Discount/);
            }
            expect(m.db.invoice.create).not.toHaveBeenCalled();
        });

        it("a single-service appointment bills exactly that service, and generateInvoice:false bills nothing", async () => {
            (m.db.appointment as any).findUnique.mockResolvedValue(appointment());
            await run();
            expect(m.db.invoice.create.mock.calls[0][0].data.items).toHaveLength(1);
            m.db.invoice.create.mockClear();
            await run({ generateInvoice: false });
            expect(m.db.invoice.create).not.toHaveBeenCalled();
        });
    });
});

// ───────────────────────── treatment plan steps ─────────────────────────
describe("adding a treatment-plan step", () => {
    const doctor = () => staffToken({ userId: "doc-1", tenantId: A, roles: ["DOCTOR"] });
    const call = (body: unknown, token = doctor()) => addStep(makeRequest("/api/treatment-plans/plan-1/steps", { method: "POST", token, body }), params({ id: "plan-1" }));
    beforeEach(() => {
        m.db.treatmentPlan.findFirst.mockResolvedValue({ id: "plan-1", patientId: "p1", status: "ACTIVE" });
        m.db.treatmentStep.findFirst.mockResolvedValue({ stepNumber: 2 });
        m.db.treatmentStep.create.mockImplementation(async ({ data }: any) => ({ id: "step-3", ...data }));
    });

    it("creates the next numbered step, trimmed, under a per-plan lock, with an audit entry", async () => {
        const res = await call({ title: "  Root canal, visit 2  ", description: " detail ", estimatedCost: 450 });
        expect(res.status).toBe(201);
        expect((await res.json()).data.step).toMatchObject({ stepNumber: 3, title: "Root canal, visit 2", description: "detail", estimatedCost: 450, status: "PENDING", planId: "plan-1" });
        expect(m.db.$executeRaw).toHaveBeenCalledTimes(1); // advisory lock taken before numbering
        expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "TREATMENT_STEP_ADDED", entityId: "plan-1", tenantId: A }));
    });

    it("starts at step 1 on an empty plan", async () => {
        m.db.treatmentStep.findFirst.mockResolvedValue(null);
        await call({ title: "First" });
        expect(m.db.treatmentStep.create.mock.calls[0][0].data.stepNumber).toBe(1);
    });

    it.each([
        ["no title", {}], ["blank title", { title: "   " }], ["a very long title", { title: "x".repeat(201) }], ["a numeric title", { title: 5 }],
        ["a text cost", { title: "t", estimatedCost: "100" }], ["a negative cost", { title: "t", estimatedCost: -1 }], ["an absurd cost", { title: "t", estimatedCost: 1e12 }],
        ["a long description", { title: "t", description: "x".repeat(2001) }], ["an object appointmentId", { title: "t", appointmentId: { $ne: null } }],
    ])("rejects %s with 400 and creates nothing", async (_n, body) => {
        expect((await call(body)).status).toBe(400);
        expect(m.db.treatmentStep.create).not.toHaveBeenCalled();
    });

    it("rejects a non-JSON body", async () => {
        const res = await addStep(new (await import("next/server")).NextRequest("http://localhost/x", { method: "POST", headers: { authorization: `Bearer ${doctor()}`, "content-type": "application/json" }, body: "not json" }), params({ id: "plan-1" }));
        expect(res.status).toBe(400);
    });

    it("another clinic's plan (or a missing one) is a 404; a completed/cancelled plan is a 409", async () => {
        m.db.treatmentPlan.findFirst.mockResolvedValue(null);
        expect((await call({ title: "t" })).status).toBe(404);
        expect(m.db.treatmentPlan.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: A, deletedAt: null }) }));
        for (const status of ["COMPLETED", "CANCELLED"]) {
            m.db.treatmentPlan.findFirst.mockResolvedValue({ id: "plan-1", patientId: "p1", status });
            expect((await call({ title: "t" })).status).toBe(409);
        }
        expect(m.db.treatmentStep.create).not.toHaveBeenCalled();
    });

    it("requires patients:update; a role without it is refused and unauthenticated is 401", async () => {
        const { signToken } = await import("@/lib/auth/jwt");
        const none = signToken({ userId: "u", tenantId: A, role: "RECEPTIONIST", roles: ["RECEPTIONIST"], permissions: [], featureFlags: [], type: "STAFF" });
        expect((await call({ title: "t" }, none)).status).toBe(403);
        expect((await addStep(makeRequest("/api/treatment-plans/plan-1/steps", { method: "POST", body: { title: "t" } }), params({ id: "plan-1" }))).status).toBe(401);
        expect(m.db.treatmentStep.create).not.toHaveBeenCalled();
    });

    it("a linked appointment must belong to THIS patient and clinic and not already be linked", async () => {
        m.db.appointment.findFirst.mockResolvedValue(null);
        expect((await call({ title: "t", appointmentId: "appt-other" })).status).toBe(404);
        expect(m.db.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: A, patientId: "p1" }) }));
        m.db.appointment.findFirst.mockResolvedValue({ id: "appt-1" });
        m.db.treatmentStep.findFirst.mockResolvedValueOnce({ id: "step-x" }); // the "already linked" lookup
        expect((await call({ title: "t", appointmentId: "appt-1" })).status).toBe(409);
        expect(m.db.treatmentStep.create).not.toHaveBeenCalled();
    });
});

// ───────────────────────── patients: one canonical phone ─────────────────────────
describe("patients are stored and de-duplicated by canonical phone", () => {
    const receptionist = () => staffToken({ userId: "rec", tenantId: A, roles: ["RECEPTIONIST"] });
    const post = (body: unknown) => createPatient(makeRequest("/api/patients", { method: "POST", token: receptionist(), body }));
    beforeEach(() => {
        m.db.patient.findFirst.mockResolvedValue(null);
        m.db.patient.create.mockImplementation(async ({ data }: any) => ({ id: "p-new", ...data }));
    });

    it.each([["0244123456"], ["+233 24 412 3456"], ["233244123456"], ["024-412-3456"]])("creating with %s stores +233244123456", async (phone) => {
        expect((await post({ firstName: "Ama", lastName: "M", phone })).status).toBe(201);
        expect(m.db.patient.create.mock.calls.at(-1)![0].data.phone).toBe("+233244123456");
    });

    it("looks for an existing patient under EVERY spelling, so 024… and +23324… cannot become two patients", async () => {
        m.db.patient.findFirst.mockResolvedValue({ id: "existing" });
        const res = await post({ firstName: "Ama", lastName: "M", phone: "+233244123456" });
        expect(res.status).toBe(409);
        expect(m.db.patient.findFirst.mock.calls[0][0].where.phone.in).toEqual(expect.arrayContaining(["+233244123456", "0244123456", "233244123456", "244123456"]));
        expect(m.db.patient.create).not.toHaveBeenCalled();
    });

    it("keeps a valid international number international, and rejects an invalid one", async () => {
        await post({ firstName: "A", lastName: "B", phone: "+44 7911 123456" });
        expect(m.db.patient.create.mock.calls.at(-1)![0].data.phone).toBe("+447911123456");
        expect((await post({ firstName: "A", lastName: "B", phone: "12" })).status).toBe(400);
    });

    describe("changing a patient's phone", () => {
        const patch = (body: unknown, token = receptionist()) => patchPatient(makeRequest("/api/patients/p1", { method: "PATCH", token, body }), params({ id: "p1" }));
        beforeEach(() => {
            m.db.patient.findUnique.mockResolvedValue({ id: "p1", tenantId: A, phone: "+233244123456", firstName: "Ama" });
            m.db.patient.update.mockImplementation(async ({ data }: any) => ({ id: "p1", ...data }));
            m.db.auditLog.create.mockResolvedValue({});
        });

        it("stores the canonical form and signs the patient out everywhere", async () => {
            expect((await patch({ phone: "0200000009" })).status).toBe(200);
            expect(m.db.patient.update.mock.calls[0][0].data.phone).toBe("+233200000009");
            expect(m.db.authSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { patientId: "p1", revokedAt: null }, data: expect.objectContaining({ revokedReason: "PHONE_CHANGED" }) }));
        });

        it("refuses a number that belongs to another patient under any spelling (409) and an invalid number (400)", async () => {
            m.db.patient.findFirst.mockResolvedValue({ id: "someone-else" });
            expect((await patch({ phone: "+233200000009" })).status).toBe(409);
            expect(m.db.patient.findFirst.mock.calls[0][0].where).toMatchObject({ tenantId: A, id: { not: "p1" } });
            expect(m.db.patient.update).not.toHaveBeenCalled();
            expect((await patch({ phone: "nope" })).status).toBe(400);
        });

        it("the same number in a different spelling changes nothing and does not sign anyone out", async () => {
            m.db.patient.findFirst.mockResolvedValue(null);
            expect((await patch({ phone: "0244123456" })).status).toBe(200);
            expect(m.db.patient.update).not.toHaveBeenCalled();
            expect(m.db.authSession.updateMany).not.toHaveBeenCalled();
        });

        it("another clinic's patient is a 404", async () => {
            m.db.patient.findUnique.mockResolvedValue({ id: "p1", tenantId: "tenant-b", phone: "+233244123456" });
            expect((await patch({ phone: "0200000009" })).status).toBe(404);
        });

        it("other fields still update without touching sessions", async () => {
            m.db.patient.findFirst.mockResolvedValue(null);
            expect((await patch({ allergies: "penicillin" })).status).toBe(200);
            expect(m.db.authSession.updateMany).not.toHaveBeenCalled();
        });
    });
});
