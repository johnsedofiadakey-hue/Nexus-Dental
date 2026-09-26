import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// ── Shared mocks ────────────────────────────────────────────────────────────
const m = vi.hoisted(() => {
    const fn = () => vi.fn();
    const db: any = {
        patient: { findFirst: fn() },
        invoice: { findFirst: fn(), update: fn() },
        user: { findUnique: fn(), update: fn(), create: fn() },
        staffInvite: { findUnique: fn(), updateMany: fn() },
    };
    db.$transaction = vi.fn(async (cb: any) => cb(db));
    return {
        db,
        redis: { set: fn(), getdel: fn() },
        rateLimit: {
            consume: vi.fn(async () => ({ allowed: true, remaining: 5, retryAfterSeconds: 0 })),
            reset: vi.fn(async () => {}),
        },
        firebase: { verifyIdToken: fn() },
        paystack: { verifyPayment: fn(), verifyWebhookSignature: vi.fn(() => true) },
        sendEmail: vi.fn(async () => {}),
        resolvePermissions: vi.fn(async () => ["appointments:view"]),
    };
});

vi.mock("@/lib/db/prisma", () => ({ default: m.db, prisma: m.db }));
vi.mock("@/lib/db/redis", () => ({ default: m.redis }));
vi.mock("@/lib/audit/logger", () => ({
    logAudit: vi.fn(async () => {}),
    getClientIP: () => "127.0.0.1",
    getUserAgent: () => "vitest",
}));
vi.mock("@/lib/security/rate-limit", () => ({
    consumeRateLimit: m.rateLimit.consume,
    resetRateLimit: m.rateLimit.reset,
    clientIp: () => "203.0.113.9",
}));
vi.mock("@/lib/firebase/server", () => ({ adminAuth: { verifyIdToken: m.firebase.verifyIdToken } }));
vi.mock("@/lib/payments/paystack", () => ({
    verifyPayment: m.paystack.verifyPayment,
    verifyWebhookSignature: m.paystack.verifyWebhookSignature,
}));
vi.mock("@/lib/email/sender", () => ({ sendEmail: m.sendEmail }));
vi.mock("@/lib/auth/permissions", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/auth/permissions")>()),
    resolveUserPermissions: m.resolvePermissions,
}));

import { makeRequest, params } from "./helpers/auth";
import { POST as verifyPatientOtp } from "@/app/api/auth/patient/otp/verify/route";
import { POST as paystackWebhook } from "@/app/api/webhooks/paystack/route";
import { POST as acceptInvite } from "@/app/api/staff/invite/[token]/accept/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as login } from "@/app/api/auth/login/route";

const { db, redis, rateLimit, firebase, paystack } = m;
const blocked = { allowed: false, remaining: 0, retryAfterSeconds: 600 };
const json = async (res: Response) => res.json();

beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (cb: any) => cb(db));
    rateLimit.consume.mockResolvedValue({ allowed: true, remaining: 5, retryAfterSeconds: 0 });
    paystack.verifyWebhookSignature.mockReturnValue(true);
    m.resolvePermissions.mockResolvedValue(["appointments:view"]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
});

// ── Patient OTP login: the account-takeover fix ─────────────────────────────
describe("patient OTP verify — phone binding", () => {
    const post = (body: unknown) =>
        verifyPatientOtp(makeRequest("/api/auth/patient/otp/verify", { method: "POST", body }));
    const patient = { id: "pat-1", firstName: "Ama", lastName: "K", tenantId: "tenant-a" };

    it("signs in when the Firebase token proves the SAME phone number", async () => {
        firebase.verifyIdToken.mockResolvedValue({ phone_number: "+233244123456" });
        db.patient.findFirst.mockResolvedValue(patient);
        const res = await post({ phone: "0244123456", token: "t" });
        expect(res.status).toBe(200);
        expect(res.headers.get("set-cookie")).toContain("nexus_patient_token=");
    });

    it("refuses a valid token that belongs to a DIFFERENT phone number (the takeover)", async () => {
        firebase.verifyIdToken.mockResolvedValue({ phone_number: "+233200000099" });
        const res = await post({ phone: "0244123456", token: "attacker-token" });
        expect(res.status).toBe(401);
        expect(db.patient.findFirst).not.toHaveBeenCalled();
        expect(res.headers.get("set-cookie") ?? "").not.toContain("nexus_patient_token=ey");
    });

    it("refuses a token with no phone number at all (e.g. an email sign-in token)", async () => {
        firebase.verifyIdToken.mockResolvedValue({ email: "a@b.c" });
        expect((await post({ phone: "0244123456", token: "t" })).status).toBe(401);
        expect(db.patient.findFirst).not.toHaveBeenCalled();
    });

    it("refuses a token Firebase rejects", async () => {
        firebase.verifyIdToken.mockRejectedValue(new Error("expired"));
        expect((await post({ phone: "0244123456", token: "bad" })).status).toBe(401);
    });

    it("is rate limited", async () => {
        rateLimit.consume.mockResolvedValue(blocked);
        const res = await post({ phone: "0244123456", token: "t" });
        expect(res.status).toBe(429);
        expect(res.headers.get("retry-after")).toBe("600");
        expect(firebase.verifyIdToken).not.toHaveBeenCalled();
    });
});

