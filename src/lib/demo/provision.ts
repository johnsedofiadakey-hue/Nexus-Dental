// ============================================
// NEXUS DENTAL — Synthetic demo provisioning
//
// Fills ONE already-provisioned clinic with clearly labelled SYNTHETIC records so a
// product demonstration can be rehearsed end to end. It is deliberately narrow:
//
//   * refuses to run unless DEMO_MODE=true AND the clinic id is typed back exactly
//   * never deletes anything and never touches records it did not create (every record it
//     owns has a `demo-` id; a real user or patient that would collide is a hard refusal)
//   * every synthetic account uses a reserved ".invalid" e-mail address
//   * staff passwords are random, shown ONLY in a 0600 file outside the repository, and are
//     not rotated on a re-run unless asked
//   * the demo patient's phone comes from DEMO_PATIENT_PHONE (never invented or committed)
//     and must be on DEMO_SMS_ALLOWLIST, so reminders can only ever reach that phone
//   * idempotent: a second run changes nothing and creates no duplicates
//   * `check` mode reports readiness without writing and without exposing PII
//
// It does NOT call the destructive legacy seed and does not create the clinic: run
// `npm run clinic:provision` first.
// ============================================

import crypto from "crypto";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { assertMigrationsApplied, ProvisionError } from "@/lib/config/provision";
import { mergeFeatureFlags } from "@/lib/config/features";
import { validatePasswordStrength } from "@/lib/auth/password";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { parseAllowlist, readSmsConfig, smsAvailable, type Env } from "@/lib/sms/config";
import { clinicTimeZone, zonedWallTimeToUtc } from "@/lib/utils/timezone";

export type DemoErrorCode = "NOT_DEMO_MODE" | "CONFIRMATION_REQUIRED" | "CLINIC_MISSING" | "SECOND_CLINIC" | "PHONE_REQUIRED" | "PHONE_NOT_ALLOWLISTED" | "REAL_RECORD_COLLISION" | "CREDENTIALS_FILE_INVALID" | "NOT_READY";

export class DemoError extends Error {
    constructor(public code: DemoErrorCode, message: string) {
        super(message);
        this.name = "DemoError";
    }
}

export const DEMO_VERSION = 1;
const DEMO_EMAIL_DOMAIN = "demo.invalid";

/** Everything this module may create. The ids are the only things it will ever update. */
export const DEMO_IDS = {
    owner: "demo-user-owner",
    receptionist: "demo-user-receptionist",
    doctor: "demo-user-doctor",
    patient: "demo-patient-1",
    pastAppointment: "demo-appt-past",
    nextAppointment: "demo-appt-next",
    prescription: "demo-rx-1",
    invoice: "demo-inv-1",
    plan: "demo-plan-1",
} as const;

const DEMO_STAFF = [
    { key: "owner", id: DEMO_IDS.owner, email: `owner@${DEMO_EMAIL_DOMAIN}`, role: "CLINIC_OWNER", firstName: "Demo", lastName: "Owner" },
    { key: "receptionist", id: DEMO_IDS.receptionist, email: `reception@${DEMO_EMAIL_DOMAIN}`, role: "RECEPTIONIST", firstName: "Demo", lastName: "Receptionist" },
    { key: "doctor", id: DEMO_IDS.doctor, email: `dentist@${DEMO_EMAIL_DOMAIN}`, role: "DOCTOR", firstName: "Demo", lastName: "Dentist" },
] as const;

const DEMO_SERVICES = [
    { id: "demo-svc-checkup", name: "Check-up and consultation", category: "CONSULTATION", duration: 30, price: 150, description: "Sample service for demonstration." },
    { id: "demo-svc-scale", name: "Scale and polish", category: "GENERAL", duration: 45, price: 250, description: "Sample service for demonstration." },
    { id: "demo-svc-filling", name: "Tooth filling", category: "RESTORATIVE", duration: 45, price: 300, description: "Sample service for demonstration." },
    { id: "demo-svc-xray", name: "Dental X-ray", category: "GENERAL", duration: 15, price: 120, description: "Sample service for demonstration." },
] as const;

// ── Readiness (read-only) ─────────────────────────────────────────────────────

export interface ReadinessCheck {
    name: string;
    ok: boolean;
    detail: string;
}

export interface Readiness {
    ok: boolean;
    checks: ReadinessCheck[];
}

