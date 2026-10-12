// ============================================
// NEXUS DENTAL — Single-clinic provisioning
//
// Turns an EMPTY, already-migrated database into exactly one configured clinic,
// idempotently. Driven by `npm run clinic:provision` (scripts/clinic-provision.ts);
// the database client is injected so the same code runs in tests.
//
// What is authoritative where
//   manifest -> identity (id, slug, name, timezone) and the enabled feature flags.
//   everything else (contact details, branding, hours, content, services,
//   consent wording) is an INITIAL value, applied only when missing. A clinic
//   edits those in the app afterwards, and re-running provisioning never
//   overwrites them.
//
// Safety properties
//   * never prints or returns a secret; the owner invitation link goes only to
//     the owner's inbox or to a 0600 file outside the repo — never to the console
//   * refuses production unless the clinic id is typed back as confirmation
//   * refuses a database that holds a different clinic ("exactly one")
//   * refuses a database whose migrations are not all applied
//   * serialised by an advisory lock, so concurrent runs cannot duplicate rows
// ============================================

import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { Prisma, PrismaClient } from "@prisma/client";
import { generateInviteToken, hashInviteToken } from "../auth/invite-token";
import { DEFAULT_CONSENT_TEMPLATES } from "./default-consents";
import type { Env } from "./deployment";
import type { ClinicManifest } from "./manifest";
import {
    FEATURE_NAMES,
    formatProblems,
    parseEnabledFeatures,
    validateRuntimeConfig,
    type ConfigProblem,
} from "./validate";

// ── Errors ────────────────────────────────────────────────────────────────────

export type ProvisionErrorCode =
    | "PRODUCTION_CONFIRMATION_REQUIRED"
    | "CONFIG_INVALID"
    | "INVITE_DELIVERY_INVALID"
    | "INVITE_DELIVERY_FAILED"
    | "MIGRATIONS_NOT_APPLIED"
    | "SECOND_CLINIC_REFUSED"
    | "SLUG_IMMUTABLE"
    | "OWNER_EMAIL_IN_USE";