// ── Paystack webhook: amount and currency verification ──────────────────────
describe("paystack webhook", () => {
    const send = (event: object = { event: "charge.success", data: { reference: "ref-1" } }) =>
        paystackWebhook(
            makeRequest("/api/webhooks/paystack", {
                method: "POST",
                body: event,
            })
        );
    const invoice = { id: "inv-1", totalAmount: 100, status: "UNPAID" };
    const txn = (over: object = {}) => ({ status: "success", amount: 10000, currency: "GHS", paid_at: "2026-09-01T10:00:00Z", ...over });

    it("rejects a bad signature before doing anything", async () => {
        paystack.verifyWebhookSignature.mockReturnValue(false);
        expect((await send()).status).toBe(401);
        expect(paystack.verifyPayment).not.toHaveBeenCalled();
    });

    it("marks the invoice PAID when amount and currency match", async () => {
        paystack.verifyPayment.mockResolvedValue(txn());
        db.invoice.findFirst.mockResolvedValue(invoice);
        expect((await send()).status).toBe(200);
        expect(db.invoice.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "inv-1" }, data: expect.objectContaining({ status: "PAID" }) })
        );
    });

    it("does NOT mark it paid when a cheaper transaction is replayed against it", async () => {
        paystack.verifyPayment.mockResolvedValue(txn({ amount: 100 })); // GHS 1 for a GHS 100 invoice
        db.invoice.findFirst.mockResolvedValue(invoice);
        expect((await send()).status).toBe(200);
        expect(db.invoice.update).not.toHaveBeenCalled();
    });

    it("does NOT mark it paid when the currency is wrong", async () => {
        paystack.verifyPayment.mockResolvedValue(txn({ currency: "USD" }));
        db.invoice.findFirst.mockResolvedValue(invoice);
        await send();
        expect(db.invoice.update).not.toHaveBeenCalled();
    });

    it("ignores transactions Paystack does not report as successful", async () => {
        paystack.verifyPayment.mockResolvedValue(txn({ status: "failed" }));
        await send();
        expect(db.invoice.update).not.toHaveBeenCalled();
    });

    it("is idempotent for an invoice that is already paid", async () => {
        paystack.verifyPayment.mockResolvedValue(txn());
        db.invoice.findFirst.mockResolvedValue({ ...invoice, status: "PAID" });
        await send();
        expect(db.invoice.update).not.toHaveBeenCalled();
    });

    it("returns 500 (so Paystack retries) when processing fails", async () => {
        paystack.verifyPayment.mockRejectedValue(new Error("network"));
        expect((await send()).status).toBe(500);
    });
});

