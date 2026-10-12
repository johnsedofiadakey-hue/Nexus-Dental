#!/usr/bin/env tsx
/**
 * Fill ONE already-provisioned clinic with clearly labelled SYNTHETIC demo data, or check
 * whether a live demonstration is ready.
 *
 *   npm run demo:provision -- --check
 *   npm run demo:provision -- --confirm-clinic <CLINIC_ID> --credentials-out /secure/place/demo-accounts.txt \
 *        [--rotate-passwords]
 *
 * Needs, in the environment (the repository .env is NOT read): DATABASE_URL, CLINIC_ID,
 * DEMO_MODE=true, DEMO_PATIENT_PHONE (a phone you control), DEMO_SMS_ALLOWLIST (must include it),
 * and for reminders SMS_PROVIDER=mnotify + MNOTIFY_API_KEY + MNOTIFY_SENDER_ID.
 *
 * Refuses unless DEMO_MODE=true and the clinic id is typed back exactly. Never deletes, never runs the
 * legacy seed, never touches a record it did not create. Staff passwords are random and appear ONLY in the
 * 0600 --credentials-out file (outside the repo, must not exist). Safe to re-run.
 * --check writes nothing and prints no credential or full phone number.
 *
 * Exit codes: 0 done / ready · 1 refused or not ready · 2 bad usage
 */
import path from "path";
import { parseArgs } from "node:util";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { describeDatabase } from "../src/lib/config/provision";
import { DemoError, demoReadiness, provisionDemo } from "../src/lib/demo/provision";

const USAGE = `Usage:
  demo:provision --check
  demo:provision --confirm-clinic <CLINIC_ID> --credentials-out <new file outside the repo> [--rotate-passwords]`;

async function main(): Promise<number> {
    let args;
    try {
        args = parseArgs({
            options: {
                check: { type: "boolean", default: false },
                "confirm-clinic": { type: "string" },
                "credentials-out": { type: "string" },
                "rotate-passwords": { type: "boolean", default: false },
                verbose: { type: "boolean", default: false },
            },
            allowPositionals: false,
        }).values;
    } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : "invalid arguments"}\n\n${USAGE}`);
        return 2;
    }
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error("Error: DATABASE_URL is not set in the environment (the repository .env is intentionally not read).");
        return 2;
    }

    console.log("Nexus Dental — synthetic demo data");
    console.log(`  database           ${describeDatabase(databaseUrl)}`);
    console.log(`  clinic             ${process.env.CLINIC_ID ?? "(CLINIC_ID not set)"}`);

    const pool = new pg.Pool({ connectionString: databaseUrl });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    const migrationsDir = path.resolve(__dirname, "../prisma/migrations");
    try {
        if (args.check) {
            const r = await demoReadiness(prisma, process.env, migrationsDir);
            for (const c of r.checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name} - ${c.detail}`);
            console.log(r.ok ? "\nREADY: the demonstration can run. Nothing was changed." : "\nNOT READY. Nothing was changed.");
            return r.ok ? 0 : 1;
        }
        const result = await provisionDemo({
            prisma,
            env: process.env,
            confirmClinic: args["confirm-clinic"],
            credentialsOut: args["credentials-out"],
            rotatePasswords: args["rotate-passwords"],
            migrationsDir,
        });
        console.log("\nSynthetic demo data is in place.");
        console.log(`  created            ${JSON.stringify(result.created)}`);
        console.log(`  already present    ${JSON.stringify(result.existing)}`);
        console.log(result.credentialsFile ? `  passwords          ${result.passwordsWritten} written to ${result.credentialsFile} (mode 600) - not shown here` : "  passwords          unchanged (no new accounts)");
        console.log("\nNext: run `demo:provision --check`, then the rehearsal.");
        return 0;
    } catch (error) {
        if (error instanceof DemoError) {
            console.error(`\nRefused [${error.code}]: ${error.message}`);
        } else {
            const name = error instanceof Error ? error.name : "Error";
            console.error(`\nFailed (${name}). Re-run with --verbose for the message.`);
            if (args.verbose && error instanceof Error) console.error(error.message);
        }
        return 1;
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

main().then((code) => { process.exitCode = code; });
