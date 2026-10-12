// ============================================
// NEXUS DENTAL — Explicit time zones
//
// Appointment times are entered as wall-clock values in the CLINIC's time zone
// ("2026-10-12" + "14:30" in Africa/Accra) and stored as UTC instants. Nothing here
// reads the host machine's time zone, so a server in any region produces the same answer.
// ============================================

export const DEFAULT_CLINIC_TIME_ZONE = "Africa/Accra";

export function isValidTimeZone(zone: unknown): zone is string {
    if (typeof zone !== "string" || zone === "") return false;
    try {
        new Intl.DateTimeFormat("en", { timeZone: zone });
        return true;
    } catch {
        return false;
    }
}

/** The zone to use for a clinic: its configured IANA zone, else the Ghana default. */
export function clinicTimeZone(configured: unknown): string {
    return isValidTimeZone(configured) ? configured : DEFAULT_CLINIC_TIME_ZONE;
}

/** Offset (ms) of `zone` from UTC at the given instant: positive east of Greenwich. */
function zoneOffsetMs(instant: Date, zone: string): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(instant);
    const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Convert a wall-clock date ("YYYY-MM-DD") and time ("HH:mm") in `zone` to the UTC instant.
 * Returns null for a malformed or non-existent local time.
 */
export function zonedWallTimeToUtc(date: string, time: string, zone: string): Date | null {
    const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const t = /^(\d{1,2}):(\d{2})$/.exec(time);
    if (!d || !t || !isValidTimeZone(zone)) return null;
    const [y, mo, da, h, mi] = [Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2])];
    if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59) return null;
    const naive = Date.UTC(y, mo - 1, da, h, mi);
    // Two passes handle zones whose offset changes across the instant (DST).
    let guess = naive - zoneOffsetMs(new Date(naive), zone);
    guess = naive - zoneOffsetMs(new Date(guess), zone);
    const result = new Date(guess);
    // Reject impossible dates that JS silently rolled over (e.g. 2026-02-31).
    const back = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(result);
    return back === date ? result : null;
}

/** "Monday 12 October 2026" and "14:30" in the clinic's zone, for message text. */
export function formatInZone(instant: Date, zone: string): { date: string; time: string } {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: zone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).formatToParts(instant);
    const part = (t: string) => p.find((x) => x.type === t)?.value ?? "";
    return {
        date: `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`,
        time: new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant),
    };
}
