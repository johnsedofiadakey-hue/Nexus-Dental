import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in database. Every model method is a spy so each test can assert both
// the response AND that nothing was written when access should be denied.
const { db } = vi.hoisted(() => {
    const fn = () => vi.fn();
    const db: any = {
        appointment: { findUnique: fn(), findFirst: fn(), update: fn() },
        appointmentTransition: { create: fn() },
        patient: { findUnique: fn(), findFirst: fn(), update: fn() },
        staffInvite: { findUnique: fn(), delete: fn() },
        user: { findUnique: fn(), update: fn() },
        userRoleMapping: { deleteMany: fn(), create: fn() },
        invoice: { findUnique: fn(), create: fn(), update: fn() },
        patientConsent: { findMany: fn() },
        auditLog: { create: fn() },
    };
    db.$transaction = vi.fn(async (cb: any) => cb(db));
    return { db };
});

vi.mock("@/lib/db/prisma", () => ({ default: db, prisma: db }));
vi.mock("@/lib/audit/logger", () => ({
    logAudit: vi.fn(async () => {}),
    getClientIP: () => "127.0.0.1",
    getUserAgent: () => "vitest",
}));

import { staffToken, patientToken, makeRequest, params } from "./helpers/auth";
import { PATCH as patchAppointmentStatus } from "@/app/api/appointments/[id]/status/route";
import { PATCH as patchPatient } from "@/app/api/patients/[id]/route";
import { DELETE as deleteInvite } from "@/app/api/staff/invite/route";
import { PATCH as patchStaff } from "@/app/api/staff/[id]/route";
import { POST as refundInvoice } from "@/app/api/invoices/[id]/refund/route";
import { POST as createInvoice } from "@/app/api/invoices/route";
import { GET as getPatientConsents } from "@/app/api/consent/patient/route";
import { POST as insuranceEligibility } from "@/app/api/insurance/eligibility/route";

const A = "tenant-a";
const B = "tenant-b";

beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: any) => cb(db));
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

const writes = () => [
    db.appointment.update,
    db.patient.update,
    db.staffInvite.delete,
    db.user.update,
    db.userRoleMapping.deleteMany,
    db.userRoleMapping.create,
    db.invoice.create,
    db.invoice.update,
];
const nothingWritten = () => writes().forEach((w) => expect(w).not.toHaveBeenCalled());