export class ProvisionError extends Error {
    readonly code: ProvisionErrorCode;
    readonly problems: ConfigProblem[];
    constructor(code: ProvisionErrorCode, message: string, problems: ConfigProblem[] = []) {
        super(message);
        this.name = "ProvisionError";
        this.code = code;
        this.problems = problems;
    }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type OwnerInviteDelivery = { type: "email" } | { type: "file"; path: string } | { type: "skip" };

export interface ProvisionOptions {
    prisma: PrismaClient;
    manifest: ClinicManifest;
    /** Process environment. Must NOT be loaded from the repo's .env (see docs). */
    env: Env;
    /** Directory holding prisma/migrations. */
    migrationsDir: string;
    ownerInvite: OwnerInviteDelivery;
    /** Must equal the clinic id to run against production. */
    confirmProduction?: string;
    /** Validate and report only; write nothing. */
    checkOnly?: boolean;
    /** Replace a pending owner invitation with a fresh one. */
    reissueInvite?: boolean;
    /** Invitation files may not be written inside this directory (default: cwd). */
    repoRoot?: string;
    deps?: {
        sendEmail?: (message: { to: string; subject: string; html: string }) => Promise<void>;
        now?: () => Date;
    };
}

export type OwnerOutcome =
    | "exists"
    | "invite_pending"
    | "invite_issued"
    | "invite_reissued"
    | "invite_skipped"
    | "would_issue_invite";

export interface ProvisionResult {
    mode: "check" | "apply";
    clinicId: string;
    slug: string;
    environment: string;
    /** host[:port]/database — never credentials. */
    database: string;
    tenant: "created" | "updated" | "unchanged" | "would_create" | "exists";
    settings: "created" | "updated" | "unchanged" | "not_checked";
    content: "created" | "unchanged" | "not_checked";
    consentTemplates: { created: number; existing: number };
    services: { created: number; existing: number };
    owner: OwnerOutcome;
    inviteExpiresAt?: string;
    inviteDelivery?: "email" | "file";
    nextSteps: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Inactive, unloggable account that exists only so invitations and audit rows
 * have an actor (StaffInvite.invitedById is a required foreign key and a brand
 * new clinic has no users yet). It belongs to no clinic, so it never appears in
 * a clinic's staff list.
 */
export const PROVISIONER_USER_ID = "system-provisioner";
const PROVISIONER_EMAIL = "provisioner@system.invalid";
const LOCK_KEY = "nexus-clinic-provision";

const DEFAULT_HOURS = {
    monday: { open: "08:00", close: "17:00", isOpen: true },
    tuesday: { open: "08:00", close: "17:00", isOpen: true },
    wednesday: { open: "08:00", close: "17:00", isOpen: true },
    thursday: { open: "08:00", close: "17:00", isOpen: true },
    friday: { open: "08:00", close: "17:00", isOpen: true },
    saturday: { open: "09:00", close: "13:00", isOpen: false },
    sunday: { open: "09:00", close: "13:00", isOpen: false },
};

const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 } as const;

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** "host[:port]/database" for display. Never includes user or password. */
export function describeDatabase(databaseUrl: string | undefined): string {
    if (!databaseUrl) return "(unknown)";
    try {
        const url = new URL(databaseUrl);
        const host = url.host || "local-socket";
        return `${host}${url.pathname}`;
    } catch {
        return "(unparseable)";
    }
}

function normaliseUrl(value: string | undefined): string {
    return (value ?? "").trim().replace(/\/+$/, "").toLowerCase();
}

/**
 * Cross-check the process environment against the manifest, so a deployment
 * cannot be configured for one clinic and provisioned as another. Problems name
 * variables only — never values.
 */
export function crossCheckManifestAgainstEnv(manifest: ClinicManifest, env: Env): ConfigProblem[] {
    const problems: ConfigProblem[] = [];
    const mismatch = (variable: string, field: string) =>
        problems.push({ variable, kind: "invalid", message: `does not match the manifest (${field})` });

    problems.push(...validateRuntimeConfig(env).problems);

    if (env.CLINIC_ID?.trim() && env.CLINIC_ID.trim() !== manifest.clinic.id) mismatch("CLINIC_ID", "clinic.id");
    if (env.NEXT_PUBLIC_APP_URL?.trim() && normaliseUrl(env.NEXT_PUBLIC_APP_URL) !== normaliseUrl(manifest.deployment.appUrl)) {
        mismatch("NEXT_PUBLIC_APP_URL", "deployment.appUrl");
    }
    if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.trim() !== manifest.infrastructure.firebaseProjectId) {
        mismatch("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "infrastructure.firebaseProjectId");
    }
    if (env.FIREBASE_STORAGE_BUCKET?.trim() && env.FIREBASE_STORAGE_BUCKET.trim() !== manifest.infrastructure.storageBucket) {
        mismatch("FIREBASE_STORAGE_BUCKET", "infrastructure.storageBucket");
    }

    const envFeatures = new Set(parseEnabledFeatures(env.ENABLED_FEATURES).features);
    const manifestFeatures = new Set(manifest.features);
    const sameFeatures = envFeatures.size === manifestFeatures.size && [...envFeatures].every((f) => manifestFeatures.has(f));
    if (!sameFeatures) mismatch("ENABLED_FEATURES", "features");

    return problems;
}

function isProductionRun(manifest: ClinicManifest, env: Env): boolean {
    return manifest.deployment.environment === "production" || env.NODE_ENV === "production";
}

// ── Migration check ───────────────────────────────────────────────────────────

/** Postgres "undefined_table" (42P01), however the driver layer wraps it. */
function isMissingRelation(error: unknown): boolean {
    const seen = new Set<unknown>();
    let current: unknown = error;
    while (current && typeof current === "object" && !seen.has(current)) {
        seen.add(current);
        const e = current as { code?: unknown; originalCode?: unknown; meta?: { code?: unknown }; cause?: unknown };
        if (e.code === "42P01" || e.originalCode === "42P01" || e.meta?.code === "42P01") return true;
        current = e.cause;
    }
    const message = error instanceof Error ? error.message : "";
    return /relation "?_prisma_migrations"? does not exist|42P01/.test(message);
}

export async function assertMigrationsApplied(prisma: PrismaClient, migrationsDir: string): Promise<void> {
    const expected = fs
        .readdirSync(migrationsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && fs.existsSync(path.join(migrationsDir, d.name, "migration.sql")))
        .map((d) => d.name)
        .sort();

    let rows: { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[];
    try {
        rows = await prisma.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;
    } catch (error) {
        // Only a genuinely missing table means "never migrated". Anything else
        // (unreachable server, bad credentials, …) is a different problem and must
        // not be misreported as one — rethrow so the CLI shows a generic failure.
        if (isMissingRelation(error)) {
            throw new ProvisionError(
                "MIGRATIONS_NOT_APPLIED",
                "The database has no migration history. Run `npx prisma migrate deploy` first, then provision."
            );
        }
        throw error;
    }

    const applied = new Set(rows.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name));
    const pending = expected.filter((name) => !applied.has(name));
    if (pending.length > 0) {
        throw new ProvisionError(
            "MIGRATIONS_NOT_APPLIED",
            `${pending.length} migration(s) in this release are not applied (first: ${pending[0]}). Run \`npx prisma migrate deploy\` first.`
        );
    }
    const unknown = [...applied].filter((name) => !expected.includes(name));
    if (unknown.length > 0) {
        throw new ProvisionError(
            "MIGRATIONS_NOT_APPLIED",
            `The database is ahead of this release (${unknown.length} migration(s) it does not contain). Provision with the release that matches the database.`
        );
    }
}

// ── Invite delivery (validated before any write) ──────────────────────────────

function validateInviteDelivery(delivery: OwnerInviteDelivery, env: Env, repoRoot: string): void {
    if (delivery.type === "email") {
        const problems: ConfigProblem[] = [];
        if (!env.RESEND_API_KEY?.trim()) problems.push({ variable: "RESEND_API_KEY", kind: "missing", message: "required to email the owner invitation" });
        if (!env.EMAIL_FROM?.trim()) problems.push({ variable: "EMAIL_FROM", kind: "missing", message: "required to email the owner invitation" });
        if (problems.length > 0) {
            throw new ProvisionError(
                "INVITE_DELIVERY_INVALID",
                `Cannot email the owner invitation — ${formatProblems(problems)}. Configure them, or use --invite-out <file>.`,
                problems
            );
        }
    }

    if (delivery.type === "file") {
        const target = path.resolve(delivery.path);
        const rel = path.relative(path.resolve(repoRoot), target);
        if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
            throw new ProvisionError(
                "INVITE_DELIVERY_INVALID",
                "--invite-out must point OUTSIDE the repository, so the invitation link can never be committed."
            );
        }
        if (!fs.existsSync(path.dirname(target))) {
            throw new ProvisionError("INVITE_DELIVERY_INVALID", "--invite-out directory does not exist.");
        }
        if (fs.existsSync(target)) {
            throw new ProvisionError("INVITE_DELIVERY_INVALID", "--invite-out file already exists; it is never overwritten.");
        }
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function provisionClinic(opts: ProvisionOptions): Promise<ProvisionResult> {
    const { prisma, manifest, env } = opts;
    const now = opts.deps?.now ?? (() => new Date());
    const clinicId = manifest.clinic.id;
    const apply = !opts.checkOnly;

    // 1. Production gate — before anything else, including config checks.
    if (isProductionRun(manifest, env) && opts.confirmProduction !== clinicId) {
        throw new ProvisionError(
            "PRODUCTION_CONFIRMATION_REQUIRED",
            `This is a production run. Re-run with --confirm-production ${clinicId} to proceed.`
        );
    }

    // 2. Configuration must be complete and agree with the manifest.
    const configProblems = crossCheckManifestAgainstEnv(manifest, env);
    if (configProblems.length > 0) {
        throw new ProvisionError("CONFIG_INVALID", `Configuration is not ready — ${formatProblems(configProblems)}`, configProblems);
    }

    // 3. Invitation delivery must be usable BEFORE anything is written.
    if (apply) validateInviteDelivery(opts.ownerInvite, env, opts.repoRoot ?? process.cwd());

    // 4. Schema must be fully migrated.
    await assertMigrationsApplied(prisma, opts.migrationsDir);

    // 5. Exactly one clinic — and it must be this one.
    const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
    const foreign = tenants.filter((t) => t.id !== clinicId);
    if (foreign.length > 0) {
        throw new ProvisionError(
            "SECOND_CLINIC_REFUSED",
            `This database already contains a different clinic (${foreign.length} found). A clinic deployment holds exactly one clinic; use a separate database.`
        );
    }
    const existingTenant = tenants.find((t) => t.id === clinicId);
    if (existingTenant && existingTenant.slug !== manifest.clinic.slug) {
        throw new ProvisionError(
            "SLUG_IMMUTABLE",
            "The existing clinic has a different slug. The slug is part of the clinic's identity and cannot be changed by provisioning."
        );
    }

    const base = {
        clinicId,
        slug: manifest.clinic.slug,
        environment: manifest.deployment.environment,
        database: describeDatabase(env.DATABASE_URL),
    };

    // Check-only: report what apply would do, write nothing.
    if (!apply) {
        const owner = await prisma.user.findFirst({
            where: { tenantId: clinicId, roles: { some: { systemRole: "CLINIC_OWNER" } } },
            select: { id: true },
        });
        return {
            mode: "check",
            ...base,
            tenant: existingTenant ? "exists" : "would_create",
            settings: "not_checked",
            content: "not_checked",
            consentTemplates: { created: 0, existing: 0 },
            services: { created: 0, existing: 0 },
            owner: owner ? "exists" : "would_issue_invite",
            nextSteps: ["Configuration, migrations and clinic identity are valid. Re-run without --check to provision."],
        };
    }

    // 6. Clinic, settings, content, templates, services — one transaction.
    const core = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`;

        // Re-check identity now that we hold the lock (another run may have just finished).
        const lockedTenants = await tx.tenant.findMany({ select: { id: true } });
        if (lockedTenants.some((t) => t.id !== clinicId)) {
            throw new ProvisionError("SECOND_CLINIC_REFUSED", "This database already contains a different clinic.");
        }

        const changes: string[] = [];

        // Actor for audit rows and invitations.
        const provisioner = await tx.user.findUnique({ where: { id: PROVISIONER_USER_ID }, select: { id: true } });
        if (!provisioner) {
            await tx.user.create({
                data: {
                    id: PROVISIONER_USER_ID,
                    email: PROVISIONER_EMAIL,
                    // A real bcrypt hash of random bytes nobody holds: the account cannot be signed into.
                    passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
                    firstName: "Nexus",
                    lastName: "Provisioning",
                    status: "INACTIVE",
                    tenantId: null,
                },
            });
        }

        // Clinic
        const c = manifest.clinic;
        let tenantOutcome: ProvisionResult["tenant"];
        const current = await tx.tenant.findUnique({ where: { id: clinicId } });
        if (!current) {
            await tx.tenant.create({
                data: {
                    id: clinicId,
                    slug: c.slug,
                    name: c.name,
                    status: "ACTIVE",
                    timezone: c.timezone,
                    email: c.email ?? null,
                    phone: c.phone ?? null,
                    address: c.address ?? null,
                    website: c.website ?? null,
                    logo: manifest.branding?.logoUrl ?? null,
                },
            });
            tenantOutcome = "created";
            changes.push("tenant");
        } else {
            const update: Prisma.TenantUpdateInput = {};
            if (current.name !== c.name) update.name = c.name;
            if (current.timezone !== c.timezone) update.timezone = c.timezone;
            // Optional details are initial values: fill gaps, never overwrite.
            if (!current.email && c.email) update.email = c.email;
            if (!current.phone && c.phone) update.phone = c.phone;
            if (!current.address && c.address) update.address = c.address;
            if (!current.website && c.website) update.website = c.website;
            if (!current.logo && manifest.branding?.logoUrl) update.logo = manifest.branding.logoUrl;
            if (Object.keys(update).length > 0) {
                await tx.tenant.update({ where: { id: clinicId }, data: update });
                tenantOutcome = "updated";
                changes.push("tenant");
            } else {
                tenantOutcome = "unchanged";
            }
        }

        // Settings — feature flags follow the manifest; everything else is created once.
        const desiredFlags = Object.fromEntries(FEATURE_NAMES.map((f) => [f, manifest.features.includes(f)]));
        let settingsOutcome: ProvisionResult["settings"];
        const settings = await tx.tenantSettings.findUnique({ where: { tenantId: clinicId } });
        if (!settings) {
            await tx.tenantSettings.create({
                data: {
                    tenantId: clinicId,
                    platformName: c.name,
                    logoUrl: manifest.branding?.logoUrl ?? null,
                    primaryColor: manifest.branding?.primaryColor ?? null,
                    secondaryColor: manifest.branding?.secondaryColor ?? null,
                    hoursOfOperation: (manifest.hours ?? DEFAULT_HOURS) as Prisma.InputJsonValue,
                    featureFlags: desiredFlags as Prisma.InputJsonValue,
                },
            });
            settingsOutcome = "created";
            changes.push("settings");
        } else {
            const existingFlags = (settings.featureFlags && typeof settings.featureFlags === "object" ? settings.featureFlags : {}) as Record<string, unknown>;
            const merged = { ...existingFlags, ...desiredFlags };
            if (JSON.stringify(merged) !== JSON.stringify(existingFlags)) {
                await tx.tenantSettings.update({ where: { tenantId: clinicId }, data: { featureFlags: merged as Prisma.InputJsonValue } });
                settingsOutcome = "updated";
                changes.push("settings");
            } else {
                settingsOutcome = "unchanged";
            }
        }

        // Public content — created once
        let contentOutcome: ProvisionResult["content"];
        const content = await tx.tenantContent.findUnique({ where: { tenantId: clinicId } });
        if (!content) {
            await tx.tenantContent.create({
                data: {
                    tenantId: clinicId,
                    aboutPage: manifest.content?.about ?? `Welcome to ${c.name}. We are committed to providing exceptional dental care.`,
                    mission: manifest.content?.mission ?? null,
                    vision: manifest.content?.vision ?? null,
                    logoUrl: manifest.branding?.logoUrl ?? null,
                    ...(manifest.branding?.primaryColor ? { brandColor: manifest.branding.primaryColor } : {}),
                },
            });
            contentOutcome = "created";
            changes.push("content");
        } else {
            contentOutcome = "unchanged";
        }

        // Default consent templates — created when missing, never overwritten
        const consentTemplates = { created: 0, existing: 0 };
        for (const template of DEFAULT_CONSENT_TEMPLATES) {
            const found = await tx.consentTemplate.findUnique({ where: { id: template.id }, select: { id: true } });
            if (found) {
                consentTemplates.existing++;
            } else {
                await tx.consentTemplate.create({
                    data: { id: template.id, tenantId: null, title: template.title, category: template.category, content: template.content, version: 1, isActive: true },
                });
                consentTemplates.created++;
            }
        }
        if (consentTemplates.created > 0) changes.push("consent templates");

        // Services — created when missing (matched by name), never overwritten
        const services = { created: 0, existing: 0 };
        for (const s of manifest.services) {
            const found = await tx.service.findFirst({ where: { tenantId: clinicId, name: s.name }, select: { id: true } });
            if (found) {
                services.existing++;
            } else {
                await tx.service.create({
                    data: {
                        tenantId: clinicId,
                        name: s.name,
                        description: s.description ?? null,
                        category: s.category,
                        duration: s.durationMinutes,
                        price: s.price,
                        isActive: true,
                    },
                });
                services.created++;
            }
        }
        if (services.created > 0) changes.push("services");

        if (changes.length > 0) {
            await tx.auditLog.create({
                data: {
                    tenantId: clinicId,
                    userId: PROVISIONER_USER_ID,
                    action: tenantOutcome === "created" ? "CLINIC_PROVISIONED" : "CLINIC_RECONCILED",
                    entity: "Tenant",
                    entityId: clinicId,
                    newValue: { changed: changes },
                    ipAddress: "cli",
                    userAgent: "clinic:provision",
                },
            });
        }

        return { tenant: tenantOutcome, settings: settingsOutcome, content: contentOutcome, consentTemplates, services };
    }, TX_OPTIONS);

    // 7. Owner — a separate transaction so a delivery failure leaves nothing half-issued.
    const ownerResult = await issueOwnerInvitation(opts, now);

    const nextSteps = buildNextSteps(ownerResult.outcome, ownerResult.delivery, core.tenant);
    return {
        mode: "apply",
        ...base,
        ...core,
        owner: ownerResult.outcome,
        ...(ownerResult.expiresAt ? { inviteExpiresAt: ownerResult.expiresAt.toISOString() } : {}),
        ...(ownerResult.delivery ? { inviteDelivery: ownerResult.delivery } : {}),
        nextSteps,
    };
}

// ── Owner invitation ──────────────────────────────────────────────────────────

async function issueOwnerInvitation(
    opts: ProvisionOptions,
    now: () => Date
): Promise<{ outcome: OwnerOutcome; expiresAt?: Date; delivery?: "email" | "file" }> {
    const { prisma, manifest, env } = opts;
    const clinicId = manifest.clinic.id;
    const ownerEmail = manifest.owner.email.trim().toLowerCase();
    let writtenFile: string | null = null;

    try {
        return await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`;

            const owner = await tx.user.findFirst({
                where: { tenantId: clinicId, roles: { some: { systemRole: "CLINIC_OWNER" } } },
                select: { id: true },
            });
            if (owner) return { outcome: "exists" as const };

            const emailHolder = await tx.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
            if (emailHolder) {
                throw new ProvisionError(
                    "OWNER_EMAIL_IN_USE",
                    "An account with the owner email already exists but is not this clinic's owner. Use a different owner email."
                );
            }

            const invite = await tx.staffInvite.findUnique({ where: { tenantId_email: { tenantId: clinicId, email: ownerEmail } } });
            const stillValid = !!invite && !invite.acceptedAt && invite.expiresAt > now();
            if (stillValid && !opts.reissueInvite) {
                return { outcome: "invite_pending" as const, expiresAt: invite!.expiresAt };
            }
            if (opts.ownerInvite.type === "skip") {
                return { outcome: "invite_skipped" as const };
            }

            // Issue a fresh single-use token. Only its hash is stored.
            const rawToken = generateInviteToken();
            const expiresAt = new Date(now().getTime() + manifest.owner.inviteExpiryHours * 3_600_000);
            const data = {
                role: "CLINIC_OWNER" as const,
                token: hashInviteToken(rawToken),
                invitedById: PROVISIONER_USER_ID,
                expiresAt,
                acceptedAt: null,
            };
            if (invite) {
                await tx.staffInvite.update({ where: { id: invite.id }, data });
            } else {
                await tx.staffInvite.create({ data: { tenantId: clinicId, email: ownerEmail, ...data } });
            }

            const appUrl = (env.NEXT_PUBLIC_APP_URL ?? manifest.deployment.appUrl).trim().replace(/\/+$/, "");
            const link = `${appUrl}/onboarding/accept?token=${rawToken}`;
            const delivery = await deliverInvitation(opts, { link, expiresAt, ownerEmail }, (p) => (writtenFile = p));

            await tx.auditLog.create({
                data: {
                    tenantId: clinicId,
                    userId: PROVISIONER_USER_ID,
                    action: "OWNER_INVITE_ISSUED",
                    entity: "StaffInvite",
                    entityId: clinicId,
                    // Never the token or link.
                    newValue: { delivery, expiresAt: expiresAt.toISOString(), reissued: !!invite },
                    ipAddress: "cli",
                    userAgent: "clinic:provision",
                },
            });

            return { outcome: (invite ? "invite_reissued" : "invite_issued") as OwnerOutcome, expiresAt, delivery };
        }, TX_OPTIONS);
    } catch (error) {
        // The transaction rolled back, so a link written to disk would now point at nothing.
        if (writtenFile) fs.rmSync(writtenFile, { force: true });
        throw error;
    }
}