/** Reports whether a live demo can run. Writes nothing and never includes a credential or a full phone number. */
export async function demoReadiness(prisma: PrismaClient, env: Env, migrationsDir?: string): Promise<Readiness> {
    const checks: ReadinessCheck[] = [];
    const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

    add("DEMO_MODE", env.DEMO_MODE?.trim().toLowerCase() === "true", env.DEMO_MODE?.trim().toLowerCase() === "true" ? "on" : "must be true on the demonstration instance");

    const sms = readSmsConfig(env);
    add("SMS provider", sms.provider === "mnotify" && sms.problem === null, sms.provider === "mnotify" && !sms.problem ? "mNotify configured (credentials present)" : `not ready: ${sms.problem ?? "no provider"}`);
    add("SMS allowlist", sms.demoAllowlist.length > 0, `${sms.demoAllowlist.length} approved number(s)`);

    const phone = normalizePhone(env.DEMO_PATIENT_PHONE);
    add("demo patient phone", phone.ok, phone.ok ? `set (${maskPhone(phone.e164)})` : "DEMO_PATIENT_PHONE is missing or not a valid number");
    add("demo phone is approved for SMS", phone.ok && sms.demoAllowlist.includes(phone.e164), phone.ok && sms.demoAllowlist.includes(phone.e164) ? "on the allowlist" : "must also be listed in DEMO_SMS_ALLOWLIST");

    const firebase = ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_APP_ID"].filter((k) => !env[k]?.trim());
    add("Firebase web configuration", firebase.length === 0, firebase.length === 0 ? "present (the Phone Auth provider, authorised domain and test number are console settings and cannot be checked here)" : `missing: ${firebase.join(", ")}`);

    const clinicId = env.CLINIC_ID?.trim();
    add("CLINIC_ID", Boolean(clinicId), clinicId ? "set" : "missing");

    try {
        if (migrationsDir) await assertMigrationsApplied(prisma, migrationsDir);
        add("migrations", true, migrationsDir ? "all applied" : "not checked");
    } catch (error) {
        add("migrations", false, error instanceof ProvisionError ? error.message : "could not be checked");
    }

    try {
        const tenants: Array<{ id: string; status: string }> = await prisma.tenant.findMany({ select: { id: true, status: true }, take: 3 });
        add("exactly one clinic", tenants.length === 1, `${tenants.length} clinic row(s)`);
        add("clinic matches CLINIC_ID", tenants.length === 1 && tenants[0].id === clinicId, tenants.length === 1 && tenants[0].id === clinicId ? "yes" : "no");
        add("clinic is active", tenants.length === 1 && tenants[0].status === "ACTIVE", tenants[0]?.status ?? "no clinic");

        if (clinicId) {
            const users: Array<{ id: string; status: string; roles: Array<{ systemRole: string | null }> }> = await prisma.user.findMany({
                where: { id: { in: DEMO_STAFF.map((s) => s.id) }, tenantId: clinicId },
                select: { id: true, status: true, roles: { select: { systemRole: true } } },
            });
            for (const s of DEMO_STAFF) {
                const u = users.find((x) => x.id === s.id);
                add(`${s.key} account`, Boolean(u && u.status === "ACTIVE" && u.roles.some((r) => r.systemRole === s.role)), u ? (u.status === "ACTIVE" ? "present and active" : `status ${u.status}`) : "not created yet");
            }
            const patient = await prisma.patient.findFirst({ where: { id: DEMO_IDS.patient, tenantId: clinicId, deletedAt: null }, select: { phone: true } });
            add("demo patient", Boolean(patient), patient ? `present (${maskPhone(patient.phone)})` : "not created yet");
            add("demo patient phone matches DEMO_PATIENT_PHONE", Boolean(patient && phone.ok && patient.phone === phone.e164), patient && phone.ok && patient.phone === phone.e164 ? "yes" : "no");
            const [services, plans, invoices, upcoming, settings] = await Promise.all([
                prisma.service.count({ where: { tenantId: clinicId, id: { startsWith: "demo-svc-" }, isActive: true } }),
                prisma.treatmentPlan.count({ where: { tenantId: clinicId, id: DEMO_IDS.plan } }),
                prisma.invoice.count({ where: { tenantId: clinicId, id: DEMO_IDS.invoice } }),
                prisma.appointment.count({ where: { tenantId: clinicId, id: DEMO_IDS.nextAppointment } }),
                prisma.tenantSettings.findUnique({ where: { tenantId: clinicId }, select: { featureFlags: true } }),
            ]);
            add("demo services", services === DEMO_SERVICES.length, `${services} of ${DEMO_SERVICES.length}`);
            add("demo records", plans === 1 && invoices === 1 && upcoming === 1, `treatment plan ${plans}, invoice ${invoices}, upcoming appointment ${upcoming}`);
            const flags = (settings?.featureFlags ?? {}) as Record<string, unknown>;
            add("clinic SMS reminders switch", flags.enableSmsReminders !== false && smsAvailable(env), flags.enableSmsReminders === false ? "switched off by the clinic" : smsAvailable(env) ? "on" : "no usable SMS provider");
        }
    } catch (error) {
        add("database", false, error instanceof Error ? `could not be read (${error.name})` : "could not be read");
    }

    return { ok: checks.every((c) => c.ok), checks };
}

