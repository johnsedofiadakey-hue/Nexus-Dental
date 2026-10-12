/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures and database mocks are intentionally loosely typed */
import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { loadManifestFile, parseManifest, type ClinicManifest } from "@/lib/config/manifest";
import { crossCheckManifestAgainstEnv, ProvisionError, provisionClinic } from "@/lib/config/provision";
import { SECRETS, validEnv, without } from "./helpers/config";

const MIGRATIONS_DIR = path.resolve(__dirname, "../prisma/migrations");
const migrationNames = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
const appliedRows = (names: string[]) => names.map((migration_name) => ({ migration_name, finished_at: new Date(), rolled_back_at: null }));

const baseManifest = (): ClinicManifest => loadManifestFile(path.resolve(__dirname, "../clients/example/clinic.yaml"));

/** A database stand-in that fails the test the moment anything touches it. */
const forbiddenDb = new Proxy({}, {
    get(_t, prop) {
        throw new Error(`database was touched (${String(prop)}) but this path must refuse first`);
    },
}) as unknown as PrismaClient;

/** A minimal fake for paths that get as far as reading state. */
function fakeDb(opts: { rows?: unknown; queryError?: Error; tenants?: { id: string; slug: string }[] } = {}) {
    const calls: string[] = [];
    const db: any = {
        $queryRaw: async () => {
            calls.push("$queryRaw");
            if (opts.queryError) throw opts.queryError;
            return opts.rows ?? appliedRows(migrationNames);
        },
        $transaction: async () => {
            calls.push("$transaction");
            throw new Error("must not write");
        },
        tenant: { findMany: async () => (calls.push("tenant.findMany"), opts.tenants ?? []) },
        user: { findFirst: async () => null },
        calls,
    };
    return db as PrismaClient & { calls: string[] };
}

const run = (over: Partial<Parameters<typeof provisionClinic>[0]> & { prisma: PrismaClient }) =>
    provisionClinic({
        manifest: baseManifest(),
        env: validEnv({ NODE_ENV: "test" }),
        migrationsDir: MIGRATIONS_DIR,
        ownerInvite: { type: "skip" },
        ...over,
    });

const codeOf = async (p: Promise<unknown>) => {
    try {
        await p;
        return "RESOLVED";
    } catch (e) {
        return e instanceof ProvisionError ? e.code : `OTHER:${(e as Error).message}`;
    }
};

describe("production confirmation", () => {
    const productionManifest = () => {
        const m = baseManifest();
        m.deployment.environment = "production";
        return m;
    };

    it("is required when the manifest says production — and refuses before touching the database", async () => {
        expect(await codeOf(run({ prisma: forbiddenDb, manifest: productionManifest() }))).toBe("PRODUCTION_CONFIRMATION_REQUIRED");
    });

    it("is required when NODE_ENV is production even for a rehearsal manifest", async () => {
        expect(await codeOf(run({ prisma: forbiddenDb, env: validEnv({ NODE_ENV: "production" }) }))).toBe("PRODUCTION_CONFIRMATION_REQUIRED");
    });

    it("must be the exact clinic id — a generic flag or the wrong id is not enough", async () => {
        for (const confirm of ["", "yes", "true", "other-clinic", "EXAMPLE-DENTAL-CLINIC"]) {
            expect(await codeOf(run({ prisma: forbiddenDb, manifest: productionManifest(), confirmProduction: confirm }))).toBe(
                "PRODUCTION_CONFIRMATION_REQUIRED"
            );
        }
    });

    it("lets a correctly confirmed production run continue to the next check", async () => {
        const db = fakeDb({ tenants: [{ id: "someone-else", slug: "x" }] });
        expect(await codeOf(run({ prisma: db, manifest: productionManifest(), env: validEnv(), confirmProduction: "example-dental-clinic" }))).toBe(
            "SECOND_CLINIC_REFUSED"
        );
    });

    it("is not needed for a non-production run", async () => {
        const db = fakeDb({ tenants: [{ id: "someone-else", slug: "x" }] });
        expect(await codeOf(run({ prisma: db }))).toBe("SECOND_CLINIC_REFUSED"); // got past the gate
    });
});

