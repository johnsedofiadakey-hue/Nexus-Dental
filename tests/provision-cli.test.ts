import { describe, expect, it } from "vitest";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { SECRETS, validEnv, without } from "./helpers/config";

const ROOT = path.resolve(__dirname, "..");
const TSX = path.join(ROOT, "node_modules/.bin/tsx");
const EXAMPLE = path.join(ROOT, "clients/example/clinic.yaml");

/** Run a real CLI script with a fully controlled environment (nothing inherited but PATH). */
function cli(script: string, args: string[], env: Record<string, string | undefined> = {}) {
    const clean: Record<string, string> = { PATH: process.env.PATH ?? "" };
    for (const [k, v] of Object.entries(env)) if (v !== undefined) clean[k] = v;
    const r = spawnSync(TSX, [path.join(ROOT, "scripts", script), ...args], { cwd: ROOT, env: clean as NodeJS.ProcessEnv, encoding: "utf8", timeout: 60_000 });
    return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

const noLeaks = (text: string) => {
    for (const secret of Object.values(SECRETS)) expect(text, `leaked a secret value`).not.toContain(secret);
    for (const piece of ["SENTINEL-DB-PASSWORD-9f3a", "SENTINEL-REDIS-PASSWORD-77b1", "sentinel_user"]) expect(text).not.toContain(piece);
};

describe("clinic:provision — usage and manifest errors (exit 2)", () => {
    it("explains usage when --manifest is missing", () => {
        const r = cli("clinic-provision.ts", []);
        expect(r.code).toBe(2);
        expect(r.out).toMatch(/--manifest is required/);
    });

    it("requires exactly one owner-invitation choice when applying", () => {
        const none = cli("clinic-provision.ts", ["--manifest", EXAMPLE], validEnv());
        expect(none.code).toBe(2);
        expect(none.out).toMatch(/exactly one of --invite-email/);
        const two = cli("clinic-provision.ts", ["--manifest", EXAMPLE, "--invite-email", "--skip-owner-invite"], validEnv());
        expect(two.code).toBe(2);
    });

    it("rejects an unknown flag", () => {
        expect(cli("clinic-provision.ts", ["--manifest", EXAMPLE, "--nope"]).code).toBe(2);
    });

    it("rejects an invalid manifest and names the offending key — never its value", () => {
        const file = path.join(os.tmpdir(), `bad-clinic-${Date.now()}.yaml`);
        const text = fs.readFileSync(EXAMPLE, "utf8") + "\npassword: SENTINEL-MANIFEST-PASSWORD-31337\n";
        fs.writeFileSync(file, text);
        try {
            const r = cli("clinic-provision.ts", ["--manifest", file, "--check"], validEnv());
            expect(r.code).toBe(2);
            expect(r.out).toMatch(/password/);
            expect(r.out).not.toContain("SENTINEL-MANIFEST-PASSWORD-31337");
        } finally {
            fs.rmSync(file, { force: true });
        }
    });

    it("needs DATABASE_URL in the environment and does not fall back to the repo's .env", () => {
        const r = cli("clinic-provision.ts", ["--manifest", EXAMPLE, "--check"], without(validEnv(), "DATABASE_URL") as Record<string, string>);
        expect(r.code).toBe(2);
        expect(r.out).toMatch(/DATABASE_URL is not set/);
    });
});

describe("clinic:provision — refusals never print secrets (exit 1)", () => {
    const unreachable = "postgresql://sentinel_user:SENTINEL-DB-PASSWORD-9f3a@127.0.0.1:1/sentinel_db";

    it("incomplete configuration names the variable but no values", () => {
        const env = without(validEnv({ NODE_ENV: "test", DATABASE_URL: unreachable }), "JWT_SECRET", "CLINIC_ID");
        const r = cli("clinic-provision.ts", ["--manifest", EXAMPLE, "--check"], env as Record<string, string>);
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/CONFIG_INVALID/);
        expect(r.out).toMatch(/JWT_SECRET/);
        noLeaks(r.out);
    });

    it("a production run without confirmation is refused before anything else", () => {
        const env = validEnv({ NODE_ENV: "production", DATABASE_URL: unreachable });
        const r = cli("clinic-provision.ts", ["--manifest", EXAMPLE, "--skip-owner-invite"], env as Record<string, string>);
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/PRODUCTION_CONFIRMATION_REQUIRED/);
        expect(r.out).toMatch(/--confirm-production example-dental-clinic/);
        noLeaks(r.out);
    });

    it("an unexpected failure (unreachable database) is generic by default and leaks nothing even with --verbose", () => {
        const env = validEnv({ NODE_ENV: "test", DATABASE_URL: unreachable });
        const quiet = cli("clinic-provision.ts", ["--manifest", EXAMPLE, "--check"], env as Record<string, string>);
        expect(quiet.code).toBe(1);
        expect(quiet.out).toMatch(/Provisioning failed/);
        expect(quiet.out).toMatch(/--verbose/);
        noLeaks(quiet.out);
        const loud = cli("clinic-provision.ts", ["--manifest", EXAMPLE, "--check", "--verbose"], env as Record<string, string>);
        expect(loud.code).toBe(1);
        noLeaks(loud.out);
    });

    it("prints only host and database name for the target, never credentials", () => {
        const env = validEnv({ NODE_ENV: "test", DATABASE_URL: unreachable });
        const r = cli("clinic-provision.ts", ["--manifest", EXAMPLE, "--check"], env as Record<string, string>);
        expect(r.out).toContain("127.0.0.1:1/sentinel_db");
    });
});

describe("config:check", () => {
    it("passes a complete configuration", () => {
        const r = cli("check-config.ts", [], validEnv());
        expect(r.code).toBe(0);
        expect(r.out).toMatch(/Configuration OK/);
        expect(r.out).toMatch(/paystack, hubtel, resend/);
        noLeaks(r.out);
    });

    it("lists every problem by variable name only", () => {
        const env = without(validEnv({ JWT_SECRET: "short" }), "REDIS_URL", "CLINIC_ID");
        const r = cli("check-config.ts", [], env as Record<string, string>);
        expect(r.code).toBe(1);
        for (const name of ["JWT_SECRET", "REDIS_URL", "CLINIC_ID"]) expect(r.out).toContain(name);
        noLeaks(r.out);
        expect(r.out).not.toContain("short");
    });

    it("cross-checks the environment against a manifest", () => {
        const ok = cli("check-config.ts", ["--manifest", EXAMPLE], validEnv());
        expect(ok.code).toBe(0);
        const bad = cli("check-config.ts", ["--manifest", EXAMPLE], validEnv({ CLINIC_ID: "a-different-clinic" }));
        expect(bad.code).toBe(1);
        expect(bad.out).toMatch(/CLINIC_ID/);
        expect(bad.out).not.toContain("a-different-clinic");
    });

    it("reports an unreadable manifest as a usage error", () => {
        expect(cli("check-config.ts", ["--manifest", "/no/such/file.yaml"], validEnv()).code).toBe(2);
    });
});