async function deliverInvitation(
    opts: ProvisionOptions,
    invite: { link: string; expiresAt: Date; ownerEmail: string },
    onFileWritten: (path: string) => void
): Promise<"email" | "file"> {
    const delivery = opts.ownerInvite;
    const clinicName = opts.manifest.clinic.name;

    if (delivery.type === "file") {
        const target = path.resolve(delivery.path);
        const body = [
            `Nexus Dental — owner invitation for ${clinicName}`,
            "",
            `Open this link to set the owner password. It works once and expires ${invite.expiresAt.toISOString()}.`,
            "",
            invite.link,
            "",
            "Delete this file after use.",
            "",
        ].join("\n");
        try {
            fs.writeFileSync(target, body, { flag: "wx", mode: 0o600 });
        } catch {
            throw new ProvisionError("INVITE_DELIVERY_FAILED", "Could not write the invitation file.");
        }
        onFileWritten(target);
        return "file";
    }

    if (delivery.type === "email") {
        const hours = opts.manifest.owner.inviteExpiryHours;
        try {
            const send = opts.deps?.sendEmail ?? (await import("../email/sender")).sendEmail;
            const { staffInviteEmailHtml } = await import("../email/sender");
            await send({
                to: invite.ownerEmail,
                subject: `Set up ${clinicName} on Nexus Dental`,
                html: staffInviteEmailHtml({
                    clinicName,
                    inviterName: "Nexus Dental setup",
                    role: "CLINIC_OWNER",
                    acceptUrl: invite.link,
                    expiresHours: hours,
                }),
            });
        } catch {
            // Deliberately no error text: provider errors can echo request details.
            throw new ProvisionError("INVITE_DELIVERY_FAILED", "The owner invitation email could not be sent. Nothing was recorded; fix the email configuration and re-run.");
        }
        return "email";
    }

    throw new ProvisionError("INVITE_DELIVERY_INVALID", "No invitation delivery method was selected.");
}

function buildNextSteps(owner: OwnerOutcome, delivery: "email" | "file" | undefined, tenant: ProvisionResult["tenant"]): string[] {
    const steps: string[] = [];
    if (tenant === "created") steps.push("Clinic created. Review the public content, services and hours in the staff dashboard.");
    switch (owner) {
        case "invite_issued":
        case "invite_reissued":
            steps.push(
                delivery === "email"
                    ? "The owner has been emailed a single-use link to set their password."
                    : "Give the owner the single-use link from the invitation file securely, then delete the file."
            );
            break;
        case "invite_pending":
            steps.push("An owner invitation is already pending. Re-run with --reissue-invite to replace it with a new link.");
            break;
        case "invite_skipped":
            steps.push("No owner invitation was issued (--skip-owner-invite). Re-run with --invite-email or --invite-out when ready.");
            break;
        case "exists":
            steps.push("The clinic already has an owner; no invitation is needed.");
            break;
    }
    steps.push("Run the smoke checks in docs/CLINIC_PROVISIONING.md before enabling real data.");
    return steps;
}
