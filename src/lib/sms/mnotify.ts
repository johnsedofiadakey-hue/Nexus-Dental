// ============================================
// NEXUS DENTAL — mNotify SMS provider (API v2, "quick SMS")
//
//   POST https://api.mnotify.com/api/sms/quick?key=<API_KEY>
//   { "recipient": ["…"], "sender": "…", "message": "…", "is_schedule": false, "schedule_date": "" }
//   success: { "status": "success", "code": "2000", "summary": { "_id": "<campaign id>", … } }
//
// Docs: https://readthedocs.mnotify.com/
//
// Safety rules enforced here:
//   * the API key is only ever in the query string of the request we send; the URL is never
//     logged, stored, returned or put in an error
//   * no `sms_type: "otp"` for reminders
//   * a bounded timeout; non-2xx, bad JSON, non-success status, a missing campaign id and any
//     rejected recipient are FAILURES
//   * "accepted by the API" is reported as SENT, never as delivered
// ============================================

import { maskPhone, normalizePhone } from "@/lib/phone";
import { redactText } from "@/lib/utils/redact";

export const MNOTIFY_ENDPOINT = "https://api.mnotify.com/api/sms/quick";
export const MNOTIFY_TIMEOUT_MS = 10_000;

export type SmsErrorCode =
    | "NOT_CONFIGURED"
    | "DEMO_BLOCKED"
    | "INVALID_RECIPIENT"
    | "INVALID_MESSAGE"
    | "TIMEOUT"
    | "NETWORK"
    | "HTTP_ERROR"
    | "BAD_RESPONSE"
    | "PROVIDER_REJECTED"
    | "RECIPIENT_REJECTED";

export class SmsError extends Error {
    constructor(public code: SmsErrorCode, message: string, public retryable: boolean, public httpStatus?: number) {
        super(message);
        this.name = "SmsError";
    }
}

export interface SmsSendResult {
    provider: "mnotify" | "console";
    /** The provider's campaign/message id (mNotify `summary._id`). */
    providerMessageId: string;
    accepted: number;
    rejected: number;
    /** Provider status text, e.g. "success". */
    responseStatus: string;
    /** Accepted by the provider's API. Delivery to the handset is NOT known. */
    status: "SENT";
}

/** mNotify takes Ghana numbers as 0XXXXXXXXX and international numbers as digits without '+'. */
export function toMnotifyRecipient(e164: string): string {
    const digits = e164.replace(/^\+/, "");
    return digits.startsWith("233") && digits.length === 12 ? `0${digits.slice(3)}` : digits;
}

type Fetch = typeof fetch;

export interface MnotifySendInput {
    apiKey: string;
    senderId: string;
    /** E.164 numbers. */
    recipients: string[];
    message: string;
    fetchImpl?: Fetch;
    timeoutMs?: number;
}

const asNumber = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);
const countOf = (v: unknown): number | null => (Array.isArray(v) ? v.length : asNumber(v));

export async function sendViaMnotify(input: MnotifySendInput): Promise<SmsSendResult> {
    const { apiKey, senderId, recipients, message } = input;
    if (!apiKey) throw new SmsError("NOT_CONFIGURED", "mNotify is not configured.", false);
    if (!/^[A-Za-z0-9 ]{1,11}$/.test(senderId)) throw new SmsError("NOT_CONFIGURED", "The mNotify sender ID must be 1-11 letters or digits.", false);
    if (recipients.length === 0) throw new SmsError("INVALID_RECIPIENT", "No recipient.", false);
    for (const r of recipients) {
        if (!normalizePhone(r).ok) throw new SmsError("INVALID_RECIPIENT", "The recipient is not a valid phone number.", false);
    }
    if (typeof message !== "string" || message.trim() === "" || message.length > 1000) {
        throw new SmsError("INVALID_MESSAGE", "The message is empty or too long.", false);
    }

    const doFetch = input.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? MNOTIFY_TIMEOUT_MS);
    const who = recipients.map(maskPhone).join(",");

    let res: Response;
    try {
        res = await doFetch(`${MNOTIFY_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
                recipient: recipients.map(toMnotifyRecipient),
                sender: senderId,
                message,
                is_schedule: false,
                schedule_date: "",
            }),
            signal: controller.signal,
            redirect: "error",
        });
    } catch (error) {
        const aborted = (error as { name?: string })?.name === "AbortError";
        // Never include the error text: some runtimes put the full URL (with the key) in it.
        throw new SmsError(aborted ? "TIMEOUT" : "NETWORK", aborted ? `mNotify timed out for ${who}.` : `mNotify could not be reached for ${who}.`, true);
    } finally {
        clearTimeout(timer);
    }

    let raw = "";
    try {
        raw = await res.text();
    } catch {
        /* handled below as a bad response */
    }

    if (!res.ok) {
        // 5xx and 429 are worth retrying; other 4xx (bad key, bad sender, validation) are not.
        const retryable = res.status >= 500 || res.status === 429;
        let detail = "";
        try { detail = redactText(String((JSON.parse(raw) as { message?: unknown }).message ?? ""), 120); } catch { /* not JSON */ }
        throw new SmsError("HTTP_ERROR", `mNotify answered HTTP ${res.status}${detail ? `: ${detail}` : ""}.`, retryable, res.status);
    }

    let body: Record<string, unknown> | null;
    try {
        body = JSON.parse(raw) as Record<string, unknown> | null;
    } catch {
        throw new SmsError("BAD_RESPONSE", "mNotify returned a response that is not valid JSON.", true);
    }
    if (body === null || typeof body !== "object") throw new SmsError("BAD_RESPONSE", "mNotify returned an unexpected response.", true);

    const status = typeof body.status === "string" ? body.status : "";
    const code = String(body.code ?? "");
    if (status !== "success" || code !== "2000") {
        const detail = redactText(typeof body.message === "string" ? body.message : "", 120);
        throw new SmsError("PROVIDER_REJECTED", `mNotify did not accept the message (status "${redactText(status, 40)}", code ${redactText(code, 10)})${detail ? `: ${detail}` : ""}.`, false);
    }

    const summary = body.summary as Record<string, unknown> | null | undefined;
    const id = summary && typeof summary === "object" ? summary._id : undefined;
    if (typeof id !== "string" || id.trim() === "" || !summary) {
        throw new SmsError("BAD_RESPONSE", "mNotify reported success but returned no campaign id.", true);
    }

    const rejected = countOf(summary.total_rejected) ?? countOf(summary.numbers_rejected) ?? 0;
    const accepted = countOf(summary.total_sent) ?? countOf(summary.numbers_sent) ?? recipients.length - rejected;
    if (rejected > 0 || accepted < recipients.length) {
        throw new SmsError("RECIPIENT_REJECTED", `mNotify rejected ${rejected || recipients.length - accepted} of ${recipients.length} recipient(s).`, false);
    }

    return { provider: "mnotify", providerMessageId: id.slice(0, 128), accepted, rejected, responseStatus: status, status: "SENT" };
}
