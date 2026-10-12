#!/usr/bin/env tsx
/**
 * Provision exactly one clinic into an empty, already-migrated database.
 *
 *   npm run clinic:provision -- --manifest clients/example/clinic.yaml \
 *       --check
 *   npm run clinic:provision -- --manifest clients/<clinic>/clinic.yaml \
 *       (--invite-email | --invite-out <file> | --skip-owner-invite) \
 *       [--reissue-invite] [--confirm-production <clinic-id>]
 *
 * Reads configuration ONLY from the process environment — it deliberately does
 * not load the repository's .env, which may point at a different (even live)
 * database. Output never contains secrets: only ids, outcomes and next steps.
 *
 * Exit codes: 0 success · 1 provisioning failed · 2 bad usage / manifest
 */
import path from "path";
import { parseArgs } from "node:util";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { loadManifestFile, ManifestError } from "../src/lib/config/manifest";
import {
    ProvisionError,
    provisionClinic,
    describeDatabase,
    type OwnerInviteDelivery,
    type ProvisionResult,
} from "../src/lib/config/provision";

const USAGE = `Usage:
  clinic:provision --manifest <file> --check
  clinic:provision --manifest <file> (--invite-email | --invite-out <file> | --skip-owner-invite)
                   [--reissue-invite] [--confirm-production <clinic-id>] [--verbose]`;

function line(label: string, value: string) {
    console.log(`  ${label.padEnd(18)} ${value}`);
}

function printResult(r: ProvisionResult) {
    console.log(r.mode === "check" ? "\nCheck passed — nothing was changed." : "\nProvisioning complete.");
    line("clinic", `${r.clinicId} (${r.slug})`);
    line("environment", r.environment);
    line("database", r.database);
    line("clinic record", r.tenant);
    if (r.mode === "apply") {
        line("settings", r.settings);
        line("public content", r.content);
        line("consent templates", `${r.consentTemplates.created} created, ${r.consentTemplates.existing} already present`);
        line("services", `${r.services.created} created, ${r.services.existing} already present`);
    }
    line("owner", r.owner.replace(/_/g, " "));
    if (r.inviteExpiresAt) line("invite expires", r.inviteExpiresAt);
    if (r.inviteDelivery) line("invite delivery", r.inviteDelivery);
    console.log("\nNext steps:");
    for (const step of r.nextSteps) console.log(`  - ${step}`);
}

async function main(): Promise<number> {
    let args;
    try {
        args = parseArgs({
            options: {
                manifest: { type: "string" },
                check: { type: "boolean", default: false },
                "invite-email": { type: "boolean", default: false },
                "invite-out": { type: "string" },
                "skip-owner-invite": { type: "boolean", default: false },
                "reissue-invite": { type: "boolean", default: false },
                "confirm-production": { type: "string" },
                verbose: { type: "boolean", default: false },
            },
            allowPositionals: false,
        }).values;
    } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : "invalid arguments"}\n\n${USAGE}`);
        return 2;
    }

    if (!args.manifest) {
        console.error(`Error: --manifest is required.\n\n${USAGE}`);
        return 2;
    }

    const methods = [args["invite-email"], !!args["invite-out"], args["skip-owner-invite"]].filter(Boolean).length;
    if (!args.check && methods !== 1) {
        console.error(`Error: choose exactly one of --invite-email, --invite-out <file>, --skip-owner-invite.\n\n${USAGE}`);
        return 2;
    }
    const ownerInvite: OwnerInviteDelivery = args["invite-email"]
        ? { type: "email" }
        : args["invite-out"]
          ? { type: "file", path: args["invite-out"] }
          : { type: "skip" };

    let manifest;
    try {
        manifest = loadManifestFile(path.resolve(args.manifest));
    } catch (error) {
        if (error instanceof ManifestError) {
            console.error(error.message);
            return 2;
        }
        throw error;
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error("Error: DATABASE_URL is not set in the environment (the repository .env is intentionally not read).");
        return 2;
    }

    console.log("Nexus Dental — clinic provisioning");
    line("manifest", `${path.basename(args.manifest)} (schema v${manifest.schemaVersion})`);
    line("clinic", `${manifest.clinic.id} (${manifest.clinic.slug})`);
    line("environment", manifest.deployment.environment);
    line("database", describeDatabase(databaseUrl));

    const pool = new pg.Pool({ connectionString: databaseUrl });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    try {
        const result = await provisionClinic({
            prisma,
            manifest,
            env: process.env,
            migrationsDir: path.resolve(__dirname, "../prisma/migrations"),
            ownerInvite,
            checkOnly: args.check,
            reissueInvite: args["reissue-invite"],
            confirmProduction: args["confirm-production"],
        });
        printResult(result);
        return 0;
    } catch (error) {
        if (error instanceof ProvisionError) {
            console.error(`\nProvisioning refused [${error.code}]: ${error.message}`);
        } else {
            // Unexpected errors can embed connection or query details: show the
            // message only when the operator explicitly asks for it.
            const name = error instanceof Error ? error.name : "Error";
            console.error(`\nProvisioning failed (${name}). Re-run with --verbose for the error message.`);
            if (args.verbose && error instanceof Error) console.error(error.message);
        }
        return 1;
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main().then((code) => {
    process.exitCode = code;
});