// ── Apply ─────────────────────────────────────────────────────────────────────

export interface DemoOptions {
    prisma: PrismaClient;
    env: Env;
    /** The clinic id typed back by the operator. Must equal CLINIC_ID and the clinic in the database. */
    confirmClinic: string | undefined;
    /** File (outside the repository, must not exist) that receives NEW staff passwords. */
    credentialsOut?: string;
    /** Generate new passwords for the existing demo staff too. */
    rotatePasswords?: boolean;
    migrationsDir?: string;
    now?: Date;
    repoRoot?: string;
}

export interface DemoResult {
    clinicId: string;
    created: Record<string, number>;
    existing: Record<string, number>;
    passwordsWritten: number;
    credentialsFile: string | null;
}

/** 24 random characters that satisfy the app's password policy. */
export function generateDemoPassword(): string {
    for (;;) {
        const raw = crypto.randomBytes(24).toString("base64url").slice(0, 20);
        const candidate = `${raw}-A9a`;
        if (validatePasswordStrength(candidate).valid) return candidate;
    }
}

function assertCredentialsPath(file: string | undefined, repoRoot: string) {
    if (!file) return;
    const resolved = path.resolve(file);
    if (resolved === repoRoot || resolved.startsWith(repoRoot + path.sep)) {
        throw new DemoError("CREDENTIALS_FILE_INVALID", "The credentials file must be OUTSIDE the repository.");
    }
    if (fs.existsSync(resolved)) throw new DemoError("CREDENTIALS_FILE_INVALID", "The credentials file already exists; choose a new path (nothing is overwritten).");
    if (!fs.existsSync(path.dirname(resolved))) throw new DemoError("CREDENTIALS_FILE_INVALID", "The credentials file's folder does not exist.");
}

