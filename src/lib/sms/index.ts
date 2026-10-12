// ============================================
// NEXUS DENTAL — Provider-neutral SMS
//
// The ONLY entry point other code uses to send an SMS. It decides which provider
// to use from configuration and applies the rules every deployment needs:
//   * fails CLOSED: no usable provider ⇒ an error, never a "sent" log line
//   * DEMO_MODE: only numbers on DEMO_SMS_ALLOWLIST may ever be texted
//   * never falls back from one provider to another paid one
//   * returns a structured result; "SENT" means accepted by the provider, not delivered
// Hubtel remains for payments and WhatsApp only (src/lib/sms/hubtel.ts).
// ============================================

import { normalizePhone } from "@/lib/phone";
import { readSmsConfig, type Env } from "./config";
import { SmsError, sendViaMnotify, type SmsSendResult } from "./mnotify";

export { SmsError } from "./mnotify";
export type { SmsErrorCode, SmsSendResult } from "./mnotify";

export interface SendSmsOptions {
    env?: Env;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
}

export async function sendSms(to: string, message: string, opts: SendSmsOptions = {}): Promise<SmsSendResult> {
    const env = opts.env ?? process.env;
    const cfg = readSmsConfig(env);

    const phone = normalizePhone(to);
    if (!phone.ok) throw new SmsError("INVALID_RECIPIENT", "The recipient is not a valid phone number.", false);

    // Demo guard comes BEFORE any provider is touched: an unapproved number must never reach a provider.
    if (cfg.demoMode && !cfg.demoAllowlist.includes(phone.e164)) {
        throw new SmsError("DEMO_BLOCKED", "This number is not on the demonstration allowlist; no SMS was sent.", false);
    }

    if (cfg.problem || !cfg.provider) {
        throw new SmsError("NOT_CONFIGURED", `SMS is not configured (${cfg.problem ?? "no provider"}); nothing was sent.`, false);
    }

    if (cfg.provider === "console") {
        // Development only (readSmsConfig refuses it in production). It records nothing as a real send.
        console.log(`[SMS console] message of ${message.length} characters to ${phone.e164.slice(0, 6)}***`);
        return { provider: "console", providerMessageId: `console-${Date.now()}`, accepted: 1, rejected: 0, responseStatus: "console", status: "SENT" };
    }

    return sendViaMnotify({
        apiKey: cfg.mnotify!.apiKey,
        senderId: cfg.mnotify!.senderId,
        recipients: [phone.e164],
        message,
        fetchImpl: opts.fetchImpl,
        timeoutMs: opts.timeoutMs,
    });
}
