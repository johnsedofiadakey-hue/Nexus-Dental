// ============================================
// NEXUS DENTAL — Analytics calculation rules
//
// Pure functions (no database) so the definitions of "revenue", "month" and
// "growth" are written down in one place and covered by tests.
// ============================================

/** Round to 2 decimal places (money). */
export function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/**
 * Sum invoice totals, rounded to 2 decimals. Ignores values that are not finite
 * numbers so one bad row cannot turn a whole dashboard into NaN.
 */
export function sumAmounts(rows: ReadonlyArray<{ totalAmount: number | null | undefined }>): number {
    let total = 0;
    for (const row of rows) {
        const v = Number(row.totalAmount);
        if (Number.isFinite(v)) total += v;
    }
    return round2(total);
}

/**
 * Percentage change from `previous` to `current`, rounded to 1 decimal.
 * Returns 0 when there is no previous value to compare against (0 -> anything),
 * rather than Infinity or a misleading 100%.
 */
export function percentChange(current: number, previous: number): number {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Calendar-month boundaries around `now`. Ranges are half-open
 * ([start, end)) so no instant is dropped or counted twice at a boundary.
 */
export function monthBounds(now: Date = new Date()) {
    const y = now.getFullYear();
    const m = now.getMonth();
    return {
        prevStart: new Date(y, m - 1, 1),
        start: new Date(y, m, 1),
        nextStart: new Date(y, m + 1, 1),
    };
}

/**
 * Prisma `where` for invoices that count as REVENUE received in [from, to).
 *
 * Revenue is money actually received: status PAID only (unpaid, refunded and
 * cancelled invoices are excluded). It is attributed to the month it was paid;
 * older PAID records that never got a paidAt fall back to their creation date.
 */
export function paidInRange(from: Date, to: Date) {
    return {
        status: "PAID",
        OR: [
            { paidAt: { gte: from, lt: to } },
            { paidAt: null, createdAt: { gte: from, lt: to } },
        ],
    };
}
