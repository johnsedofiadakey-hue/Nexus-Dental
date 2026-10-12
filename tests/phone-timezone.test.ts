import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone, phoneLookupVariants, toE164 } from "@/lib/phone";
import { clinicTimeZone, formatInZone, isValidTimeZone, zonedWallTimeToUtc } from "@/lib/utils/timezone";

describe("canonical phone normalization", () => {
    it.each([
        ["0244123456", "+233244123456"],
        ["024 412 3456", "+233244123456"],
        ["024-412-3456", "+233244123456"],
        ["244123456", "+233244123456"],
        ["233244123456", "+233244123456"],
        ["+233244123456", "+233244123456"],
        ["+233 24 412 3456", "+233244123456"],
        ["(+233) 244-123-456", "+233244123456"],
        ["00233244123456", "+233244123456"],
        ["  0244123456  ", "+233244123456"],
    ])("%s -> %s (Ghana, every spelling lands on one value)", (raw, expected) => {
        expect(toE164(raw)).toBe(expected);
    });

    it("024… and +23324… are the SAME patient", () => {
        expect(toE164("0244123456")).toBe(toE164("+233244123456"));
        expect(toE164("0244123456")).toBe(toE164("233244123456"));
    });

    it.each([
        ["+447911123456", "+447911123456"],
        ["+44 7911 123456", "+447911123456"],
        ["0044 7911 123456", "+447911123456"],
        ["+14155552671", "+14155552671"],
        ["+2348012345678", "+2348012345678"],
    ])("a valid international number is NEVER rewritten as Ghanaian: %s", (raw, expected) => {
        expect(toE164(raw)).toBe(expected);
    });

    it.each([
        [undefined], [null], [123], [""], ["   "], ["abc"], ["024412345"], ["02441234567"], ["+2330244123456"], ["+233"], ["+233244"],
        ["+1"], ["12345"], ["0244123456 ext 5"], ["+233244123456+1"], ["+++233244123456"], ["0000000000000000"], ["+9999999999999999"],
    ])("rejects %j", (raw) => {
        expect(normalizePhone(raw as unknown).ok).toBe(false);
    });

    it("reports a reason", () => {
        expect(normalizePhone("").ok).toBe(false);
        expect(normalizePhone("0244").ok).toBe(false);
        expect(normalizePhone("abc")).toEqual({ ok: false, reason: "INVALID_CHARACTERS" });
    });

    it("lookup variants cover every way an older record may have been stored", () => {
        const v = phoneLookupVariants("0244123456");
        expect(v).toEqual(expect.arrayContaining(["+233244123456", "233244123456", "0244123456", "244123456"]));
        expect(phoneLookupVariants("+447911123456")).toEqual(expect.arrayContaining(["+447911123456", "447911123456"]));
        expect(phoneLookupVariants("garbage")).toEqual([]);
    });

    it("masks a number for logs and never prints it whole", () => {
        const masked = maskPhone("+233244123456");
        expect(masked).not.toContain("244123456");
        expect(masked).toMatch(/^\+23324\*\*\*\*56$/);
        expect(maskPhone("1")).toBe("***");
    });
});

describe("explicit clinic time zones", () => {
    it("Africa/Accra is UTC: 14:30 local is 14:30Z", () => {
        expect(zonedWallTimeToUtc("2026-10-12", "14:30", "Africa/Accra")?.toISOString()).toBe("2026-10-12T14:30:00.000Z");
    });

    it("does not depend on the host zone: other zones convert by their offset (with DST)", () => {
        expect(zonedWallTimeToUtc("2026-07-01", "09:00", "Europe/London")?.toISOString()).toBe("2026-07-01T08:00:00.000Z"); // BST
        expect(zonedWallTimeToUtc("2026-12-01", "09:00", "Europe/London")?.toISOString()).toBe("2026-12-01T09:00:00.000Z"); // GMT
        expect(zonedWallTimeToUtc("2026-07-01", "09:00", "America/New_York")?.toISOString()).toBe("2026-07-01T13:00:00.000Z");
        expect(zonedWallTimeToUtc("2026-07-01", "09:00", "Asia/Kolkata")?.toISOString()).toBe("2026-07-01T03:30:00.000Z");
    });

    it("rejects malformed and impossible local times", () => {
        for (const [d, t] of [["2026-02-31", "10:00"], ["2026-13-01", "10:00"], ["2026-10-12", "25:00"], ["2026-10-12", "10:60"], ["12/10/2026", "10:00"], ["2026-10-12", "ten"]]) {
            expect(zonedWallTimeToUtc(d, t, "Africa/Accra"), `${d} ${t}`).toBeNull();
        }
        expect(zonedWallTimeToUtc("2026-10-12", "10:00", "Not/AZone")).toBeNull();
    });

    it("formats message text in the clinic zone, not the host's", () => {
        const at = new Date("2026-07-01T08:00:00Z");
        expect(formatInZone(at, "Europe/London")).toEqual({ date: "Wednesday 1 July 2026", time: "09:00" });
        expect(formatInZone(at, "Africa/Accra").time).toBe("08:00");
    });

    it("falls back to Africa/Accra for a missing or invalid zone", () => {
        expect(clinicTimeZone(undefined)).toBe("Africa/Accra");
        expect(clinicTimeZone("nonsense")).toBe("Africa/Accra");
        expect(clinicTimeZone("Europe/London")).toBe("Europe/London");
        expect(isValidTimeZone("Africa/Accra")).toBe(true);
    });
});