// ── Staff invitation acceptance ─────────────────────────────────────────────
describe("staff invite acceptance", () => {
    const strong = "Str0ng!Passw0rd";
    const accept = (body: unknown, token = "tok-1") =>
        acceptInvite(makeRequest(`/api/staff/invite/${token}/accept`, { method: "POST", body }), params({ token }));
    const invite = (over: object = {}) => ({
        id: "inv-1",
        tenantId: "tenant-a",
        email: "New.Doc@Clinic.com",
        role: "DOCTOR",
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 3600_000),
        tenant: { id: "tenant-a", name: "Airport Hills", status: "ACTIVE" },
        ...over,
    });
    const good = { firstName: "New", lastName: "Doc", password: strong };

    it("rejects a weak password without touching the invite", async () => {
        const res = await accept({ ...good, password: "weak" });
        expect(res.status).toBe(400);
        expect(db.staffInvite.findUnique).not.toHaveBeenCalled();
    });

    it("rejects unknown, expired and already-used invites", async () => {
        db.staffInvite.findUnique.mockResolvedValueOnce(null);
        expect((await accept(good)).status).toBe(404);
        db.staffInvite.findUnique.mockResolvedValueOnce(invite({ expiresAt: new Date(Date.now() - 1000) }));
        expect((await accept(good)).status).toBe(410);
        db.staffInvite.findUnique.mockResolvedValueOnce(invite({ acceptedAt: new Date() }));
        expect((await accept(good)).status).toBe(410);
        expect(db.user.create).not.toHaveBeenCalled();
    });

    it("refuses when the clinic is not active or the email already has an account", async () => {
        db.staffInvite.findUnique.mockResolvedValueOnce(invite({ tenant: { id: "tenant-a", name: "X", status: "FROZEN" } }));
        expect((await accept(good)).status).toBe(403);
        db.staffInvite.findUnique.mockResolvedValueOnce(invite());
        db.user.findUnique.mockResolvedValueOnce({ id: "existing" });
        expect((await accept(good)).status).toBe(409);
        expect(db.user.create).not.toHaveBeenCalled();
    });

    it("creates the account with the INVITED role and clinic, hashes the password, and signs in", async () => {
        db.staffInvite.findUnique.mockResolvedValue(invite());
        db.user.findUnique.mockResolvedValue(null);
        db.staffInvite.updateMany.mockResolvedValue({ count: 1 });
        db.user.create.mockImplementation(async ({ data }: any) => ({
            id: "user-new",
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            tenantId: data.tenantId,
            roles: [{ systemRole: "DOCTOR" }],
        }));
        const res = await accept(good);
        expect(res.status).toBe(200);
        expect(res.headers.get("set-cookie")).toContain("nexus_token=");
        const data = db.user.create.mock.calls[0][0].data;
        expect(data).toMatchObject({ email: "new.doc@clinic.com", tenantId: "tenant-a", status: "ACTIVE" });
        expect(data.roles).toEqual({ create: { systemRole: "DOCTOR" } });
        expect(data.passwordHash).not.toContain(strong);
        expect(await bcrypt.compare(strong, data.passwordHash)).toBe(true);
    });

    it("is single-use: a concurrent second acceptance loses the race and creates nothing", async () => {
        db.staffInvite.findUnique.mockResolvedValue(invite());
        db.user.findUnique.mockResolvedValue(null);
        db.staffInvite.updateMany.mockResolvedValue({ count: 0 }); // someone else claimed it first
        const res = await accept(good);
        expect(res.status).toBe(410);
        expect(db.user.create).not.toHaveBeenCalled();
    });
});

