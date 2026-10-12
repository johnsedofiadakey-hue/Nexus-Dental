// ============================================
// NEXUS DENTAL — Clinic manifest
//
// A versioned, NON-SECRET description of one clinic deployment. Secrets (database
// URL, JWT secret, API keys…) never live here — they come from the environment
// or Secret Manager. The schema is strict, so a stray `password:` or `apiKey:`
// key is rejected instead of being silently committed.
// ============================================

import fs from "fs";
import { load as loadYaml } from "js-yaml";
import { z } from "zod";
import { CLINIC_ID_PATTERN, FEATURE_NAMES } from "./validate";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

function isValidTimeZone(value: string): boolean {
    try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
    } catch {
        return false;
    }
}

const dayHours = z
    .object({ open: z.string().regex(HHMM, "must be HH:MM"), close: z.string().regex(HHMM, "must be HH:MM"), isOpen: z.boolean() })
    .strict();

const weekHours = z
    .object({
        monday: dayHours,
        tuesday: dayHours,
        wednesday: dayHours,
        thursday: dayHours,
        friday: dayHours,
        saturday: dayHours,
        sunday: dayHours,
    })
    .strict();

export const SERVICE_CATEGORIES = [
    "GENERAL",
    "COSMETIC",
    "ORTHODONTICS",
    "RESTORATIVE",
    "PEDIATRIC",
    "EMERGENCY",
    "CONSULTATION",
] as const;

const service = z
    .object({
        name: z.string().trim().min(2).max(120),
        category: z.enum(SERVICE_CATEGORIES),
        durationMinutes: z.number().int().min(5).max(480),
        price: z.number().min(0).max(1_000_000),
        description: z.string().trim().max(500).optional(),
    })
    .strict();

export const clinicManifestSchema = z
    .object({
        schemaVersion: z.literal(1),
        clinic: z
            .object({
                /** Immutable. Becomes the tenant primary key and MUST equal CLINIC_ID. */
                id: z.string().regex(CLINIC_ID_PATTERN, "must be 3-64 lowercase letters, digits or hyphens"),
                slug: z
                    .string()
                    .max(63)
                    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase letters, digits and single hyphens"),
                name: z.string().trim().min(2).max(120),
                timezone: z.string().refine(isValidTimeZone, "must be a valid IANA time zone"),
                email: z.email().optional(),
                phone: z.string().regex(/^\+?[0-9 ()-]{7,20}$/, "must look like a phone number").optional(),
                address: z.string().trim().max(300).optional(),
                website: z.url().optional(),
            })
            .strict(),
        deployment: z
            .object({
                environment: z.enum(["development", "rehearsal", "production"]),
                appUrl: z.url(),
            })
            .strict(),
        infrastructure: z
            .object({
                /** Cross-checked against NEXT_PUBLIC_FIREBASE_PROJECT_ID so two clinics can't share a project by accident. */
                firebaseProjectId: z.string().min(1),
                storageBucket: z.string().min(1),
            })
            .strict(),
        features: z.array(z.enum(FEATURE_NAMES)).default([]),
        owner: z
            .object({
                email: z.email(),
                inviteExpiryHours: z.number().int().min(1).max(168).default(72),
            })
            .strict(),
        branding: z
            .object({
                primaryColor: z.string().regex(HEX_COLOUR, "must be a #rrggbb colour"),
                secondaryColor: z.string().regex(HEX_COLOUR, "must be a #rrggbb colour").optional(),
                logoUrl: z.url().optional(),
            })
            .strict()
            .optional(),
        content: z
            .object({
                about: z.string().trim().max(4000).optional(),
                mission: z.string().trim().max(1000).optional(),
                vision: z.string().trim().max(1000).optional(),
            })
            .strict()
            .optional(),
        hours: weekHours.optional(),
        services: z.array(service).max(200).default([]),
    })
    .strict()
    .superRefine((m, ctx) => {
        if (m.deployment.environment === "production" && !m.deployment.appUrl.startsWith("https://")) {
            ctx.addIssue({ code: "custom", path: ["deployment", "appUrl"], message: "must use https in production" });
        }
        const featureSeen = new Set<string>();
        m.features.forEach((f, i) => {
            if (featureSeen.has(f)) ctx.addIssue({ code: "custom", path: ["features", i], message: "duplicate feature" });
            featureSeen.add(f);
        });
        const nameSeen = new Set<string>();
        m.services.forEach((s, i) => {
            const key = s.name.trim().toLowerCase();
            if (nameSeen.has(key)) ctx.addIssue({ code: "custom", path: ["services", i, "name"], message: "duplicate service name" });
            nameSeen.add(key);
        });
    });

export type ClinicManifest = z.infer<typeof clinicManifestSchema>;

export class ManifestError extends Error {
    readonly issues: string[];
    constructor(issues: string[]) {
        super(`Invalid clinic manifest:\n  - ${issues.join("\n  - ")}`);
        this.name = "ManifestError";
        this.issues = issues;
    }
}

/** Validate already-parsed data. Issue text is "path: reason" — it never echoes values. */
export function parseManifest(data: unknown): ClinicManifest {
    const result = clinicManifestSchema.safeParse(data);
    if (result.success) return result.data;
    throw new ManifestError(
        result.error.issues.map((issue) => `${issue.path.length ? issue.path.join(".") : "(root)"}: ${issue.message}`)
    );
}

export function loadManifestFile(filePath: string): ClinicManifest {
    let text: string;
    try {
        text = fs.readFileSync(filePath, "utf8");
    } catch {
        throw new ManifestError([`cannot read manifest file "${filePath}"`]);
    }
    let data: unknown;
    try {
        data = loadYaml(text);
    } catch {
        throw new ManifestError(["manifest is not valid YAML"]);
    }
    return parseManifest(data);
}
