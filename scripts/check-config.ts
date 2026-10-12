#!/usr/bin/env tsx
/**
 * Pre-release configuration gate.
 *
 *   npm run config:check
 *   npm run config:check -- --manifest clients/<clinic>/clinic.yaml
 *
 * Validates the CURRENT PROCESS ENVIRONMENT the same way the server does at
 * start-up (so a bad release is caught before it is deployed), and optionally
 * cross-checks it against a clinic manifest. Prints variable names only.
 * Does not read the repository .env and does not touch any database.
 *
 * Exit codes: 0 ready · 1 problems found · 2 bad usage / manifest
 */
import path from "path";
import { parseArgs } from "node:util";
import { loadManifestFile, ManifestError } from "../src/lib/config/manifest";
import { crossCheckManifestAgainstEnv } from "../src/lib/config/provision";
import { validateRuntimeConfig, type ConfigProblem } from "../src/lib/config/validate";

function main(): number {
    let manifestPath: string | undefined;
    try {
        manifestPath = parseArgs({ options: { manifest: { type: "string" } }, allowPositionals: false }).values.manifest;
    } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : "invalid arguments"}`);
        return 2;
    }

    let problems: ConfigProblem[];
    const features = validateRuntimeConfig(process.env).features;
    if (manifestPath) {
        try {
            problems = crossCheckManifestAgainstEnv(loadManifestFile(path.resolve(manifestPath)), process.env);
        } catch (error) {
            if (error instanceof ManifestError) {
                console.error(error.message);
                return 2;
            }
            throw error;
        }
    } else {
        problems = validateRuntimeConfig(process.env).problems;
    }

    if (problems.length === 0) {
        console.log("Configuration OK.");
        console.log(`  enabled features: ${features.length ? features.join(", ") : "(none)"}`);
        return 0;
    }

    console.error(`Configuration is NOT ready (${problems.length} problem${problems.length === 1 ? "" : "s"}):`);
    for (const p of problems) {
        console.error(`  - ${p.variable}: ${p.kind === "missing" ? "not set" : p.message}${p.kind === "missing" && p.message !== "not set" ? ` (${p.message})` : ""}`);
    }
    return 1;
}

process.exitCode = main();
