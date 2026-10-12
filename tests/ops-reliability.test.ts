/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles are intentionally loosely typed */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
    sendEmail: vi.fn(async (message: unknown) => { void message; }),
    redis: { ping: vi.fn(), set: vi.fn(), scan: vi.fn(), get: vi.fn() },
    getJob: vi.fn(),
}));

vi.mock("@/lib/db/prisma", async () => {
    const { opsDb } = await import("./helpers/opsDb");
    return { default: opsDb, prisma: opsDb };
});
vi.mock("@/lib/audit/logger", () => ({ logAudit: vi.fn(async () => {}), getClientIP: () => "127.0.0.1", getUserAgent: () => "vitest" }));
vi.mock("@/lib/email/sender", () => ({ sendEmail: m.sendEmail }));
vi.mock("@/lib/queue/redis", () => ({ queueRedisConnection: m.redis }));
vi.mock("@/lib/queue/queues", () => ({
    getQueue: () => ({ getJob: m.getJob }),
    notificationQueue: {}, appointmentQueue: {}, recallQueue: {}, insuranceQueue: {},
}));

import { ops, validBackupRow, validDrillRow } from "./helpers/opsDb";
import { sendOpsAlert, alertRecipients, ALERT_CLAIM_LEASE_MS } from "@/lib/system/alerts";
import { getBackupStatus, checkBackupsAndAlert } from "@/lib/system/backup-status";
import { redactError, isExhausted, recordDeadLetter } from "@/lib/queue/dead-letter";
import { registerWorker } from "@/lib/queue/manager";
import { readHeartbeats, startHeartbeat, withTimeout, evaluateWorkerHealth, REQUIRED_WORKERS, HEARTBEAT_PREFIX } from "@/lib/queue/heartbeat";
import { retryDeadLetter, RETRY_LEASE_MS } from "@/lib/queue/retry";
import { SCHEDULES, registerSchedules } from "@/worker/schedules";
import { GET as publicHealth } from "@/app/api/health/route";
import { POST as backupCallback } from "@/app/api/system/backups/complete/route";
import { POST as watchdogRoute } from "@/app/api/system/watchdog/route";
import { runWatchdog } from "@/lib/system/watchdog";
import { drillProblems, fullBackupProblems, isValidCompletedFullBackup } from "@/lib/backup/validity";

const T0 = new Date("2026-10-05T12:00:00Z");
const hours = (h: number, from = T0) => new Date(from.getTime() - h * 3600_000);
const ENV = { ALERT_EMAIL_TO: "owner@clinic.test, backup@clinic.test", RESEND_API_KEY: "re_test_key_not_real" };
const SECRET = "s".repeat(40);
const ALL_WORKERS = [...REQUIRED_WORKERS];

beforeEach(() => {
    vi.clearAllMocks();
    ops.reset();
    m.sendEmail.mockReset();
    m.sendEmail.mockResolvedValue(undefined);
    m.redis.scan.mockReset();
    m.redis.get.mockReset();
    m.redis.ping.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
    for (const k of ["ALERT_EMAIL_TO", "RESEND_API_KEY", "BACKUP_WEBHOOK_SECRET", "OPS_WATCHDOG_SECRET"]) delete process.env[k];
});

/** Make Redis report these worker heartbeats. */
const heartbeats = (beats: Array<{ instance: string; at: Date; workers: string[] }>) => {
    m.redis.ping.mockResolvedValue("PONG");
    m.redis.scan.mockResolvedValue(["0", beats.map((b) => `${HEARTBEAT_PREFIX}${b.instance}`)]);
    m.redis.get.mockImplementation(async (key: string) => {
        const b = beats.find((x) => `${HEARTBEAT_PREFIX}${x.instance}` === key);
        return b ? JSON.stringify({ at: b.at.toISOString(), workers: b.workers }) : null;
    });
};
const freshWorker = (over: Partial<{ workers: string[]; at: Date }> = {}) => ({ instance: "w1", at: new Date(), workers: ALL_WORKERS, ...over });

