/* eslint-disable @typescript-eslint/no-explicit-any -- request captures are loosely typed */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendSms, SmsError } from "@/lib/sms";
import { readSmsConfig, smsAvailable, parseAllowlist } from "@/lib/sms/config";
import { MNOTIFY_ENDPOINT, sendViaMnotify, toMnotifyRecipient } from "@/lib/sms/mnotify";

const KEY = "SENTINEL_MNOTIFY_API_KEY_1234567890";
const ENV = { NODE_ENV: "production", SMS_PROVIDER: "mnotify", MNOTIFY_API_KEY: KEY, MNOTIFY_SENDER_ID: "NexusDental" } as Record<string, string>;
const PHONE = "+233244123456";

const ok = (over: Record<string, unknown> = {}) => ({
    status: "success", code: "2000", message: "Message submitted successfully",
    summary: { _id: "camp-123", type: "SMS", total_sent: 1, contacts: 1, total_rejected: 0, numbers_sent: ["0244123456"], credit_used: 1, credit_left: 40, ...over },
});
const respond = (body: unknown, status = 200) => vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
let logs: string[];

beforeEach(() => {
    logs = [];
    for (const m of ["log", "error", "warn", "info"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(" ")); });
});
afterEach(() => vi.restoreAllMocks());

const send = (fetchImpl: any, env: Record<string, string> = ENV, to = PHONE) => sendSms(to, "Reminder text", { env, fetchImpl });
const failure = async (p: Promise<unknown>) => { try { await p; throw new Error("expected a failure"); } catch (e) { if (!(e instanceof SmsError)) throw e; return e; } };

