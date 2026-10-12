// ============================================
// NEXUS DENTAL — Canonical phone numbers
//
// ONE normalizer for the whole backend. A phone number is stored, compared and
// de-duplicated in E.164 (`+233244123456`); only the SMS provider adapter converts it
// to whatever its API wants. Ghana (+233) is the default country, but a valid
// international number is never rewritten as a Ghanaian one.
//
//   "0244123456"      -> +233244123456      local Ghana
//   "244123456"       -> +233244123456      local Ghana, leading 0 dropped
//   "233244123456"    -> +233244123456
//   "+233 24 412 3456"-> +233244123456
//   "00233244123456"  -> +233244123456      international prefix
//   "+447911123456"   -> +447911123456      valid international: untouched
//   "+2330244123456"  -> rejected           trunk 0 after the country code is a typo, not a number
// ============================================

export interface PhoneOk {
    ok: true;
    /** Canonical form, e.g. +233244123456. Store and compare this. */
    e164: string;
    /** ISO-ish country calling code without '+', e.g. "233". */
    countryCode: string;
}
export interface PhoneBad {
    ok: false;
    reason: "EMPTY" | "INVALID_CHARACTERS" | "TOO_SHORT" | "TOO_LONG" | "BAD_GHANA_NUMBER" | "UNSUPPORTED_FORMAT";
}
export type PhoneResult = PhoneOk | PhoneBad;

const GH = "233";
const GHANA_NATIONAL_LENGTH = 9; // after +233, no trunk 0

export function normalizePhone(raw: unknown): PhoneResult {
    if (typeof raw !== "string" || raw.trim() === "") return { ok: false, reason: "EMPTY" };
    let s = raw.trim();
    if (/[^\d\s().+-]/.test(s)) return { ok: false, reason: "INVALID_CHARACTERS" };
    // '+' is only meaningful as the very first character (once spaces and brackets are ignored).
    if (s.replace(/[\s().-]/g, "").lastIndexOf("+") > 0) return { ok: false, reason: "INVALID_CHARACTERS" };
    s = s.replace(/[\s().-]/g, "");

    const hadPlus = s.startsWith("+");
    let digits = s.replace(/\D/g, "");
    if (digits.length === 0) return { ok: false, reason: "EMPTY" };

    if (!hadPlus && digits.startsWith("00")) {
        digits = digits.slice(2);
        s = "+" + digits;
    } else if (hadPlus) {
        s = "+" + digits;
    }
    const international = hadPlus || raw.trim().replace(/\D/g, "").startsWith("00");

    if (international) return finish(digits);

    // No '+' / '00' prefix: local Ghana forms, or Ghana with the country code already typed.
    if (digits.startsWith("0")) {
        const national = digits.slice(1);
        if (national.length !== GHANA_NATIONAL_LENGTH) return { ok: false, reason: national.length < GHANA_NATIONAL_LENGTH ? "TOO_SHORT" : "TOO_LONG" };
        return finish(GH + national);
    }
    if (digits.startsWith(GH) && digits.length === GH.length + GHANA_NATIONAL_LENGTH) return finish(digits);
    if (digits.length === GHANA_NATIONAL_LENGTH) return finish(GH + digits);
    return { ok: false, reason: "UNSUPPORTED_FORMAT" };
}

function finish(digits: string): PhoneResult {
    if (digits.length < 8) return { ok: false, reason: "TOO_SHORT" };
    if (digits.length > 15) return { ok: false, reason: "TOO_LONG" };
    if (digits.startsWith(GH)) {
        const national = digits.slice(GH.length);
        if (national.length !== GHANA_NATIONAL_LENGTH || national.startsWith("0")) return { ok: false, reason: "BAD_GHANA_NUMBER" };
        return { ok: true, e164: `+${digits}`, countryCode: GH };
    }
    if (digits.startsWith("0")) return { ok: false, reason: "UNSUPPORTED_FORMAT" };
    // Country code length is 1-3 digits; E.164 does not let us split it without a table, so record the leading digits only.
    return { ok: true, e164: `+${digits}`, countryCode: digits.startsWith("1") || digits.startsWith("7") ? digits.slice(0, 1) : digits.slice(0, 3) };
}

/** Convenience: the E.164 string or null. */
export function toE164(raw: unknown): string | null {
    const r = normalizePhone(raw);
    return r.ok ? r.e164 : null;
}

/**
 * Every spelling an existing record might have been stored with, for LOOKUPS only
 * (older code stored +233…, 0…, or bare 24…). Never write these; write the E.164.
 */
export function phoneLookupVariants(raw: unknown): string[] {
    const r = normalizePhone(raw);
    if (!r.ok) return [];
    const digits = r.e164.slice(1);
    const variants = new Set<string>([r.e164, digits]);
    if (digits.startsWith(GH)) {
        const national = digits.slice(GH.length);
        variants.add(`0${national}`);
        variants.add(national);
    }
    return [...variants];
}

/** Masked for logs and error messages: +23324****56. Never log the full number. */
export function maskPhone(raw: unknown): string {
    const digits = typeof raw === "string" ? raw.replace(/\D/g, "") : "";
    if (digits.length < 6) return "***";
    return `+${digits.slice(0, 5)}****${digits.slice(-2)}`;
}