describe("operational alerts", () => {
    it("parses recipients, dropping junk", () => {
        expect(alertRecipients({ ALERT_EMAIL_TO: "a@x.test; b@y.test, nonsense ," })).toEqual(["a@x.test", "b@y.test"]);
        expect(alertRecipients({})).toEqual([]);
    });

    it("says honestly that nobody was told when no recipient is configured", async () => {
        expect(await sendOpsAlert("c1", "s", "b", { now: T0, env: {} })).toBe("unconfigured");
        expect(m.sendEmail).not.toHaveBeenCalled();
    });

    it("does not call console-only email 'sent': no provider key means unconfigured", async () => {
        expect(await sendOpsAlert("c1", "s", "b", { now: T0, env: { ALERT_EMAIL_TO: "owner@clinic.test" } })).toBe("unconfigured");
        expect(m.sendEmail).not.toHaveBeenCalled();
    });

    it("sends to every recipient, then suppresses repeats of the same condition within the window", async () => {
        expect(await sendOpsAlert("backup-failed", "Backup failed", "details", { now: T0, env: ENV })).toBe("sent");
        expect(m.sendEmail).toHaveBeenCalledTimes(2);
        expect(await sendOpsAlert("backup-failed", "Backup failed", "details", { now: new Date(T0.getTime() + 3 * 3600_000), env: ENV })).toBe("suppressed");
        expect(m.sendEmail).toHaveBeenCalledTimes(2);
        expect(await sendOpsAlert("backup-failed", "Backup failed", "details", { now: new Date(T0.getTime() + 7 * 3600_000), env: ENV })).toBe("sent");
        expect(await sendOpsAlert("other", "x", "y", { now: T0, env: ENV })).toBe("sent");
    });

    it("CONCURRENCY: ten replicas evaluating the same condition at once send exactly one alert", async () => {
        const results = await Promise.all(Array.from({ length: 10 }, () => sendOpsAlert("backup-stale", "s", "b", { now: T0, env: ENV })));
        expect(results.filter((r) => r === "sent")).toHaveLength(1);
        expect(results.filter((r) => r === "suppressed")).toHaveLength(9);
        expect(m.sendEmail).toHaveBeenCalledTimes(2); // one alert x two recipients
    });

    it("CONCURRENCY: the claim is held while the email is in flight - a slow send cannot be duplicated by a second caller", async () => {
        let release!: () => void;
        m.sendEmail.mockImplementationOnce(() => new Promise<void>((r) => { release = r; }));
        const first = sendOpsAlert("slow", "s", "b", { now: T0, env: { ...ENV, ALERT_EMAIL_TO: "one@clinic.test" } });
        await new Promise((r) => setTimeout(r, 5));
        // the sender has not finished; nothing is "sent" yet, but the lease blocks everyone else
        expect(await sendOpsAlert("slow", "s", "b", { now: new Date(T0.getTime() + 1000), env: ENV })).toBe("suppressed");
        release();
        expect(await first).toBe("sent");
        expect(m.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("no database transaction is open across the email call (only short single-statement updates)", async () => {
        expect((ops.alertState as any).create).toBeDefined(); // table has no $transaction in this stand-in
        await sendOpsAlert("c4", "s", "b", { now: T0, env: ENV });
        const prismaModule = await import("@/lib/db/prisma");
        expect((prismaModule.default as any).$transaction).toBeUndefined();
    });

    it("a failed delivery releases the claim so the very next check can retry", async () => {
        m.sendEmail.mockRejectedValue(new Error("resend down"));
        expect(await sendOpsAlert("c2", "s", "b", { now: T0, env: ENV })).toBe("failed");
        expect(ops.alertState.rows[0].claimToken).toBeNull();
        expect(ops.alertState.rows[0].lastSentAt).toBeNull();
        m.sendEmail.mockResolvedValue(undefined);
        expect(await sendOpsAlert("c2", "s", "b", { now: new Date(T0.getTime() + 60_000), env: ENV })).toBe("sent");
    });

    it("a crashed sender's lease expires by itself", async () => {
        ops.alertState.rows.push({ condition: "c5", lastSentAt: null, claimedAt: T0, claimToken: "dead-process" });
        expect(await sendOpsAlert("c5", "s", "b", { now: new Date(T0.getTime() + ALERT_CLAIM_LEASE_MS - 1000), env: ENV })).toBe("suppressed");
        expect(await sendOpsAlert("c5", "s", "b", { now: new Date(T0.getTime() + ALERT_CLAIM_LEASE_MS + 1000), env: ENV })).toBe("sent");
    });

    it("partial delivery counts as sent but is logged; total failure does not", async () => {
        m.sendEmail.mockRejectedValueOnce(new Error("one bad inbox")).mockResolvedValue(undefined);
        expect(await sendOpsAlert("c6", "s", "b", { now: T0, env: ENV })).toBe("sent");
    });

    it("escapes the message and carries no secrets", async () => {
        await sendOpsAlert("c3", "s", "<script>alert(1)</script>", { now: T0, env: ENV });
        const html = (m.sendEmail.mock.calls as any)[0][0].html as string;
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
    });
});

describe("the validity predicate itself (independent of any query pre-filter)", () => {
    const base = validBackupRow({}, hours(1));
    const problems = (over: Record<string, unknown>) => fullBackupProblems({ ...base, ...over } as any, T0);

    it("a fully valid row has no problems", () => {
        expect(problems({})).toEqual([]);
        expect(isValidCompletedFullBackup(base as any, T0)).toBe(true);
    });

    it.each([
        ["type", { type: "INCREMENTAL" }, /not a full backup/],
        ["status", { status: "FAILED" }, /not completed/],
        ["encrypted", { encrypted: false }, /not marked encrypted/],
        ["formatVersion older", { formatVersion: 0 }, /current backup format/],
        ["formatVersion newer", { formatVersion: 2 }, /current backup format/],
        ["formatVersion missing", { formatVersion: null }, /current backup format/],
        ["sha256", { sha256: "zz" }, /SHA-256/],
        ["filePath", { filePath: "x" }, /object path/],
        ["fileSize zero", { fileSize: 0 }, /file size/],
        ["fileSize tiny", { fileSize: 1 }, /small/],
        ["fileSize huge", { fileSize: 9e13 }, /large/],
        ["completedAt missing", { completedAt: null }, /completion time/],
    ])("%s is reported as a problem on its own", (_n, over, re) => {
        const p = problems(over);
        expect(p.length).toBeGreaterThan(0);
        expect(p.join("; ")).toMatch(re);
    });

    it("drills: need the encrypted flag, current format, a checksum and sane times", () => {
        const d = validDrillRow({}, hours(1));
        expect(drillProblems(d as any, T0)).toEqual([]);
        expect(drillProblems({ ...d, encrypted: false } as any, T0).length).toBeGreaterThan(0);
        expect(drillProblems({ ...d, formatVersion: 0 } as any, T0).length).toBeGreaterThan(0);
        expect(drillProblems({ ...d, sha256: null } as any, T0).length).toBeGreaterThan(0);
        expect(drillProblems({ ...d, status: "FAILED" } as any, T0).length).toBeGreaterThan(0);
    });
});

describe("what counts as a healthy backup", () => {
    const seed = (full: object[], drills: object[] = []) => { ops.backupLog.rows.push(...full, ...drills); };

    it("ok: a valid encrypted backup within 26h and a strict drill within 35 days", async () => {
        seed([validBackupRow({}, hours(5))], [validDrillRow({}, hours(24 * 10))]);
        expect(await getBackupStatus(T0)).toMatchObject({ backup: "ok", drill: "ok" });
    });
    it("stale: last valid backup older than 26h", async () => {
        seed([validBackupRow({}, hours(30))], [validDrillRow({}, hours(24))]);
        expect((await getBackupStatus(T0)).backup).toBe("stale");
    });
    it("failed: the latest run failed even if an older one was valid", async () => {
        seed([validBackupRow({}, hours(20)), { type: "FULL", status: "FAILED", startedAt: hours(1), completedAt: hours(1), encrypted: false }], [validDrillRow({}, hours(24))]);
        expect((await getBackupStatus(T0)).backup).toBe("failed");
    });
    it("never: nothing recorded at all", async () => {
        expect(await getBackupStatus(T0)).toMatchObject({ backup: "never", drill: "never" });
    });
    it("drill overdue after 35 days", async () => {
        seed([validBackupRow({}, hours(2))], [validDrillRow({}, hours(24 * 36))]);
        expect((await getBackupStatus(T0)).drill).toBe("overdue");
    });

    // Each of these is a COMPLETED, recent row that is missing exactly one piece of proof.
    it.each([
        ["legacy plaintext (encrypted=false)", { encrypted: false }],
        ["no format version", { formatVersion: null }],
        ["an older format version", { formatVersion: 0 }],
        ["a newer, unsupported format version", { formatVersion: 2 }],
        ["no checksum", { sha256: null }],
        ["a malformed checksum", { sha256: "XYZ" }],
        ["no object path", { filePath: null }],
        ["an object path that is not a backup key", { filePath: "backups/2026-10-05/x.dump" }],
        ["no size", { fileSize: null }],
        ["a zero size", { fileSize: 0 }],
        ["an implausibly small size", { fileSize: 10 }],
        ["an implausibly large size", { fileSize: 10_000_000_000_000 }],
        ["no completion time", { completedAt: null }],
        ["completion before start", { startedAt: T0, completedAt: hours(1) }],
        ["a completion time in the future", { completedAt: new Date(T0.getTime() + 3600_000) }],
    ])("a recent COMPLETED row with %s never makes backup health ok", async (_name, bad) => {
        seed([validBackupRow(bad as any, hours(1))]);
        const s = await getBackupStatus(T0);
        expect(s.backup).not.toBe("ok");
        expect(s.lastBackupAt).toBeNull();
    });

    it("an old invalid row cannot hide behind a newer valid one, and a newer invalid row cannot hide an older valid one", async () => {
        seed([validBackupRow({}, hours(10)), validBackupRow({ encrypted: false, sha256: null }, hours(1))]);
        expect((await getBackupStatus(T0)).backup).toBe("ok");
        expect((await getBackupStatus(T0)).lastBackupAt).toBe(hours(10).toISOString());
    });

    it("a drill that does not name the encrypted backup it restored never counts", async () => {
        seed([validBackupRow({}, hours(2))], [validDrillRow({ sha256: null }, hours(1)), validDrillRow({ encrypted: false }, hours(1))]);
        expect((await getBackupStatus(T0)).drill).toBe("never");
    });

    it("alerts once for a stale backup, rate-limited; a fresh valid backup raises nothing", async () => {
        Object.assign(process.env, ENV);
        seed([validBackupRow({}, hours(40))], [validDrillRow({}, hours(24))]);
        await checkBackupsAndAlert(T0);
        const afterFirst = m.sendEmail.mock.calls.length;
        expect(afterFirst).toBeGreaterThan(0);
        await checkBackupsAndAlert(new Date(T0.getTime() + 3600_000));
        expect(m.sendEmail.mock.calls.length).toBe(afterFirst);
        m.sendEmail.mockClear(); ops.alertState.rows.length = 0; ops.backupLog.rows.length = 0;
        seed([validBackupRow({}, hours(2))], [validDrillRow({}, hours(24))]);
        await checkBackupsAndAlert(T0);
        expect(m.sendEmail).not.toHaveBeenCalled();
    });
});

describe("dead letters", () => {
    it("redacts emails, phone numbers, tokens and URLs from errors", () => {
        // Build the credential-shaped fixture at runtime so source control secret
        // scanners never mistake this redaction test for an actual provider key.
        const secretLike = ["sk", "live", "abcdefghijklmnopqrstuvwxyz123456"].join("_");
        const out = redactError(`send to ama@mail.test +233244000000 key ${secretLike} at https://api.x.test/v1?t=1`);
        for (const leaked of ["ama@mail.test", "233244000000", secretLike, "api.x.test"]) expect(out).not.toContain(leaked);
        expect(redactError("word ".repeat(400)).length).toBe(500);
    });

    it("exhaustion means attempts used up", () => {
        expect(isExhausted({ name: "j", attemptsMade: 3, opts: { attempts: 3 } })).toBe(true);
        expect(isExhausted({ name: "j", attemptsMade: 2, opts: { attempts: 3 } })).toBe(false);
        expect(isExhausted({ name: "j", attemptsMade: 1 })).toBe(true);
    });

    it("stores payload KEY NAMES only, never values", async () => {
        await recordDeadLetter("notification-queue", { id: "9", name: "send", attemptsMade: 3, data: { phone: "0244000000", message: "Hello Ama" } }, new Error("fail for ama@mail.test"));
        const arg = ops.failedJob.upsert.mock.calls[0][0];
        expect(arg.create.payloadKeys).toEqual(["phone", "message"]);
        expect(JSON.stringify(arg)).not.toContain("0244000000");
        expect(JSON.stringify(arg)).not.toContain("Hello Ama");
        expect(JSON.stringify(arg)).not.toContain("ama@mail.test");
        expect(arg.where).toEqual({ queue_jobId: { queue: "notification-queue", jobId: "9" } });
    });

    const fakeWorker = () => {
        const handlers: Record<string, (...a: any[]) => void> = {};
        return { w: { name: "notification-queue", close: vi.fn(), on: (e: string, h: any) => { handlers[e] = h; } } as any, handlers };
    };

    it("a worker's final failure is written to the database; an interim failure is not", async () => {
        const { w, handlers } = fakeWorker();
        registerWorker("t-final", w);
        handlers.failed({ id: "1", name: "n", attemptsMade: 1, opts: { attempts: 3 }, data: {} }, new Error("temporary"));
        expect(ops.failedJob.upsert).not.toHaveBeenCalled();
        handlers.failed({ id: "1", name: "n", attemptsMade: 3, opts: { attempts: 3 }, data: {} }, new Error("gave up"));
        await Promise.resolve();
        expect(ops.failedJob.upsert).toHaveBeenCalledTimes(1);
    });
});

describe("worker heartbeat", () => {
    it("writes a short-lived key and reads back live workers", async () => {
        m.redis.set.mockResolvedValue("OK");
        const stop = startHeartbeat(m.redis as any, "host-1", () => ["notification"]);
        stop();
        const [key, value, mode, ttl] = m.redis.set.mock.calls[0] as any[];
        expect(key).toBe(`${HEARTBEAT_PREFIX}host-1`);
        expect(JSON.parse(value).workers).toEqual(["notification"]);
        expect([mode, ttl]).toEqual(["EX", 90]);

        m.redis.scan.mockResolvedValueOnce(["0", [`${HEARTBEAT_PREFIX}host-1`, `${HEARTBEAT_PREFIX}bad`]]);
        m.redis.get.mockResolvedValueOnce(value).mockResolvedValueOnce("{not json");
        const beats = await readHeartbeats(m.redis as any);
        expect(beats).toHaveLength(1);
        expect(beats[0].instance).toBe("host-1");
    });

    it("withTimeout rejects a hung dependency quickly", async () => {
        await expect(withTimeout(new Promise(() => {}), 30, "redis")).rejects.toThrow(/timed out/);
        await expect(withTimeout(Promise.resolve(5), 30)).resolves.toBe(5);
    });
});

describe("schedules", () => {
    it("registers each schedule under a fixed id, so a restart or a second replica cannot duplicate it", async () => {
        const calls: any[] = [];
        const q = () => ({ upsertJobScheduler: vi.fn(async (...a: any[]) => { calls.push(a); }) }) as any;
        const queues = { recall: q(), insurance: q() };
        const first = await registerSchedules(queues, "clinic-1");
        const second = await registerSchedules(queues, "clinic-1");
        expect(first).toEqual(second);
        expect(new Set(first).size).toBe(SCHEDULES.length);
        const ids = calls.map((c) => c[0]);
        expect(ids.filter((i) => i === SCHEDULES[0].id)).toHaveLength(2); // same id both times => upsert, not insert
        expect(calls[0][2]).toMatchObject({ data: { tenantId: "clinic-1" } });
        expect(calls[0][1]).toMatchObject({ pattern: "0 9 * * *", tz: "UTC" });
    });
});


describe("worker health: ALL required workers on a FRESH heartbeat", () => {
    const beat = (workers: string[], at = T0) => ({ instance: "w", at: at.toISOString(), workers });

    it("UP only when one fresh heartbeat reports all four workers", () => {
        expect(evaluateWorkerHealth([beat(ALL_WORKERS)], T0)).toMatchObject({ status: "UP", missingWorkers: [] });
    });
    it("DOWN with no heartbeat at all", () => {
        expect(evaluateWorkerHealth([], T0)).toMatchObject({ status: "DOWN", reason: "none" });
    });
    it("DOWN when the only heartbeat is stale", () => {
        expect(evaluateWorkerHealth([beat(ALL_WORKERS, new Date(T0.getTime() - 120_000))], T0)).toMatchObject({ status: "DOWN", reason: "stale" });
    });
    it.each(ALL_WORKERS.map((w) => [w]))("DOWN when a live process is missing the %s worker", (missing) => {
        const h = evaluateWorkerHealth([beat(ALL_WORKERS.filter((w) => w !== missing))], T0);
        expect(h).toMatchObject({ status: "DOWN", reason: "incomplete", missingWorkers: [missing] });
    });
    it("two half-working instances do not add up to one healthy worker", () => {
        const h = evaluateWorkerHealth([{ ...beat(["appointment", "notification"]), instance: "a" }, { ...beat(["recall", "insurance-reminder"]), instance: "b" }], T0);
        expect(h.status).toBe("DOWN");
    });
    it("a corrupt timestamp counts as stale", () => {
        expect(evaluateWorkerHealth([{ instance: "x", at: "not-a-date", workers: ALL_WORKERS }], T0).status).toBe("DOWN");
    });
});

describe("independent worker-death monitoring (watchdog)", () => {
    beforeEach(() => { Object.assign(process.env, ENV); });

    it("no heartbeat: worker-stale alert is raised, rate-limited, and the watchdog result is unhealthy", async () => {
        heartbeats([]);
        ops.backupLog.rows.push(validBackupRow({}, hours(1)), validDrillRow({}, hours(1)));
        const first = await runWatchdog({ now: T0 });
        expect(first.ok).toBe(false);
        expect(first.issues).toContain("worker-stale");
        expect(first.alerts["worker-stale"]).toBe("sent");
        const second = await runWatchdog({ now: new Date(T0.getTime() + 60_000) });
        expect(second.alerts["worker-stale"]).toBe("suppressed");
        expect(m.sendEmail.mock.calls.filter((c: any) => c[0].subject.includes("worker")).length).toBe(2); // one alert, two recipients
    });

    it("a heartbeat missing one worker is unhealthy and says which", async () => {
        heartbeats([freshWorker({ workers: ALL_WORKERS.filter((w) => w !== "recall") })]);
        const r = await runWatchdog({ now: new Date() });
        expect(r.issues).toContain("worker-incomplete");
        expect(r.worker?.missingWorkers).toEqual(["recall"]);
    });

    it("Redis unreachable: worker state is UNKNOWN and still alerts", async () => {
        m.redis.scan.mockRejectedValue(new Error("ECONNREFUSED"));
        const r = await runWatchdog({ now: T0 });
        expect(r.issues).toContain("worker-unknown");
        expect(r.alerts["worker-stale"]).toBe("sent");
    });

    it("recovery clears the unhealthy result: the next evaluation is healthy with no new alert", async () => {
        ops.backupLog.rows.push(validBackupRow({}, new Date()), validDrillRow({}, new Date()));
        heartbeats([]);
        expect((await runWatchdog()).ok).toBe(false);
        m.sendEmail.mockClear();
        heartbeats([freshWorker()]);
        const healthy = await runWatchdog();
        expect(healthy).toMatchObject({ ok: true, issues: [] });
        expect(m.sendEmail).not.toHaveBeenCalled();
    });

    it("the worker's own pass does not judge worker health (a worker cannot report its own death)", async () => {
        heartbeats([]);
        ops.backupLog.rows.push(validBackupRow({}, new Date()), validDrillRow({}, new Date()));
        const r = await runWatchdog({ checkWorkers: false });
        expect(r.issues).not.toContain("worker-stale");
        expect(m.redis.scan).not.toHaveBeenCalled();
    });

    it("a backlog of dead-lettered jobs alerts", async () => {
        heartbeats([freshWorker()]);
        ops.backupLog.rows.push(validBackupRow({}, new Date()), validDrillRow({}, new Date()));
        for (let i = 0; i < 5; i++) ops.failedJob.rows.push({ queue: "q", jobId: String(i), retriedAt: null });
        const r = await runWatchdog();
        expect(r.issues).toContain("dead-letters");
    });

    describe("POST /api/system/watchdog", () => {
        const call = (secret: string | null) =>
            watchdogRoute(new NextRequest("http://localhost/api/system/watchdog", { method: "POST", headers: secret ? { "x-ops-watchdog-secret": secret } : {} }));
        beforeEach(() => { process.env.OPS_WATCHDOG_SECRET = SECRET; });

        it("rejects missing, wrong, and the backup-callback secret; does nothing", async () => {
            process.env.BACKUP_WEBHOOK_SECRET = "b".repeat(40);
            heartbeats([]);
            expect((await call(null)).status).toBe(401);
            expect((await call("wrong")).status).toBe(401);
            expect((await call("b".repeat(40))).status).toBe(401); // the backup secret is NOT accepted here
            expect(m.sendEmail).not.toHaveBeenCalled();
            expect(m.redis.scan).not.toHaveBeenCalled();
        });

        it("refuses to run when no usable secret is configured (and never accepts an empty header)", async () => {
            delete process.env.OPS_WATCHDOG_SECRET;
            expect((await call("")).status).toBe(503);
            process.env.OPS_WATCHDOG_SECRET = "changeme-changeme-changeme-123";
            const res = await call("changeme-changeme-changeme-123");
            expect(res.status).toBe(503);
            expect((await res.json()).error).toBe("Not configured"); // refused as a configuration problem, not run and found unhealthy
            expect(m.redis.scan).not.toHaveBeenCalled();
        });

        it("503 with condition names only when unhealthy, so a scheduled run fails visibly", async () => {
            heartbeats([]);
            const res = await call(SECRET);
            expect(res.status).toBe(503);
            const body = await res.json();
            expect(body.data.issues).toContain("worker-stale");
            expect(JSON.stringify(body)).not.toMatch(/owner@clinic|secret|redis:/i);
        });

        it("200 when everything is healthy", async () => {
            heartbeats([freshWorker()]);
            ops.backupLog.rows.push(validBackupRow({}, new Date()), validDrillRow({}, new Date()));
            const res = await call(SECRET);
            expect(res.status).toBe(200);
            expect((await res.json()).data.issues).toEqual([]);
        });
    });
});

describe("dead-letter retry claims", () => {
    const seedFailed = () => ops.failedJob.rows.push({ id: "f1", queue: "notification-queue", jobId: "9", name: "send", retriedAt: null, retryClaimedAt: null, retryClaimToken: null, retryAttempts: 0 });
    const job = (retry: () => Promise<void>) => ({ retry });

    it("CONCURRENCY: two (and ten) simultaneous retries call Redis exactly once", async () => {
        seedFailed();
        let calls = 0;
        m.getJob.mockResolvedValue(job(async () => { calls++; await new Promise((r) => setTimeout(r, 10)); }));
        const results = await Promise.all(Array.from({ length: 10 }, (_, i) => retryDeadLetter("f1", `admin-${i}`, T0)));
        expect(calls).toBe(1);
        expect(results.filter((r) => r === "retried")).toHaveLength(1);
        expect(results.filter((r) => r === "in-progress" || r === "already-retried")).toHaveLength(9);
        expect(ops.failedJob.rows[0]).toMatchObject({ retryClaimToken: null, retryError: null });
        expect(ops.failedJob.rows[0].retriedAt).toBeInstanceOf(Date);
    });

    it("claims BEFORE calling Redis (the claim exists while the retry is in flight)", async () => {
        seedFailed();
        let claimSeenInFlight = false;
        m.getJob.mockResolvedValue(job(async () => { claimSeenInFlight = ops.failedJob.rows[0].retryClaimToken !== null; }));
        await retryDeadLetter("f1", "admin", T0);
        expect(claimSeenInFlight).toBe(true);
    });

    it("a Redis failure releases the claim, records a redacted reason, and a deliberate later retry works", async () => {
        seedFailed();
        m.getJob.mockResolvedValue(job(async () => { throw new Error("connect ECONNREFUSED redis://user:pw@10.0.0.5:6379"); }));
        expect(await retryDeadLetter("f1", "admin", T0)).toBe("failed");
        const row = ops.failedJob.rows[0];
        expect(row.retriedAt).toBeNull();
        expect(row.retryClaimToken).toBeNull();
        expect(row.retryError).toContain("<url>");
        expect(row.retryError).not.toContain("pw@");
        expect(row.retryAttempts).toBe(1);

        m.getJob.mockResolvedValue(job(async () => {}));
        expect(await retryDeadLetter("f1", "admin", new Date(T0.getTime() + 1000))).toBe("retried");
        expect(ops.failedJob.rows[0]).toMatchObject({ retryError: null, retryAttempts: 2 });
    });

    it("a missing original job is reported, the claim released, and nothing is marked retried", async () => {
        seedFailed();
        m.getJob.mockResolvedValue(null);
        expect(await retryDeadLetter("f1", "admin", T0)).toBe("payload-gone");
        expect(ops.failedJob.rows[0]).toMatchObject({ retriedAt: null, retryClaimToken: null });
    });

    it("a caller that died mid-retry holds the claim only for the lease", async () => {
        seedFailed();
        ops.failedJob.rows[0].retryClaimedAt = T0;
        ops.failedJob.rows[0].retryClaimToken = "dead";
        m.getJob.mockResolvedValue(job(async () => {}));
        expect(await retryDeadLetter("f1", "admin", new Date(T0.getTime() + RETRY_LEASE_MS - 1000))).toBe("in-progress");
        expect(await retryDeadLetter("f1", "admin", new Date(T0.getTime() + RETRY_LEASE_MS + 1000))).toBe("retried");
    });

    it("unknown id and already-retried are reported without touching Redis", async () => {
        expect(await retryDeadLetter("nope", "admin", T0)).toBe("not-found");
        ops.failedJob.rows.push({ id: "f2", queue: "q", jobId: "1", retriedAt: new Date(), retryClaimedAt: null });
        expect(await retryDeadLetter("f2", "admin", T0)).toBe("already-retried");
        expect(m.getJob).not.toHaveBeenCalled();
    });
});

describe("GET /api/health", () => {
    it("answers quickly with 503 when Redis hangs, instead of hanging itself", async () => {
        m.redis.ping.mockReturnValue(new Promise(() => {}));
        const t0 = Date.now();
        const res = await publicHealth();
        expect(Date.now() - t0).toBeLessThan(2500);
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ status: "degraded" });
    });

    it("503 when the database is unreachable", async () => {
        m.redis.ping.mockResolvedValue("PONG");
        ops.queryRaw.mockRejectedValueOnce(new Error("down"));
        expect((await publicHealth()).status).toBe(503);
    });

    it("200 'degraded' with coarse labels when only the worker or backup is unhealthy", async () => {
        heartbeats([]);
        const res = await publicHealth();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: "degraded", workers: "down", backup: "never" });
    });

    it("a heartbeat missing a worker is NOT healthy", async () => {
        heartbeats([freshWorker({ workers: ["appointment"] })]);
        ops.backupLog.rows.push(validBackupRow({}, new Date()));
        expect((await (await publicHealth()).json()).workers).toBe("down");
    });

    it("a legacy completed row does not make the public backup label ok", async () => {
        heartbeats([freshWorker()]);
        ops.backupLog.rows.push(validBackupRow({ encrypted: false, sha256: null }, new Date()));
        expect((await (await publicHealth()).json()).backup).toBe("never");
    });

    it("200 ok when worker and backup are healthy", async () => {
        heartbeats([freshWorker()]);
        ops.backupLog.rows.push(validBackupRow({}, new Date()));
        expect(await (await publicHealth()).json()).toEqual({ status: "ok", workers: "ok", backup: "ok" });
    });
});