describe("mNotify request contract", () => {
    it("POSTs JSON to the quick-SMS endpoint with the key in the query, the documented body, and no otp type", async () => {
        const fetchImpl = respond(ok());
        await send(fetchImpl);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(`${MNOTIFY_ENDPOINT}?key=${KEY}`);
        expect(url.startsWith("https://api.mnotify.com/api/sms/quick?key=")).toBe(true);
        expect(init.method).toBe("POST");
        expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
        const body = JSON.parse(init.body as string);
        expect(body).toEqual({ recipient: ["0244123456"], sender: "NexusDental", message: "Reminder text", is_schedule: false, schedule_date: "" });
        expect("sms_type" in body).toBe(false);
        expect(init.redirect).toBe("error");
    });

    it("sends Ghana numbers locally and international numbers as digits; the key is URL-encoded", () => {
        expect(toMnotifyRecipient("+233244123456")).toBe("0244123456");
        expect(toMnotifyRecipient("+447911123456")).toBe("447911123456");
    });

    it("URL-encodes an unusual key rather than breaking the query", async () => {
        const fetchImpl = respond(ok());
        await send(fetchImpl, { ...ENV, MNOTIFY_API_KEY: "a b&c=d" });
        expect((fetchImpl.mock.calls[0] as any)[0]).toBe(`${MNOTIFY_ENDPOINT}?key=a%20b%26c%3Dd`);
    });

    it.each(["", "WAYTOOLONGSENDER", "bad-sender!", "Nexus_Dental"])("rejects the sender ID %j before any request", async (senderId) => {
        const fetchImpl = respond(ok());
        const e = await failure(sendViaMnotify({ apiKey: KEY, senderId, recipients: [PHONE], message: "x", fetchImpl }));
        expect(e.code).toBe("NOT_CONFIGURED");
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("accepts an 11-character sender", async () => {
        await expect(sendViaMnotify({ apiKey: KEY, senderId: "ABCDEFGHIJK", recipients: [PHONE], message: "x", fetchImpl: respond(ok()) })).resolves.toBeDefined();
    });
});

describe("what a successful send reports", () => {
    it("returns the campaign id, counts and SENT - never DELIVERED", async () => {
        const r = await send(respond(ok()));
        expect(r).toEqual({ provider: "mnotify", providerMessageId: "camp-123", accepted: 1, rejected: 0, responseStatus: "success", status: "SENT" });
        expect(JSON.stringify(r)).not.toMatch(/DELIVERED/);
    });
    it("accepts a numeric code 2000 only as the string form the API documents", async () => {
        await expect(send(respond({ ...ok(), code: 2000 }))).resolves.toBeDefined();
    });
});

describe("every failure mode is a failure", () => {
    it.each([
        ["HTTP 400", () => respond({ status: "error", code: "1002", message: "Invalid sender" }, 400), "HTTP_ERROR", false],
        ["HTTP 401", () => respond({ message: "bad key" }, 401), "HTTP_ERROR", false],
        ["HTTP 429", () => respond("slow down", 429), "HTTP_ERROR", true],
        ["HTTP 500", () => respond("oops", 500), "HTTP_ERROR", true],
        ["HTTP 503", () => respond("", 503), "HTTP_ERROR", true],
        ["invalid JSON", () => respond("<html>not json</html>"), "BAD_RESPONSE", true],
        ["a JSON null", () => respond("null"), "BAD_RESPONSE", true],
        ["status not success", () => respond({ ...ok(), status: "error" }), "PROVIDER_REJECTED", false],
        ["code not 2000", () => respond({ ...ok(), code: "1006" }), "PROVIDER_REJECTED", false],
        ["no summary", () => respond({ status: "success", code: "2000" }), "BAD_RESPONSE", true],
        ["no campaign id", () => respond(ok({ _id: undefined })), "BAD_RESPONSE", true],
        ["an empty campaign id", () => respond(ok({ _id: "  " })), "BAD_RESPONSE", true],
        ["a non-string campaign id", () => respond(ok({ _id: 12345 })), "BAD_RESPONSE", true],
        ["a rejected recipient", () => respond(ok({ total_rejected: 1, total_sent: 0 })), "RECIPIENT_REJECTED", false],
        ["fewer accepted than sent", () => respond(ok({ total_sent: 0, total_rejected: 0, numbers_sent: [] })), "RECIPIENT_REJECTED", false],
        ["rejected list", () => respond(ok({ total_rejected: undefined, numbers_rejected: ["0244123456"] })), "RECIPIENT_REJECTED", false],
    ])("%s", async (_name, make, code, retryable) => {
        const e = await failure(send(make()));
        expect(e.code).toBe(code);
        expect(e.retryable).toBe(retryable);
    });

    it("a network error is a retryable NETWORK failure that does not echo the error text (which can contain the URL)", async () => {
        const e = await failure(send(vi.fn(async () => { throw new Error(`connect ECONNREFUSED ${MNOTIFY_ENDPOINT}?key=${KEY}`); })));
        expect(e).toMatchObject({ code: "NETWORK", retryable: true });
        expect(e.message).not.toContain(KEY);
    });

    it("a hung provider times out within the bound and is retryable", async () => {
        const hang = vi.fn((_url: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))));
        const t0 = Date.now();
        const e = await failure(sendSms(PHONE, "x", { env: ENV, fetchImpl: hang as any, timeoutMs: 50 }));
        expect(Date.now() - t0).toBeLessThan(1500);
        expect(e).toMatchObject({ code: "TIMEOUT", retryable: true });
    });

    it("an invalid or empty message is refused before any request", async () => {
        const fetchImpl = respond(ok());
        await expect(sendSms(PHONE, "", { env: ENV, fetchImpl })).rejects.toMatchObject({ code: "INVALID_MESSAGE" });
        await expect(sendSms(PHONE, "x".repeat(1001), { env: ENV, fetchImpl })).rejects.toMatchObject({ code: "INVALID_MESSAGE" });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each(["abc", "", "+233", "0244"])("an invalid recipient %j is refused before any request", async (to) => {
        const fetchImpl = respond(ok());
        await expect(sendSms(to, "x", { env: ENV, fetchImpl })).rejects.toMatchObject({ code: "INVALID_RECIPIENT" });
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});

describe("secrets and phone numbers never leak", () => {
    it("the API key and the full phone number appear in no log line, error message or result", async () => {
        const cases = [respond(ok()), respond({ status: "error", code: "1", message: `bad key ${KEY} for 0244123456 at https://x.test/?key=${KEY}` }, 400), respond("garbage"), vi.fn(async () => { throw new Error(KEY); })];
        const outputs: string[] = [];
        for (const f of cases) {
            try { outputs.push(JSON.stringify(await send(f))); } catch (e) { outputs.push((e as Error).message); }
        }
        const everything = outputs.join("\n") + "\n" + logs.join("\n");
        expect(everything).not.toContain(KEY);
        expect(everything).not.toContain("0244123456");
        expect(everything).not.toContain("+233244123456");
        expect(everything).not.toContain("233244123456");
    });

    it("provider error detail is redacted before it can be persisted", async () => {
        const e = await failure(send(respond({ message: "failed for ama@mail.test number 0244123456 at https://api.x.test/p" }, 400)));
        expect(e.message).not.toMatch(/ama@mail|0244123456|api\.x\.test/);
    });
});

describe("fail closed when not configured", () => {
    const base = { NODE_ENV: "production" };
    it.each([
        ["no provider at all", base],
        ["provider set but no key", { ...base, SMS_PROVIDER: "mnotify", MNOTIFY_SENDER_ID: "Nexus" }],
        ["provider set but no sender", { ...base, SMS_PROVIDER: "mnotify", MNOTIFY_API_KEY: KEY }],
        ["an invalid sender", { ...base, SMS_PROVIDER: "mnotify", MNOTIFY_API_KEY: KEY, MNOTIFY_SENDER_ID: "WAYTOOLONGSENDER" }],
        ["an unsupported provider", { ...base, SMS_PROVIDER: "twilio", MNOTIFY_API_KEY: KEY }],
        ["the console provider in production", { ...base, SMS_PROVIDER: "console" }],
    ])("%s => NOT_CONFIGURED, no request, no console success", async (_name, env) => {
        const fetchImpl = respond(ok());
        const e = await failure(sendSms(PHONE, "x", { env: env as Record<string, string>, fetchImpl }));
        expect(e).toMatchObject({ code: "NOT_CONFIGURED", retryable: false });
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(logs.join("\n")).not.toMatch(/sent/i);
    });

    it("the console provider works outside production only, and still never fakes a real provider id", async () => {
        const r = await sendSms(PHONE, "x", { env: { NODE_ENV: "development", SMS_PROVIDER: "console" } });
        expect(r.provider).toBe("console");
        expect(logs.join("\n")).not.toContain("244123456");
    });

    it("never falls back to Hubtel or any other provider when mNotify fails", async () => {
        const fetchImpl = respond("boom", 500);
        await failure(send(fetchImpl, { ...ENV, HUBTEL_CLIENT_ID: "id", HUBTEL_CLIENT_SECRET: "secret", HUBTEL_SENDER_ID: "Hub" }));
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(String((fetchImpl.mock.calls[0] as any)[0])).toContain("api.mnotify.com");
    });

    it("smsAvailable / readSmsConfig report problems without exposing values", () => {
        expect(smsAvailable(ENV)).toBe(true);
        expect(smsAvailable({ NODE_ENV: "production" })).toBe(false);
        const c = readSmsConfig({ NODE_ENV: "production", SMS_PROVIDER: "mnotify", MNOTIFY_SENDER_ID: "Nexus" });
        expect(c.problem).toBe("MNOTIFY_API_KEY is not set");
        expect(JSON.stringify(readSmsConfig(ENV).problem)).not.toContain(KEY);
    });
});

describe("demonstration allowlist", () => {
    const demo = { ...ENV, DEMO_MODE: "true", DEMO_SMS_ALLOWLIST: "+233200000001, 0200000002" };

    it("blocks every number not on the list BEFORE touching the provider", async () => {
        const fetchImpl = respond(ok());
        const e = await failure(send(fetchImpl, demo, "+233244123456"));
        expect(e).toMatchObject({ code: "DEMO_BLOCKED", retryable: false });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("allows listed numbers in any spelling (the list is canonicalised)", async () => {
        for (const to of ["+233200000001", "0200000001", "233200000002"]) {
            await expect(send(respond(ok()), demo, to)).resolves.toBeDefined();
        }
    });

    it("an EMPTY or unparsable allowlist in demo mode blocks everything", async () => {
        for (const list of ["", "garbage", " , "]) {
            const fetchImpl = respond(ok());
            await expect(send(fetchImpl, { ...ENV, DEMO_MODE: "true", DEMO_SMS_ALLOWLIST: list })).rejects.toMatchObject({ code: "DEMO_BLOCKED" });
            expect(fetchImpl).not.toHaveBeenCalled();
        }
        expect(smsAvailable({ ...ENV, DEMO_MODE: "true" })).toBe(false);
    });

    it("demo mode off ignores the list", async () => {
        await expect(send(respond(ok()), { ...ENV, DEMO_MODE: "false", DEMO_SMS_ALLOWLIST: "+233200000001" })).resolves.toBeDefined();
    });

    it("parseAllowlist canonicalises and de-duplicates", () => {
        expect(parseAllowlist("0200000001, +233200000001; 233200000001 nonsense")).toEqual(["+233200000001"]);
    });
});