// ── Password reset ──────────────────────────────────────────────────────────
describe("password reset", () => {
    const token = "a".repeat(64);
    const key = `pwreset:${crypto.createHash("sha256").update(token).digest("hex")}`;
    const strong = "Str0ng!Passw0rd";
    const reset = (body: unknown) => resetPassword(makeRequest("/api/auth/reset-password", { method: "POST", body }));

    it("rejects malformed tokens and weak passwords before consuming anything", async () => {
        expect((await reset({ token: "short", password: strong })).status).toBe(400);
        expect((await reset({ token, password: "weak" })).status).toBe(400);
        expect(redis.getdel).not.toHaveBeenCalled();
    });

    it("rejects an unknown or already-used token", async () => {
        redis.getdel.mockResolvedValue(null);
        expect((await reset({ token, password: strong })).status).toBe(400);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it("looks the token up by its HASH and stores a hashed new password", async () => {
        redis.getdel.mockResolvedValue("user-1");
        db.user.findUnique.mockResolvedValue({ id: "user-1", tenantId: "tenant-a", status: "ACTIVE", deletedAt: null });
        const res = await reset({ token, password: strong });
        expect(res.status).toBe(200);
        expect(redis.getdel).toHaveBeenCalledWith(key);
        const hash = db.user.update.mock.calls[0][0].data.passwordHash;
        expect(hash).not.toContain(strong);
        expect(await bcrypt.compare(strong, hash)).toBe(true);
    });

    it("will not reset a suspended account", async () => {
        redis.getdel.mockResolvedValue("user-1");
        db.user.findUnique.mockResolvedValue({ id: "user-1", tenantId: "tenant-a", status: "SUSPENDED", deletedAt: null });
        expect((await reset({ token, password: strong })).status).toBe(400);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it("is rate limited", async () => {
        rateLimit.consume.mockResolvedValue(blocked);
        expect((await reset({ token, password: strong })).status).toBe(429);
    });
});

describe("forgot password", () => {
    const forgot = (email: unknown) => forgotPassword(makeRequest("/api/auth/forgot-password", { method: "POST", body: { email } }));

    it("answers identically for unknown, suspended and known accounts — no enumeration", async () => {
        db.user.findUnique.mockResolvedValueOnce(null);
        const unknown = await json(await forgot("nobody@x.com"));
        db.user.findUnique.mockResolvedValueOnce({ id: "u", firstName: "A", status: "SUSPENDED", deletedAt: null });
        const suspended = await json(await forgot("sus@x.com"));
        db.user.findUnique.mockResolvedValueOnce({ id: "u", firstName: "A", status: "ACTIVE", deletedAt: null });
        const known = await json(await forgot("real@x.com"));
        expect(unknown).toEqual(suspended);
        expect(unknown).toEqual(known);
    });

    it("emails a single-use link and stores only the HASH of the token for one hour", async () => {
        db.user.findUnique.mockResolvedValue({ id: "user-1", firstName: "Ama", status: "ACTIVE", deletedAt: null });
        await forgot("real@x.com");
        expect(m.sendEmail).toHaveBeenCalledOnce();
        const html: string = (m.sendEmail.mock.calls[0] as any)[0].html;
        const token = html.match(/token=([a-f0-9]{64})/)![1];
        const [storedKey, storedValue, ex, ttl] = redis.set.mock.calls[0];
        expect(storedKey).toBe(`pwreset:${crypto.createHash("sha256").update(token).digest("hex")}`);
        expect(storedKey).not.toContain(token);
        expect([storedValue, ex, ttl]).toEqual(["user-1", "EX", 3600]);
    });

    it("sends nothing for unknown or suspended accounts", async () => {
        db.user.findUnique.mockResolvedValueOnce(null);
        await forgot("nobody@x.com");
        db.user.findUnique.mockResolvedValueOnce({ id: "u", firstName: "A", status: "SUSPENDED", deletedAt: null });
        await forgot("sus@x.com");
        expect(m.sendEmail).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
    });

    it("silently stops mailing an address that keeps asking", async () => {
        rateLimit.consume
            .mockResolvedValueOnce({ allowed: true, remaining: 9, retryAfterSeconds: 0 }) // per IP
            .mockResolvedValueOnce(blocked); // per email
        const res = await forgot("real@x.com");
        expect(res.status).toBe(200);
        expect(m.sendEmail).not.toHaveBeenCalled();
    });
});

// ── Staff login ─────────────────────────────────────────────────────────────
describe("staff login", () => {
    const password = "Correct!Horse9";
    const hash = bcrypt.hashSync(password, 4);
    const account = (over: object = {}) => ({
        id: "user-1",
        email: "staff@clinic.com",
        passwordHash: hash,
        firstName: "S",
        lastName: "T",
        status: "ACTIVE",
        tenantId: "tenant-a",
        tenant: { status: "ACTIVE" },
        roles: [{ systemRole: "RECEPTIONIST" }],
        ...over,
    });
    const signIn = (body: object = { email: "Staff@Clinic.com", password }) =>
        login(makeRequest("/api/auth/login", { method: "POST", body }));

    it("blocks brute force before looking the account up", async () => {
        rateLimit.consume.mockResolvedValue(blocked);
        const res = await signIn();
        expect(res.status).toBe(429);
        expect(db.user.findUnique).not.toHaveBeenCalled();
    });

    it("gives the same 401 for an unknown email and a wrong password", async () => {
        db.user.findUnique.mockResolvedValueOnce(null);
        const unknown = await signIn();
        db.user.findUnique.mockResolvedValueOnce(account());
        const wrong = await signIn({ email: "staff@clinic.com", password: "nope" });
        expect([unknown.status, wrong.status]).toEqual([401, 401]);
        expect((await json(unknown)).error).toBe((await json(wrong)).error);
    });

    it("refuses suspended accounts and inactive clinics", async () => {
        db.user.findUnique.mockResolvedValueOnce(account({ status: "SUSPENDED" }));
        expect((await signIn()).status).toBe(403);
        db.user.findUnique.mockResolvedValueOnce(account({ tenant: { status: "FROZEN" } }));
        expect((await signIn()).status).toBe(403);
    });

    it("signs in with a session cookie and clears the per-IP failure counter", async () => {
        db.user.findUnique.mockResolvedValue(account());
        const res = await signIn();
        expect(res.status).toBe(200);
        expect(res.headers.get("set-cookie")).toContain("nexus_token=");
        expect(rateLimit.reset).toHaveBeenCalled();
    });

    it("gives a multi-role user the highest-authority role regardless of row order", async () => {
        db.user.findUnique.mockResolvedValue(
            account({ roles: [{ systemRole: "RECEPTIONIST" }, { systemRole: "ADMIN" }, { systemRole: "NURSE" }] })
        );
        const body = await json(await signIn());
        expect(body.user.role).toBe("ADMIN");
    });
});
