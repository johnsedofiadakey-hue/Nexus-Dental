import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Regression: `next build` must never start runtime services. A build once
// connected BullMQ queues to a real Redis because the old guard only checked
// that REDIS_URL was absent.

const bull = vi.hoisted(() => ({
    Queue: vi.fn(),
    // eslint-disable-next-line prefer-arrow-callback -- must be constructible with `new`
    Worker: vi.fn(function () {
        return { on: vi.fn() };
    }),
}));
const io = vi.hoisted(() => ({ Redis: vi.fn(() => ({ on: vi.fn() })) }));
const sentry = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock("bullmq", () => bull);
vi.mock("ioredis", () => io);
vi.mock("@sentry/nextjs", () => sentry);
vi.mock("@/lib/db/prisma", () => ({ default: {} }));

const saved = { ...process.env };

beforeEach(() => {
    vi.resetModules();
    bull.Queue.mockClear();
    bull.Worker.mockClear();
    io.Redis.mockClear();
    sentry.init.mockClear();
    process.env.REDIS_URL = "redis://real-looking-host:6379";
});

afterEach(() => {
    process.env = { ...saved };
});

describe("build phase never starts runtime services", () => {
    it("isBuildPhase is true only for phase-production-build", async () => {
        const { isBuildPhase } = await import("@/lib/config/build-phase");
        expect(isBuildPhase({ NEXT_PHASE: "phase-production-build" } as unknown as NodeJS.ProcessEnv)).toBe(true);
        expect(isBuildPhase({ NEXT_PHASE: "phase-production-server" } as unknown as NodeJS.ProcessEnv)).toBe(false);
        expect(isBuildPhase({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    });

    it("does not construct any BullMQ Queue during build even when REDIS_URL is set", async () => {
        process.env.NEXT_PHASE = "phase-production-build";
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        await import("@/lib/queue/queues");
        expect(bull.Queue).not.toHaveBeenCalled();
    });

    // Literal import paths: Vite cannot resolve an aliased template-string import.
    const loadWorkers = () =>
        Promise.all([
            import("@/lib/queue/workers/notification.worker"),
            import("@/lib/queue/workers/recall.worker"),
            import("@/lib/queue/workers/appointment.worker"),
            import("@/lib/queue/workers/insurance-reminder.worker"),
        ]);

    it("does not construct any BullMQ Worker during build even when REDIS_URL is set", async () => {
        process.env.NEXT_PHASE = "phase-production-build";
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        await loadWorkers();
        expect(bull.Worker).not.toHaveBeenCalled();
        expect(bull.Queue).not.toHaveBeenCalled();
    });

    it("control: at runtime all four workers ARE constructed, so the test above is meaningful", async () => {
        delete process.env.NEXT_PHASE;
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        await loadWorkers();
        expect(bull.Worker).toHaveBeenCalledTimes(4);
    });

    it("register() during build imports no worker or Sentry code and starts nothing", async () => {
        process.env.NEXT_PHASE = "phase-production-build";
        process.env.NEXT_RUNTIME = "nodejs";
        const onSpy = vi.spyOn(process, "on");
        const { register } = await import("@/instrumentation");
        await register();
        expect(sentry.init).not.toHaveBeenCalled();
        expect(bull.Queue).not.toHaveBeenCalled();
        expect(bull.Worker).not.toHaveBeenCalled();
        expect(io.Redis).not.toHaveBeenCalled();
        expect(onSpy).not.toHaveBeenCalledWith("SIGTERM", expect.anything());
        onSpy.mockRestore();
    });

    it("control: at runtime (not build) queues ARE constructed, so the test is meaningful", async () => {
        delete process.env.NEXT_PHASE;
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        await import("@/lib/queue/queues");
        expect(bull.Queue).toHaveBeenCalledTimes(4);
    });
});