describe("POST /api/system/backups/complete - fail closed", () => {
    const now = () => new Date();
    const full = (over: Record<string, unknown> = {}) => {
        const at = now();
        const day = at.toISOString().slice(0, 10);
        return {
            type: "FULL", status: "COMPLETED", startedAt: new Date(at.getTime() - 60_000).toISOString(), completedAt: at.toISOString(),
            filePath: `daily/${day}/nexus-${day}-${at.getTime()}.dump.age`, fileSize: 7_000_000, sha256: "a".repeat(64), encrypted: true, formatVersion: 1, ...over,
        } as Record<string, unknown>;
    };
    const without = (o: Record<string, unknown>, k: string) => { const { [k]: _omit, ...rest } = o; void _omit; return rest; };
    const post = (body: unknown, secret: string | null = SECRET) =>
        backupCallback(new NextRequest("http://localhost/api/system/backups/complete", {
            method: "POST",
            headers: { "content-type": "application/json", ...(secret ? { "x-backup-secret": secret } : {}) },
            body: typeof body === "string" ? body : JSON.stringify(body),
        }));
    const written = () => ops.backupLog.rows.length;
    beforeEach(() => { process.env.BACKUP_WEBHOOK_SECRET = SECRET; Object.assign(process.env, ENV); });

    it("rejects a missing, wrong, or placeholder secret and writes nothing", async () => {
        expect((await post(full(), null)).status).toBe(401);
        expect((await post(full(), "nope")).status).toBe(401);
        process.env.BACKUP_WEBHOOK_SECRET = "short";
        expect((await post(full(), "short")).status).toBe(503);
        expect(written()).toBe(0);
    });

    it("a fully valid current-format callback is accepted and is the kind that satisfies freshness", async () => {
        expect((await post(full())).status).toBe(201);
        expect(written()).toBe(1);
        expect((await getBackupStatus(new Date())).backup).toBe("ok");
        expect(m.sendEmail).not.toHaveBeenCalled();
    });

    it.each([
        ["no checksum", (b: any) => without(b, "sha256")],
        ["a malformed checksum", (b: any) => ({ ...b, sha256: "abc" })],
        ["an uppercase checksum", (b: any) => ({ ...b, sha256: "A".repeat(64) })],
        ["not marked encrypted", (b: any) => ({ ...b, encrypted: false })],
        ["encrypted missing", (b: any) => without(b, "encrypted")],
        ["encrypted as a string", (b: any) => ({ ...b, encrypted: "true" })],
        ["no format version", (b: any) => without(b, "formatVersion")],
        ["a wrong format version", (b: any) => ({ ...b, formatVersion: 2 })],
        ["a fractional format version", (b: any) => ({ ...b, formatVersion: 1.5 })],
        ["no object path", (b: any) => without(b, "filePath")],
        ["an object path that is not a backup key", (b: any) => ({ ...b, filePath: "backups/x.dump" })],
        ["a path-traversal object path", (b: any) => ({ ...b, filePath: "daily/2026-10-05/../../etc/x.dump.age" })],
        ["no size", (b: any) => without(b, "fileSize")],
        ["a zero size", (b: any) => ({ ...b, fileSize: 0 })],
        ["a negative size", (b: any) => ({ ...b, fileSize: -5 })],
        ["a size as a string", (b: any) => ({ ...b, fileSize: "7000000" })],
        ["an implausibly small size", (b: any) => ({ ...b, fileSize: 100 })],
        ["an implausibly huge size", (b: any) => ({ ...b, fileSize: 9e12 })],
        ["no completion time", (b: any) => without(b, "completedAt")],
        ["a malformed completion time", (b: any) => ({ ...b, completedAt: "yesterday" })],
        ["completion before start", (b: any) => ({ ...b, startedAt: new Date().toISOString(), completedAt: new Date(Date.now() - 3600_000).toISOString() })],
        ["a completion time in the future", (b: any) => ({ ...b, completedAt: new Date(Date.now() + 3600_000).toISOString() })],
        ["a stale replay of an old run", (b: any) => ({ ...b, startedAt: new Date(Date.now() - 3 * 86400_000).toISOString(), completedAt: new Date(Date.now() - 3 * 86400_000 + 60_000).toISOString() })],
        ["an implausibly long run", (b: any) => ({ ...b, startedAt: new Date(Date.now() - 10 * 3600_000).toISOString() })],
        ["a misspelled proof field (sha_256)", (b: any) => ({ ...without(b, "sha256"), sha_256: "a".repeat(64) })],
        ["an unknown extra field", (b: any) => ({ ...b, tenantId: "other" })],
        ["an error message on a completed run", (b: any) => ({ ...b, errorMessage: "hmm" })],
        ["an incremental type", (b: any) => ({ ...b, type: "INCREMENTAL" })],
        ["a pending status", (b: any) => ({ ...b, status: "PENDING" })],
        ["a drill summary on a backup", (b: any) => ({ ...b, drill: { strict: true, tenants: 1, tables: 3, checks: 3 } })],
    ])("returns 400 and writes NOTHING for a completed backup with %s", async (_name, mutate) => {
        const res = await post(mutate(full()));
        expect(res.status).toBe(400);
        expect(written()).toBe(0);
        expect(m.sendEmail).not.toHaveBeenCalled();
    });

    it("rejects non-JSON, arrays and non-objects with 400", async () => {
        expect((await post("not json")).status).toBe(400);
        expect((await post([])).status).toBe(400);
        expect((await post("null")).status).toBe(400);
        expect(written()).toBe(0);
    });

    it("a FAILED backup is recorded (no proof required) and alerts the owner immediately", async () => {
        const at = now();
        expect((await post({ type: "FULL", status: "FAILED", startedAt: at.toISOString(), completedAt: at.toISOString(), errorMessage: "pg_dump failed: <url>" })).status).toBe(201);
        expect(written()).toBe(1);
        expect((m.sendEmail.mock.calls as any)[0][0].subject).toContain("backup FAILED");
        expect((await getBackupStatus(new Date())).backup).toBe("failed");
    });

    describe("restore drills", () => {
        const drill = (over: Record<string, unknown> = {}) => ({
            type: "RESTORE_DRILL", status: "COMPLETED", startedAt: new Date(Date.now() - 5000).toISOString(), completedAt: new Date().toISOString(),
            sha256: "a".repeat(64), encrypted: true, formatVersion: 1, drill: { strict: true, tenants: 1, tables: 45, checks: 8 }, ...over,
        });

        it("accepts a strict drill that names a recorded, valid backup, and it resets the drill clock", async () => {
            ops.backupLog.rows.push(validBackupRow({}, hours(2)));
            expect((await post(drill())).status).toBe(201);
            expect((await getBackupStatus(new Date())).drill).toBe("ok");
            expect(m.sendEmail).not.toHaveBeenCalled();
        });

        it("rejects a completed drill for a checksum we have no valid backup for (cannot be forged by the caller alone)", async () => {
            ops.backupLog.rows.push(validBackupRow({ sha256: "b".repeat(64) }, hours(2)));
            expect((await post(drill())).status).toBe(400);
            expect(written()).toBe(1);
        });

        it("rejects a drill for a legacy/plaintext backup", async () => {
            ops.backupLog.rows.push(validBackupRow({ encrypted: false }, hours(2)));
            expect((await post(drill())).status).toBe(400);
        });

        it.each([
            ["no drill summary", (d: any) => without(d, "drill")],
            ["a non-strict summary", (d: any) => ({ ...d, drill: { ...d.drill, strict: false } })],
            ["zero clinics", (d: any) => ({ ...d, drill: { ...d.drill, tenants: 0 } })],
            ["two clinics", (d: any) => ({ ...d, drill: { ...d.drill, tenants: 2 } })],
            ["no checksum", (d: any) => without(d, "sha256")],
            ["a file path (timing text smuggled into it)", (d: any) => ({ ...d, filePath: "restored in 3004ms" })],
            ["a file size", (d: any) => ({ ...d, fileSize: 1234 })],
            ["an unknown drill field", (d: any) => ({ ...d, drill: { ...d.drill, rows: 5 } })],
        ])("rejects a completed drill with %s", async (_n, mutate) => {
            ops.backupLog.rows.push(validBackupRow({}, hours(2)));
            const before = written();
            expect((await post(mutate(drill()))).status).toBe(400);
            expect(written()).toBe(before);
        });

        it("a failed drill is recorded and alerts", async () => {
            expect((await post({ type: "RESTORE_DRILL", status: "FAILED", startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), errorMessage: "CHECKSUM_MISMATCH" })).status).toBe(201);
            expect((m.sendEmail.mock.calls as any)[0][0].subject).toContain("Restore drill FAILED");
            expect((await getBackupStatus(new Date())).drill).toBe("never");
        });
    });
});

describe("the web process no longer runs workers", () => {
    it("register() at runtime imports no worker module and starts no worker", async () => {
        vi.resetModules();
        const validEnv = (await import("./helpers/config")).validEnv();
        const saved = { ...process.env };
        Object.assign(process.env, validEnv, { NEXT_RUNTIME: "nodejs" });
        delete process.env.NEXT_PHASE;
        const workerModule = vi.fn();
        vi.doMock("@/lib/queue/workers/appointment.worker", () => { workerModule(); return {}; });
        vi.doMock("@/lib/queue/workers/notification.worker", () => { workerModule(); return {}; });
        vi.doMock("@sentry/nextjs", () => ({ init: vi.fn() }));
        const onSpy = vi.spyOn(process, "on");
        const { register } = await import("@/instrumentation");
        await register();
        expect(workerModule).not.toHaveBeenCalled();
        expect(onSpy).not.toHaveBeenCalledWith("SIGTERM", expect.anything());
        onSpy.mockRestore();
        process.env = saved;
    });
});