describe("appointment status — cross-clinic isolation (A1)", () => {
    const path = "/api/appointments/appt-b/status";

    it("returns 404 and writes nothing when the appointment belongs to another clinic", async () => {
        db.appointment.findUnique.mockResolvedValue({ id: "appt-b", tenantId: B, status: "SCHEDULED" });
        const token = staffToken({ tenantId: A, roles: ["RECEPTIONIST"] });
        const res = await patchAppointmentStatus(
            makeRequest(path, { method: "PATCH", token, body: { status: "CHECKED_IN" } }),
            params({ id: "appt-b" })
        );
        expect(res.status).toBe(404);
        nothingWritten();
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("allows the same transition inside the staff member's own clinic", async () => {
        db.appointment.findUnique.mockResolvedValue({ id: "appt-a", tenantId: A, status: "SCHEDULED" });
        db.appointment.update.mockResolvedValue({ id: "appt-a", status: "CHECKED_IN", service: { name: "x" }, additionalServices: [] });
        const token = staffToken({ tenantId: A, roles: ["RECEPTIONIST"] });
        const res = await patchAppointmentStatus(
            makeRequest("/api/appointments/appt-a/status", { method: "PATCH", token, body: { status: "CHECKED_IN" } }),
            params({ id: "appt-a" })
        );
        expect(res.status).toBe(200);
        expect(db.appointment.update).toHaveBeenCalledOnce();
    });

    it("rejects an unauthenticated request", async () => {
        const res = await patchAppointmentStatus(
            makeRequest(path, { method: "PATCH", body: { status: "CHECKED_IN" } }),
            params({ id: "appt-b" })
        );
        expect(res.status).toBe(401);
    });

    it("rejects an invalid state jump", async () => {
        db.appointment.findUnique.mockResolvedValue({ id: "appt-a", tenantId: A, status: "SCHEDULED" });
        const token = staffToken({ tenantId: A, roles: ["RECEPTIONIST"] });
        const res = await patchAppointmentStatus(
            makeRequest("/api/appointments/appt-a/status", { method: "PATCH", token, body: { status: "COMPLETED" } }),
            params({ id: "appt-a" })
        );
        expect(res.status).toBe(422);
        nothingWritten();
    });

    it("only lets owners/admins reopen a cancelled appointment (M4)", async () => {
        db.appointment.findUnique.mockResolvedValue({ id: "appt-a", tenantId: A, status: "CANCELLED" });
        db.appointment.update.mockResolvedValue({ id: "appt-a", status: "SCHEDULED", service: { name: "x" }, additionalServices: [] });
        const body = { status: "SCHEDULED" };
        const req = (token: string) =>
            makeRequest("/api/appointments/appt-a/status", { method: "PATCH", token, body });

        const denied = await patchAppointmentStatus(req(staffToken({ tenantId: A, roles: ["RECEPTIONIST"] })), params({ id: "appt-a" }));
        expect(denied.status).toBe(403);
        expect(db.appointment.update).not.toHaveBeenCalled();

        const allowed = await patchAppointmentStatus(req(staffToken({ tenantId: A, roles: ["ADMIN"] })), params({ id: "appt-a" }));
        expect(allowed.status).toBe(200);
    });
});

describe("patient records — cross-clinic isolation (A2)", () => {
    it("returns 404 and writes nothing when the patient belongs to another clinic", async () => {
        db.patient.findUnique.mockResolvedValue({ id: "pat-b", tenantId: B, firstName: "B" });
        const token = staffToken({ tenantId: A, roles: ["RECEPTIONIST"] });
        const res = await patchPatient(
            makeRequest("/api/patients/pat-b", { method: "PATCH", token, body: { allergies: "changed" } }),
            params({ id: "pat-b" })
        );
        expect(res.status).toBe(404);
        nothingWritten();
    });

    it("lets staff update a patient in their own clinic", async () => {
        db.patient.findUnique.mockResolvedValue({ id: "pat-a", tenantId: A, firstName: "A" });
        db.patient.update.mockResolvedValue({ id: "pat-a" });
        const token = staffToken({ tenantId: A, roles: ["RECEPTIONIST"] });
        const res = await patchPatient(
            makeRequest("/api/patients/pat-a", { method: "PATCH", token, body: { allergies: "penicillin" } }),
            params({ id: "pat-a" })
        );
        expect(res.status).toBe(200);
        expect(db.patient.update).toHaveBeenCalledOnce();
    });
});

describe("staff invites — role and clinic checks (A5)", () => {
    const del = (token: string) => makeRequest("/api/staff/invite?id=inv-b", { method: "DELETE", token });

    it("forbids a receptionist from revoking any invite", async () => {
        const res = await deleteInvite(del(staffToken({ tenantId: A, roles: ["RECEPTIONIST"] })));
        expect(res.status).toBe(403);
        nothingWritten();
    });

    it("returns 404 for an admin revoking another clinic's invite", async () => {
        db.staffInvite.findUnique.mockResolvedValue({ id: "inv-b", tenantId: B });
        const res = await deleteInvite(del(staffToken({ tenantId: A, roles: ["ADMIN"] })));
        expect(res.status).toBe(404);
        nothingWritten();
    });

    it("lets an admin revoke an invite in their own clinic", async () => {
        db.staffInvite.findUnique.mockResolvedValue({ id: "inv-b", tenantId: A });
        db.staffInvite.delete.mockResolvedValue({});
        const res = await deleteInvite(del(staffToken({ tenantId: A, roles: ["ADMIN"] })));
        expect(res.status).toBe(200);
        expect(db.staffInvite.delete).toHaveBeenCalledOnce();
    });
});

describe("staff access changes", () => {
    const patch = (token: string, id: string, body: unknown) =>
        patchStaff(makeRequest(`/api/staff/${id}`, { method: "PATCH", token, body }), params({ id }));
    const target = (over: object = {}) => ({
        id: "doc-1",
        tenantId: A,
        status: "ACTIVE",
        deletedAt: null,
        roles: [{ id: "m1", systemRole: "DOCTOR" }],
        ...over,
    });

    it("requires the staff-update permission", async () => {
        const res = await patch(staffToken({ tenantId: A, roles: ["RECEPTIONIST"] }), "doc-1", { status: "SUSPENDED" });
        expect(res.status).toBe(403);
        nothingWritten();
    });

    it("stops you changing your own account", async () => {
        const token = staffToken({ tenantId: A, userId: "me", roles: ["CLINIC_OWNER"] });
        const res = await patch(token, "me", { status: "SUSPENDED" });
        expect(res.status).toBe(400);
        nothingWritten();
    });

    it("treats another clinic's staff as not found", async () => {
        db.user.findUnique.mockResolvedValue(target({ tenantId: B }));
        const res = await patch(staffToken({ tenantId: A, roles: ["CLINIC_OWNER"] }), "doc-1", { status: "SUSPENDED" });
        expect(res.status).toBe(404);
        nothingWritten();
    });

    it("never lets an owner account be changed here", async () => {
        db.user.findUnique.mockResolvedValue(target({ roles: [{ id: "m", systemRole: "CLINIC_OWNER" }] }));
        const res = await patch(staffToken({ tenantId: A, roles: ["ADMIN"] }), "doc-1", { status: "SUSPENDED" });
        expect(res.status).toBe(403);
        nothingWritten();
    });

    it("stops an admin managing another admin or granting the admin role", async () => {
        db.user.findUnique.mockResolvedValue(target({ roles: [{ id: "m", systemRole: "ADMIN" }] }));
        const adminToken = staffToken({ tenantId: A, roles: ["ADMIN"] });
        expect((await patch(adminToken, "doc-1", { status: "SUSPENDED" })).status).toBe(403);

        db.user.findUnique.mockResolvedValue(target());
        expect((await patch(adminToken, "doc-1", { role: "ADMIN" })).status).toBe(403);
        nothingWritten();
    });

    it("refuses to assign owner roles through the dropdown", async () => {
        db.user.findUnique.mockResolvedValue(target());
        const res = await patch(staffToken({ tenantId: A, roles: ["CLINIC_OWNER"] }), "doc-1", { role: "CLINIC_OWNER" });
        expect(res.status).toBe(400);
        nothingWritten();
    });

    it("lets an owner suspend and re-role a clinician in their own clinic", async () => {
        db.user.findUnique.mockResolvedValue(target());
        const token = staffToken({ tenantId: A, roles: ["CLINIC_OWNER"] });
        const res = await patch(token, "doc-1", { status: "SUSPENDED", role: "NURSE" });
        expect(res.status).toBe(200);
        expect(db.user.update).toHaveBeenCalledWith({ where: { id: "doc-1" }, data: { status: "SUSPENDED" } });
        expect(db.userRoleMapping.create).toHaveBeenCalledWith({ data: { userId: "doc-1", systemRole: "NURSE" } });
    });
});

describe("refunds", () => {
    const refund = (token: string) =>
        refundInvoice(makeRequest("/api/invoices/inv-1/refund", { method: "POST", token, body: {} }), params({ id: "inv-1" }));

    it("requires refund authority — a receptionist or billing officer is refused", async () => {
        expect((await refund(staffToken({ tenantId: A, roles: ["RECEPTIONIST"] }))).status).toBe(403);
        expect((await refund(staffToken({ tenantId: A, roles: ["BILLING_STAFF"] }))).status).toBe(403);
        expect(db.invoice.findUnique).not.toHaveBeenCalled();
    });

    it("treats another clinic's invoice as not found even for an admin", async () => {
        db.invoice.findUnique.mockResolvedValue({ id: "inv-1", tenantId: B, status: "PAID", paystackRef: "ref" });
        const res = await refund(staffToken({ tenantId: A, roles: ["ADMIN"] }));
        expect(res.status).toBe(404);
        nothingWritten();
    });

    it("does not mark the invoice refunded just because a refund was requested", async () => {
        db.invoice.findUnique.mockResolvedValue({ id: "inv-1", tenantId: A, status: "PAID", paystackRef: null, notes: null });
        const res = await refund(staffToken({ tenantId: A, roles: ["ADMIN"] }));
        // No Paystack reference → refused; status is never touched.
        expect(res.status).toBe(400);
        nothingWritten();
    });
});

describe("patient boundaries", () => {
    it("stops a patient reading another patient's signed consents", async () => {
        const token = patientToken({ patientId: "pat-1", tenantId: A });
        const res = await getPatientConsents(makeRequest("/api/consent/patient?patientId=pat-2", { token }));
        expect(res.status).toBe(403);
        expect(db.patientConsent.findMany).not.toHaveBeenCalled();
    });

    it("lets a patient read their own signed consents", async () => {
        db.patientConsent.findMany.mockResolvedValue([]);
        const token = patientToken({ patientId: "pat-1", tenantId: A });
        const res = await getPatientConsents(makeRequest("/api/consent/patient?patientId=pat-1", { token }));
        expect(res.status).toBe(200);
    });

    it("stops a patient using the staff insurance-eligibility tool on anyone", async () => {
        const token = patientToken({ patientId: "pat-1", tenantId: A });
        const res = await insuranceEligibility(
            makeRequest("/api/insurance/eligibility", {
                method: "POST",
                token,
                body: { patientId: "pat-2", provider: "X", policyNumber: "1" },
            })
        );
        expect(res.status).toBe(403);
        expect(db.patient.update).not.toHaveBeenCalled();
    });
});

describe("invoice creation validation", () => {
    const create = (body: unknown) =>
        createInvoice(
            makeRequest("/api/invoices", { method: "POST", token: staffToken({ tenantId: A, roles: ["BILLING_STAFF"] }), body })
        );
    const item = { description: "Cleaning", quantity: 1, unitPrice: 100 };

    it("rejects a patient or appointment from another clinic", async () => {
        db.patient.findFirst.mockResolvedValue(null);
        const res = await create({ patientId: "pat-b", appointmentId: "appt-b", items: [item] });
        expect(res.status).toBe(404);
        expect(db.invoice.create).not.toHaveBeenCalled();
    });

    it("rejects an appointment that is not for that patient", async () => {
        db.patient.findFirst.mockResolvedValue({ id: "pat-a" });
        db.appointment.findFirst.mockResolvedValue(null);
        const res = await create({ patientId: "pat-a", appointmentId: "appt-other", items: [item] });
        expect(res.status).toBe(404);
        expect(db.invoice.create).not.toHaveBeenCalled();
    });

    it.each([
        ["a negative price", { items: [{ ...item, unitPrice: -50 }] }],
        ["a zero quantity", { items: [{ ...item, quantity: 0 }] }],
        ["a non-numeric price", { items: [{ ...item, unitPrice: "free" }] }],
        ["a negative discount", { items: [item], discount: -10 }],
        ["a discount bigger than the invoice", { items: [item], discount: 500 }],
        ["no items", { items: [] }],
    ])("rejects %s", async (_label, extra) => {
        const res = await create({ patientId: "pat-a", appointmentId: "appt-a", ...extra });
        expect(res.status).toBe(400);
        expect(db.invoice.create).not.toHaveBeenCalled();
    });

    it("creates a correctly totalled invoice for valid input", async () => {
        db.patient.findFirst.mockResolvedValue({ id: "pat-a" });
        db.appointment.findFirst.mockResolvedValue({ id: "appt-a" });
        db.invoice.create.mockImplementation(async ({ data }: any) => ({ id: "inv-new", ...data }));
        const res = await create({
            patientId: "pat-a",
            appointmentId: "appt-a",
            items: [{ description: "Filling", quantity: 2, unitPrice: 75.5 }],
            discount: 11,
        });
        expect(res.status).toBe(201);
        const created = db.invoice.create.mock.calls[0][0].data;
        expect(created).toMatchObject({ tenantId: A, amount: 151, discount: 11, totalAmount: 140, status: "UNPAID" });
    });
});
