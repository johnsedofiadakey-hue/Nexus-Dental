// ============================================
// NEXUS DENTAL — SMS configuration (read lazily, never at import time)
// ============================================

import { toE164 } from "@/lib/phone";

export type Env = Record<string, string | undefined>;

export type SmsProviderName = "mnotify" | "console";

/** mNotify sender IDs are at most 11 characters (letters, digits, spaces). */
export const SENDER_ID_PATTERN = /^[A-Za-z0-9 ]{1,11}$/;

export interface SmsConfig {
    /** null = no SMS provider configured. */
    provider: SmsProviderName | null;
    mnotify: { apiKey: string; senderId: string } | null;
    demoMode: boolean;
    /** Canonical E.164 numbers a demo deployment may text. Empty while demoMode ⇒ nothing may be texted. */
    demoAllowlist: string[];
    /** Why SMS cannot be sent right now, or null when it can. Never contains a secret value. */
    problem: string | null;
}

export function parseAllowlist(raw: string | undefined): string[] {
    const out: string[] = [];
    for (const part of (raw ?? "").split(/[\s,;]+/)) {
        const e164 = part ? toE164(part) : null;
        if (e164 && !out.includes(e164)) out.push(e164);
    }
    return out;
}

export function readSmsConfig(env: Env = process.env): SmsConfig {
    const isProduction = env.NODE_ENV === "production";
    const demoMode = env.DEMO_MODE?.trim().toLowerCase() === "true";
    const demoAllowlist = parseAllowlist(env.DEMO_SMS_ALLOWLIST);
    const requested = env.SMS_PROVIDER?.trim().toLowerCase();

    const base = { demoMode, demoAllowlist };
    if (!requested) return { ...base, provider: null, mnotify: null, problem: "SMS_PROVIDER is not set" };

    if (requested === "console") {
        // A console "provider" would report success without sending anything: never in production.
        if (isProduction) return { ...base, provider: null, mnotify: null, problem: 'SMS_PROVIDER "console" is not allowed in production' };
        return { ...base, provider: "console", mnotify: null, problem: null };
    }
    if (requested !== "mnotify") return { ...base, provider: null, mnotify: null, problem: `unsupported SMS_PROVIDER` };

    const apiKey = env.MNOTIFY_API_KEY?.trim();
    const senderId = env.MNOTIFY_SENDER_ID?.trim();
    if (!apiKey) return { ...base, provider: null, mnotify: null, problem: "MNOTIFY_API_KEY is not set" };
    if (!senderId || !SENDER_ID_PATTERN.test(senderId)) return { ...base, provider: null, mnotify: null, problem: "MNOTIFY_SENDER_ID is missing or not 1-11 letters/digits" };
    return { ...base, provider: "mnotify", mnotify: { apiKey, senderId }, problem: null };
}

/** True when SMS is genuinely able to go out (used by the access contract and the reminder settings). */
export function smsAvailable(env: Env = process.env): boolean {
    const c = readSmsConfig(env);
    if (c.problem) return false;
    if (c.demoMode && c.demoAllowlist.length === 0) return false;
    return true;
}
