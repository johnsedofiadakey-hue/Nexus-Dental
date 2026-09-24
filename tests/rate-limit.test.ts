import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the Redis commands the limiter uses. vi.hoisted makes
// these available to the (hoisted) vi.mock factory below.
const { store, ttls, redisMock } = vi.hoisted(() => {
    const store = new Map<string, number>();
    const ttls = new Map<string, number>();
    const redisMock = {
        incr: vi.fn(async (key: string) => {
            const next = (store.get(key) ?? 0) + 1;
            store.set(key, next);
            return next;
        }),
        expire: vi.fn(async (key: string, seconds: number) => {
            ttls.set(key, seconds);
            return 1;
        }),
        ttl: vi.fn(async (key: string) => ttls.get(key) ?? -1),
        del: vi.fn(async (key: string) => {
            store.delete(key);
            return 1;
        }),
    };
    return { store, ttls, redisMock };
});

vi.mock("@/lib/db/redis", () => ({ default: redisMock }));

import { consumeRateLimit, resetRateLimit, clientIp } from "@/lib/security/rate-limit";

beforeEach(() => {
    store.clear();
    ttls.clear();
    vi.clearAllMocks();
});

describe("consumeRateLimit", () => {
    it("allows attempts up to the limit and reports what is left", async () => {
        const first = await consumeRateLimit("login:a", 3, 900);
        expect(first).toMatchObject({ allowed: true, remaining: 2 });
        await consumeRateLimit("login:a", 3, 900);
        const third = await consumeRateLimit("login:a", 3, 900);
        expect(third).toMatchObject({ allowed: true, remaining: 0 });
    });

    it("blocks the attempt after the limit and says how long to wait", async () => {
        for (let i = 0; i < 3; i++) await consumeRateLimit("login:b", 3, 900);
        const blocked = await consumeRateLimit("login:b", 3, 900);
        expect(blocked.allowed).toBe(false);
        expect(blocked.remaining).toBe(0);
        expect(blocked.retryAfterSeconds).toBe(900);
    });

    it("starts the window only on the first hit, so it cannot be extended by retrying", async () => {
        await consumeRateLimit("login:c", 5, 900);
        await consumeRateLimit("login:c", 5, 900);
        await consumeRateLimit("login:c", 5, 900);
        expect(redisMock.expire).toHaveBeenCalledTimes(1);
    });

    it("counts different keys independently", async () => {
        for (let i = 0; i < 3; i++) await consumeRateLimit("login:d", 3, 900);
        expect((await consumeRateLimit("login:d", 3, 900)).allowed).toBe(false);
        expect((await consumeRateLimit("login:e", 3, 900)).allowed).toBe(true);
    });

    it("fails open (allows the request) if Redis is unavailable", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        redisMock.incr.mockRejectedValueOnce(new Error("ECONNREFUSED"));
        const result = await consumeRateLimit("login:f", 3, 900);
        expect(result.allowed).toBe(true);
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});

describe("resetRateLimit", () => {
    it("clears the counter so a successful sign-in is not penalised", async () => {
        for (let i = 0; i < 3; i++) await consumeRateLimit("login:g", 3, 900);
        await resetRateLimit("login:g");
        expect((await consumeRateLimit("login:g", 3, 900)).allowed).toBe(true);
    });

    it("never throws if Redis is unavailable", async () => {
        redisMock.del.mockRejectedValueOnce(new Error("down"));
        await expect(resetRateLimit("login:h")).resolves.toBeUndefined();
    });
});

describe("clientIp", () => {
    it("uses the first address in x-forwarded-for", () => {
        const h = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
        expect(clientIp(h)).toBe("203.0.113.7");
    });

    it("falls back to x-real-ip and then to unknown", () => {
        expect(clientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
        expect(clientIp(new Headers())).toBe("unknown");
    });
});
