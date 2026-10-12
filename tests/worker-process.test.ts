// Starts the REAL worker entrypoint as a child process. No Redis is needed for what
// is proven here: refusing bad configuration, and staying alive-but-not-ready (with a
// working liveness probe and a clean SIGTERM exit) while Redis is unreachable.
import { describe, expect, it } from "vitest";
import { spawn, spawnSync } from "child_process";
import path from "path";
import { validEnv } from "./helpers/config";

const ROOT = path.resolve(__dirname, "..");
const base = () => ({ PATH: process.env.PATH!, HOME: process.env.HOME! }) as unknown as NodeJS.ProcessEnv;

describe("worker process", () => {
    it("refuses to start with incomplete configuration, exits 1 and prints variable names only", () => {
        const r = spawnSync("npx", ["tsx", "src/worker/index.ts"], { cwd: ROOT, env: { ...base(), NODE_ENV: "production", JWT_SECRET: "x".repeat(40), CLINIC_ID: "c1" } as NodeJS.ProcessEnv, encoding: "utf8", timeout: 60_000 });
        expect(r.status).toBe(1);
        expect(r.stderr).toContain("Refusing to start");
        expect(r.stderr).toContain("DATABASE_URL");
        expect(r.stderr).not.toContain("x".repeat(40));
    }, 90_000);

    it("with Redis unreachable it stays alive, answers /healthz, reports /readyz not-ready, and exits 0 on SIGTERM", async () => {
        const port = 18081;
        const env = { ...base(), ...validEnv({ NODE_ENV: "production", REDIS_URL: "redis://127.0.0.1:6391", DATABASE_URL: "postgresql://nobody@127.0.0.1:1/none", WORKER_HEALTH_PORT: String(port), ALERT_EMAIL_TO: "" }) } as NodeJS.ProcessEnv;
        const child = spawn(process.execPath, ["--import", "tsx", "src/worker/index.ts"], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (out += d));
        const exited = new Promise<number | null>((res) => child.on("exit", (code) => res(code)));
        try {
            let live: Response | null = null;
            for (let i = 0; i < 80 && !live; i++) {
                live = await fetch(`http://127.0.0.1:${port}/healthz`).catch(() => null);
                if (!live) await new Promise((r) => setTimeout(r, 250));
            }
            expect(live?.status, out.slice(-800)).toBe(200);
            const ready = await fetch(`http://127.0.0.1:${port}/readyz`);
            expect(ready.status).toBe(503);
            expect(await ready.json()).toEqual({ status: "not-ready" });
            expect(out).not.toContain("redis://127.0.0.1:6391/"); // no connection strings in logs
        } finally {
            child.kill("SIGTERM");
        }
        expect(await Promise.race([exited, new Promise<string>((r) => setTimeout(() => r("timeout"), 15_000))])).toBe(0);
    }, 120_000);
});