describe("configuration must agree with the manifest — checked before the database", () => {
    const refusals: [string, Record<string, string | undefined>][] = [
        ["JWT_SECRET missing", without(validEnv({ NODE_ENV: "test" }), "JWT_SECRET")],
        ["CLINIC_ID differs from the manifest", validEnv({ NODE_ENV: "test", CLINIC_ID: "a-different-clinic" })],
        ["app URL differs", validEnv({ NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "https://app.other.test" })],
        ["Firebase project differs", validEnv({ NODE_ENV: "test", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "another-project" })],
        ["storage bucket differs", validEnv({ NODE_ENV: "test", FIREBASE_STORAGE_BUCKET: "other.appspot.com" })],
        ["enabled features differ from the manifest", validEnv({ NODE_ENV: "test", ENABLED_FEATURES: "paystack" })],
        ["a feature's secrets are missing", without(validEnv({ NODE_ENV: "test" }), "PAYSTACK_SECRET_KEY")],
        ["deployment mode unset", without(validEnv({ NODE_ENV: "test" }), "DEPLOYMENT_MODE")],
    ];

    it.each(refusals)("refuses when %s, without touching the database", async (_label, env) => {
        expect(await codeOf(run({ prisma: forbiddenDb, env }))).toBe("CONFIG_INVALID");
    });

    it("tolerates a trailing slash and case difference in the app URL", () => {
        const env = validEnv({ NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "HTTPS://App.Example-Dental.test/" });
        expect(crossCheckManifestAgainstEnv(baseManifest(), env)).toEqual([]);
    });

    it("never puts a secret value in the error", async () => {
        const env = validEnv({ NODE_ENV: "test", CLINIC_ID: "a-different-clinic", JWT_SECRET: "short" });
        try {
            await run({ prisma: forbiddenDb, env });
            throw new Error("should have refused");
        } catch (error) {
            const text = `${(error as Error).message} ${JSON.stringify((error as ProvisionError).problems)}`;
            for (const secret of [...Object.values(SECRETS), "a-different-clinic", "short"]) expect(text).not.toContain(secret);
            expect(text).toContain("CLINIC_ID");
        }
    });
});

describe("owner invitation delivery is validated before any write", () => {
    it("refuses emailing the invitation when the mail provider is not configured", async () => {
        const env = without(validEnv({ NODE_ENV: "test" }), "RESEND_API_KEY");
        // RESEND_API_KEY is also required by the 'resend' feature, so drop that feature everywhere.
        const manifest = baseManifest();
        manifest.features = ["paystack", "hubtel"];
        env.ENABLED_FEATURES = "paystack,hubtel";
        expect(await codeOf(run({ prisma: forbiddenDb, env, manifest, ownerInvite: { type: "email" } }))).toBe("INVITE_DELIVERY_INVALID");
    });

    it("refuses writing the invitation file inside the repository", async () => {
        const inside = path.join(process.cwd(), "owner-invite.txt");
        expect(await codeOf(run({ prisma: forbiddenDb, ownerInvite: { type: "file", path: inside } }))).toBe("INVITE_DELIVERY_INVALID");
        expect(fs.existsSync(inside)).toBe(false);
    });

    it("refuses an existing file and a missing directory", async () => {
        const existing = path.join(os.tmpdir(), `invite-existing-${Date.now()}.txt`);
        fs.writeFileSync(existing, "keep me");
        try {
            expect(await codeOf(run({ prisma: forbiddenDb, ownerInvite: { type: "file", path: existing } }))).toBe("INVITE_DELIVERY_INVALID");
            expect(fs.readFileSync(existing, "utf8")).toBe("keep me");
        } finally {
            fs.rmSync(existing, { force: true });
        }
        expect(await codeOf(run({ prisma: forbiddenDb, ownerInvite: { type: "file", path: "/no/such/dir/invite.txt" } }))).toBe("INVITE_DELIVERY_INVALID");
    });
});