export async function provisionDemo(opts: DemoOptions): Promise<DemoResult> {
    const { prisma, env } = opts;
    const now = opts.now ?? new Date();
    const repoRoot = opts.repoRoot ?? path.resolve(__dirname, "../../..");

    if (env.DEMO_MODE?.trim().toLowerCase() !== "true") {
        throw new DemoError("NOT_DEMO_MODE", "Refusing: DEMO_MODE is not true. This command only runs on a demonstration instance.");
    }
    const clinicId = env.CLINIC_ID?.trim();
    if (!clinicId || opts.confirmClinic !== clinicId) {
        throw new DemoError("CONFIRMATION_REQUIRED", "Refusing: pass --confirm-clinic <id> with the exact CLINIC_ID of the clinic you intend to fill with synthetic data.");
    }
    const phone = normalizePhone(env.DEMO_PATIENT_PHONE);
    if (!phone.ok) throw new DemoError("PHONE_REQUIRED", "DEMO_PATIENT_PHONE is required (the controlled phone that will receive reminders and sign in as the demo patient).");
    if (!parseAllowlist(env.DEMO_SMS_ALLOWLIST).includes(phone.e164)) {
        throw new DemoError("PHONE_NOT_ALLOWLISTED", "DEMO_PATIENT_PHONE must also be listed in DEMO_SMS_ALLOWLIST, or its reminders would be blocked.");
    }
    assertCredentialsPath(opts.credentialsOut, repoRoot);
    if (opts.migrationsDir) await assertMigrationsApplied(prisma, opts.migrationsDir);

    const tenants: Array<{ id: string; timezone: string | null; name: string }> = await prisma.tenant.findMany({ select: { id: true, timezone: true, name: true }, take: 3 });
    if (tenants.length === 0) throw new DemoError("CLINIC_MISSING", "No clinic exists. Run `npm run clinic:provision` first.");
    if (tenants.length > 1) throw new DemoError("SECOND_CLINIC", "More than one clinic exists in this database; refusing.");
    if (tenants[0].id !== clinicId) throw new DemoError("CLINIC_MISSING", "The clinic in the database is not the CLINIC_ID you confirmed.");
    const zone = clinicTimeZone(tenants[0].timezone);

    // Passwords are shown only in the credentials file, so decide BEFORE writing anything: if new passwords
    // will be generated there must be a valid file to receive them (never half-provision and lose them).
    const haveStaff: Array<{ id: string }> = await prisma.user.findMany({ where: { id: { in: DEMO_STAFF.map((x) => x.id) } }, select: { id: true } });
    if ((haveStaff.length < DEMO_STAFF.length || opts.rotatePasswords) && !opts.credentialsOut) {
        throw new DemoError("CREDENTIALS_FILE_INVALID", "New staff passwords will be generated: pass --credentials-out <a new file outside the repository> to receive them. Nothing was changed.");
    }

    const created: Record<string, number> = {};
    const existing: Record<string, number> = {};
    const count = (map: Record<string, number>, key: string) => { map[key] = (map[key] ?? 0) + 1; };
    const newPasswords: Array<{ email: string; role: string; password: string }> = [];

    // The transaction client is used with a handful of dynamic, JSON-valued upserts; a structural `any` keeps this
    // synthetic-data module readable. Every record it writes is covered by the database-backed tests.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
        // One run at a time.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('demo-provision'))`;

        // ── staff ──
        const staffIds: Record<string, string> = {};
        for (const s of DEMO_STAFF) {
            const found = await tx.user.findUnique({ where: { id: s.id }, select: { id: true, tenantId: true, email: true } });
            const byEmail = await tx.user.findUnique({ where: { email: s.email }, select: { id: true } });
            if (byEmail && byEmail.id !== s.id) throw new DemoError("REAL_RECORD_COLLISION", `A different account already uses ${s.email}; refusing to touch it.`);
            if (found && found.tenantId !== clinicId) throw new DemoError("REAL_RECORD_COLLISION", `${s.id} belongs to another clinic; refusing.`);
            if (!found) {
                const password = generateDemoPassword();
                await tx.user.create({
                    data: { id: s.id, tenantId: clinicId, email: s.email, passwordHash: await bcrypt.hash(password, 12), firstName: s.firstName, lastName: s.lastName, status: "ACTIVE", roles: { create: { systemRole: s.role } } },
                });
                newPasswords.push({ email: s.email, role: s.role, password });
                count(created, "staff");
            } else {
                const patch: Record<string, unknown> = { status: "ACTIVE", deletedAt: null };
                if (opts.rotatePasswords) {
                    const password = generateDemoPassword();
                    patch.passwordHash = await bcrypt.hash(password, 12);
                    newPasswords.push({ email: s.email, role: s.role, password });
                }
                await tx.user.update({ where: { id: s.id }, data: patch });
                const hasRole = await tx.userRoleMapping.findFirst({ where: { userId: s.id, systemRole: s.role }, select: { id: true } });
                if (!hasRole) await tx.userRoleMapping.create({ data: { userId: s.id, systemRole: s.role } });
                count(existing, "staff");
            }
            staffIds[s.key] = s.id;
        }

        // ── clinic settings: SMS reminders on (merged: nothing else is changed) ──
        const settings = await tx.tenantSettings.findUnique({ where: { tenantId: clinicId }, select: { featureFlags: true } });
        const flags = mergeFeatureFlags(settings?.featureFlags, { smsReminders: true });
        await tx.tenantSettings.upsert({ where: { tenantId: clinicId }, create: { tenantId: clinicId, featureFlags: flags }, update: { featureFlags: flags } });

        // ── services ──
        for (const svc of DEMO_SERVICES) {
            const found = await tx.service.findUnique({ where: { id: svc.id }, select: { id: true, tenantId: true } });
            if (found && found.tenantId !== clinicId) throw new DemoError("REAL_RECORD_COLLISION", `${svc.id} belongs to another clinic; refusing.`);
            await tx.service.upsert({
                where: { id: svc.id },
                create: { id: svc.id, tenantId: clinicId, name: svc.name, description: svc.description, category: svc.category, duration: svc.duration, price: svc.price, isActive: true },
                update: { name: svc.name, description: svc.description, category: svc.category, duration: svc.duration, price: svc.price, isActive: true },
            });
            count(found ? existing : created, "services");
        }

        // ── the demo patient ──
        const clash = await tx.patient.findFirst({ where: { tenantId: clinicId, phone: phone.e164, NOT: { id: DEMO_IDS.patient } }, select: { id: true } });
        if (clash) throw new DemoError("REAL_RECORD_COLLISION", "A real patient already has DEMO_PATIENT_PHONE; choose a different controlled phone.");
        const patientFound = await tx.patient.findUnique({ where: { id: DEMO_IDS.patient }, select: { id: true, tenantId: true } });
        if (patientFound && patientFound.tenantId !== clinicId) throw new DemoError("REAL_RECORD_COLLISION", "The demo patient id belongs to another clinic; refusing.");
        await tx.patient.upsert({
            where: { id: DEMO_IDS.patient },
            create: { id: DEMO_IDS.patient, tenantId: clinicId, phone: phone.e164, firstName: "Ama", lastName: "Demo-Patient", gender: "Female", isVerified: true, medicalNotes: "SYNTHETIC DEMO DATA - not a real patient.", allergies: "None recorded (sample)" },
            update: { phone: phone.e164, deletedAt: null, isVerified: true },
        });
        count(patientFound ? existing : created, "patient");

        // ── a completed past visit with a prescription and a paid invoice (portal-visible history) ──
        const ymd = (offsetDays: number) => new Date(now.getTime() + offsetDays * 86_400_000).toISOString().slice(0, 10);
        const past = zonedWallTimeToUtc(ymd(-1), "10:00", zone)!;
        const next = zonedWallTimeToUtc(ymd(1), "10:00", zone)!;
        const checkup = DEMO_SERVICES[0];

        const pastFound = await tx.appointment.findUnique({ where: { id: DEMO_IDS.pastAppointment }, select: { id: true } });
        if (!pastFound) {
            await tx.appointment.create({
                data: {
                    id: DEMO_IDS.pastAppointment, tenantId: clinicId, patientId: DEMO_IDS.patient, doctorId: staffIds.doctor, serviceId: checkup.id,
                    dateTime: past, endTime: new Date(past.getTime() + checkup.duration * 60_000), status: "COMPLETED", completedAt: new Date(past.getTime() + 40 * 60_000),
                    notes: "SYNTHETIC DEMO DATA: routine check-up, no concerns.",
                    transitions: { create: { fromStatus: "IN_CHAIR", toStatus: "COMPLETED", triggeredBy: staffIds.doctor, reason: "Synthetic demo visit" } },
                },
            });
            await tx.prescription.create({
                data: { id: DEMO_IDS.prescription, tenantId: clinicId, patientId: DEMO_IDS.patient, appointmentId: DEMO_IDS.pastAppointment, doctorId: staffIds.doctor, status: "FILLED", medications: [{ name: "Paracetamol 500mg (sample)", dosage: "1 tablet", frequency: "3 times a day", duration: "3 days", notes: "Synthetic demo prescription" }], instructions: "Sample instructions for demonstration only." },
            });
            await tx.invoice.create({
                data: {
                    id: DEMO_IDS.invoice, tenantId: clinicId, patientId: DEMO_IDS.patient, appointmentId: DEMO_IDS.pastAppointment, createdById: staffIds.doctor,
                    amount: checkup.price, tax: 0, discount: 0, totalAmount: checkup.price, status: "PAID", paidAt: new Date(past.getTime() + 60 * 60_000), paymentMethod: "CASH",
                    notes: "SYNTHETIC DEMO DATA. Manual/cash payment recorded by staff (not independently verified).",
                    items: [{ serviceId: checkup.id, serviceName: checkup.name, price: checkup.price, quantity: 1 }],
                },
            });
            count(created, "visit");
        } else count(existing, "visit");

        // ── an upcoming appointment WITHOUT reminders: the live demo books its own, so seeding never sends an SMS ──
        const nextFound = await tx.appointment.findUnique({ where: { id: DEMO_IDS.nextAppointment }, select: { id: true } });
        if (!nextFound) {
            await tx.appointment.create({
                data: {
                    id: DEMO_IDS.nextAppointment, tenantId: clinicId, patientId: DEMO_IDS.patient, doctorId: staffIds.doctor, serviceId: DEMO_SERVICES[1].id,
                    dateTime: next, endTime: new Date(next.getTime() + DEMO_SERVICES[1].duration * 60_000), status: "SCHEDULED", notes: "SYNTHETIC DEMO DATA",
                    transitions: { create: { fromStatus: "SCHEDULED", toStatus: "SCHEDULED", triggeredBy: staffIds.receptionist, reason: "Synthetic demo booking" } },
                },
            });
            count(created, "upcoming appointment");
        } else count(existing, "upcoming appointment");

        // ── treatment plan with three steps (the first completed at the past visit) ──
        const planFound = await tx.treatmentPlan.findUnique({ where: { id: DEMO_IDS.plan }, select: { id: true } });
        if (!planFound) {
            await tx.treatmentPlan.create({
                data: {
                    id: DEMO_IDS.plan, tenantId: clinicId, patientId: DEMO_IDS.patient, doctorId: staffIds.doctor, title: "Restorative care plan (sample)", description: "SYNTHETIC DEMO DATA", status: "ACTIVE", totalCost: 550,
                    steps: { create: [
                        { id: "demo-step-1", stepNumber: 1, title: "Examination and X-ray", status: "COMPLETED", estimatedCost: 150, completedAt: new Date(past.getTime() + 40 * 60_000), appointmentId: DEMO_IDS.pastAppointment },
                        { id: "demo-step-2", stepNumber: 2, title: "Scale and polish", status: "PENDING", estimatedCost: 250 },
                        { id: "demo-step-3", stepNumber: 3, title: "Filling, upper right molar", status: "PENDING", estimatedCost: 150 },
                    ] },
                },
            });
            count(created, "treatment plan");
        } else count(existing, "treatment plan");

        // ── a little dental chart ──
        for (const [tooth, condition] of [[16, "Caries (sample)"], [26, "Healthy (sample)"]] as const) {
            const hit = await tx.toothRecord.findFirst({ where: { tenantId: clinicId, patientId: DEMO_IDS.patient, toothNumber: tooth }, select: { id: true } });
            if (!hit) {
                await tx.toothRecord.create({ data: { tenantId: clinicId, patientId: DEMO_IDS.patient, toothNumber: tooth, conditions: [{ type: condition, date: past.toISOString() }], treatments: [], notes: "SYNTHETIC DEMO DATA" } });
                count(created, "chart entries");
            } else count(existing, "chart entries");
        }

        await tx.systemConfig.upsert({ where: { key: "demo:provision" }, create: { key: "demo:provision", value: { version: DEMO_VERSION, at: now.toISOString() } }, update: { value: { version: DEMO_VERSION, at: now.toISOString() } } });
        await tx.auditLog.create({
            data: { tenantId: clinicId, userId: null, action: "DEMO_PROVISIONED", entity: "Tenant", entityId: clinicId, newValue: { version: DEMO_VERSION, created, existing, passwordsGenerated: newPasswords.length } },
        });
    }, { timeout: 120_000 });

    // Credentials go to a private file only, written AFTER the data is committed.
    let credentialsFile: string | null = null;
    if (newPasswords.length > 0) {
        const resolved = path.resolve(opts.credentialsOut!); // guaranteed present by the check above
        const body = [
            "SYNTHETIC DEMO ACCOUNTS - keep private, delete after the demonstration.",
            `Clinic: ${clinicId}`,
            "",
            ...newPasswords.map((p) => `${p.role.padEnd(13)} ${p.email}   password: ${p.password}`),
            "",
            "Existing demo accounts keep their previous passwords unless listed above.",
            `Demo patient signs in with the phone number set in DEMO_PATIENT_PHONE (${maskPhone(phone.e164)}).`,
            "",
        ].join("\n");
        fs.writeFileSync(resolved, body, { mode: 0o600, flag: "wx" });
        credentialsFile = resolved;
    }

    return { clinicId, created, existing, passwordsWritten: newPasswords.length, credentialsFile };
}
