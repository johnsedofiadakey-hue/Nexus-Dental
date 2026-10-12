import { afterEach, describe, expect, it, vi } from "vitest";
import { SECRETS } from "./helpers/config";

// Exercises src/instrumentation.ts — the hook Next.js runs once at server start.
// Only the refusal path is tested: a successful start would go on to connect to
// Sentry, Redis and the job queue.

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

async function startServerWith(env: Record<string, string>) {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "production");
    for (const name of [
        "DEPLOYMENT_MODE", "DATABASE_URL", "REDIS_URL", "NEXT_PUBLIC_APP_URL", "ENABLED_FEATURES",
        "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "NEXT_PUBLIC_FIREBASE_APP_ID", "FIREBASE_STORAGE_BUCKET",
    ]) vi.stubEnv(name, "");
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);

    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...a) => void errors.push(a.join(" ")));
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
        throw new Error(`process.exit(${code})`);
    }) as never);

    const { register } = await import("@/instrumentation");
    const outcome = await register().then(() => "started" as const, (e: Error) => e.message);
    return { outcome, exit, errors: errors.join("\n") };
}

describe("server start-up gate (src/instrumentation.ts)", () => {
    it("exits with code 1 in production when configuration is incomplete — it does not limp on", async () => {
        const { outcome, exit, errors } = await startServerWith({});
        expect(outcome).toBe("process.exit(1)");
        expect(exit).toHaveBeenCalledWith(1);
        expect(errors).toMatch(/Refusing to start/);
        expect(errors).toMatch(/DATABASE_URL \(missing\)/);
    });

    it("refuses a template placeholder secret and never prints its value", async () => {
        const placeholder = "your_jwt_secret_key_change_me_in_production";
        const { outcome, errors } = await startServerWith({ JWT_SECRET: placeholder });
        expect(outcome).toBe("process.exit(1)");
        expect(errors).toMatch(/JWT_SECRET/);
        expect(errors).not.toContain(placeholder);
    });

    it("never prints any secret value when it refuses", async () => {
        const { errors } = await startServerWith({ JWT_SECRET: "short", DATABASE_URL: SECRETS.DATABASE_URL, REDIS_URL: "http://" + SECRETS.REDIS_URL });
        for (const secret of Object.values(SECRETS)) expect(errors).not.toContain(secret);
        expect(errors).not.toContain("SENTINEL-DB-PASSWORD-9f3a");
    });
});