describe("database preconditions", () => {
    it("refuses a database that was never migrated", async () => {
        const missing = Object.assign(new Error('relation "_prisma_migrations" does not exist'), { code: "42P01" });
        expect(await codeOf(run({ prisma: fakeDb({ queryError: missing }) }))).toBe("MIGRATIONS_NOT_APPLIED");
    });

    it("does NOT misreport a connection failure as 'not migrated'", async () => {
        const down = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:1"), { code: "ECONNREFUSED" });
        expect(await codeOf(run({ prisma: fakeDb({ queryError: down }) }))).toBe("OTHER:connect ECONNREFUSED 127.0.0.1:1");
    });

    it("refuses when a migration in this release is not applied", async () => {
        const rows = appliedRows(migrationNames.slice(0, -1));
        expect(await codeOf(run({ prisma: fakeDb({ rows }) }))).toBe("MIGRATIONS_NOT_APPLIED");
    });

    it("refuses when a migration is only partially applied or rolled back", async () => {
        const unfinished = appliedRows(migrationNames).map((r, i) => (i === 0 ? { ...r, finished_at: null } : r));
        expect(await codeOf(run({ prisma: fakeDb({ rows: unfinished }) }))).toBe("MIGRATIONS_NOT_APPLIED");
        const rolledBack = appliedRows(migrationNames).map((r, i) => (i === 0 ? { ...r, rolled_back_at: new Date() } : r));
        expect(await codeOf(run({ prisma: fakeDb({ rows: rolledBack }) }))).toBe("MIGRATIONS_NOT_APPLIED");
    });

    it("refuses when the database is AHEAD of this release", async () => {
        const rows = [...appliedRows(migrationNames), ...appliedRows(["29990101000000_from_the_future"])];
        expect(await codeOf(run({ prisma: fakeDb({ rows }) }))).toBe("MIGRATIONS_NOT_APPLIED");
    });

    it("refuses a database that already holds a different clinic", async () => {
        expect(await codeOf(run({ prisma: fakeDb({ tenants: [{ id: "another-clinic", slug: "another" }] }) }))).toBe("SECOND_CLINIC_REFUSED");
    });

    it("refuses a database holding this clinic AND another", async () => {
        const tenants = [{ id: "example-dental-clinic", slug: "example-dental" }, { id: "another-clinic", slug: "another" }];
        expect(await codeOf(run({ prisma: fakeDb({ tenants }) }))).toBe("SECOND_CLINIC_REFUSED");
    });

    it("refuses a changed slug for the existing clinic", async () => {
        expect(await codeOf(run({ prisma: fakeDb({ tenants: [{ id: "example-dental-clinic", slug: "renamed-slug" }] }) }))).toBe("SLUG_IMMUTABLE");
    });

    it("--check validates everything but never opens a write transaction", async () => {
        const db = fakeDb();
        const result = await run({ prisma: db, checkOnly: true });
        expect(result.mode).toBe("check");
        expect(result.tenant).toBe("would_create");
        expect(db.calls).not.toContain("$transaction");
    });
});

describe("the manifest cannot be bent into a different identity", () => {
    it("a changed clinic id is simply a different clinic and is refused against an existing one", async () => {
        const m = parseManifest({ ...baseManifest(), clinic: { ...baseManifest().clinic, id: "renamed-clinic" } });
        const env = validEnv({ NODE_ENV: "test", CLINIC_ID: "renamed-clinic" });
        const db = fakeDb({ tenants: [{ id: "example-dental-clinic", slug: "example-dental" }] });
        expect(await codeOf(run({ prisma: db, manifest: m, env }))).toBe("SECOND_CLINIC_REFUSED");
    });
});
