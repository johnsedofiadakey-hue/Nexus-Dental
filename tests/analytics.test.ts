import { beforeEach, describe, expect, it, vi } from "vitest";
import { monthBounds, paidInRange, percentChange, round2, sumAmounts } from "@/lib/services/analytics.math";

const { db } = vi.hoisted(() => {
    const fn = () => vi.fn();
    const db: any = {
        tenant: { findMany: fn() },
        patient: { count: fn() },
        appointment: { findMany: fn(), count: fn() },
        invoice: { findMany: fn(), groupBy: fn() },
        user: { count: fn() },
    };
    return { db };
});
vi.mock("@/lib/db/prisma", () => ({ default: db, prisma: db }));

import { getPlatformStats, getClinicStats, getTenantStats } from "@/lib/services/analytics.service";

describe("money helpers", () => {
    it("rounds to 2 decimals without floating point drift", () => {
        expect(round2(0.1 + 0.2)).toBe(0.3);
        expect(round2(10.005 * 100) / 100).toBeCloseTo(10.01, 1);
    });

    it("sums invoice totals and ignores rows that are not numbers", () => {
        expect(sumAmounts([{ totalAmount: 100.1 }, { totalAmount: 50.2 }])).toBe(150.3);
        expect(sumAmounts([{ totalAmount: 10 }, { totalAmount: null }, { totalAmount: NaN }, { totalAmount: undefined }])).toBe(10);
        expect(sumAmounts([])).toBe(0);
    });
});

describe("percentChange", () => {
    it("computes growth and decline", () => {
        expect(percentChange(150, 100)).toBe(50);
        expect(percentChange(50, 100)).toBe(-50);
        expect(percentChange(100, 100)).toBe(0);
    });

    it("rounds to one decimal", () => {
        expect(percentChange(1, 3)).toBe(-66.7);
    });

    it("returns 0 — not Infinity or a fake 100% — when there is no previous value", () => {
        expect(percentChange(500, 0)).toBe(0);
        expect(percentChange(0, 0)).toBe(0);
    });

    it("never returns NaN or Infinity for bad input", () => {
        expect(percentChange(NaN, 10)).toBe(0);
        expect(percentChange(10, Infinity)).toBe(0);
    });
});

describe("monthBounds", () => {
    it("returns half-open calendar month boundaries", () => {
        const b = monthBounds(new Date(2026, 8, 15, 13, 30)); // 15 Sep 2026
        expect(b.prevStart).toEqual(new Date(2026, 7, 1));
        expect(b.start).toEqual(new Date(2026, 8, 1));
        expect(b.nextStart).toEqual(new Date(2026, 9, 1));
    });

    it("rolls across the year boundary", () => {
        const jan = monthBounds(new Date(2026, 0, 10));
        expect(jan.prevStart).toEqual(new Date(2025, 11, 1));
        const dec = monthBounds(new Date(2026, 11, 31));
        expect(dec.nextStart).toEqual(new Date(2027, 0, 1));
    });
});

describe("paidInRange (what counts as revenue)", () => {
    const from = new Date(2026, 8, 1);
    const to = new Date(2026, 9, 1);

    it("only ever includes PAID invoices", () => {
        expect(paidInRange(from, to).status).toBe("PAID");
    });

    it("attributes to the paid date, falling back to creation date only when never paid-dated", () => {
        const { OR } = paidInRange(from, to);
        expect(OR[0]).toEqual({ paidAt: { gte: from, lt: to } });
        expect(OR[1]).toEqual({ paidAt: null, createdAt: { gte: from, lt: to } });
    });

    it("uses an exclusive end so the first instant of next month is not counted", () => {
        expect((paidInRange(from, to).OR[0] as any).paidAt.lt).toEqual(to);
    });
});

describe("platform stats", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    function arrange({ thisMonthPaid, lastMonthPaid, allPaid }: { thisMonthPaid: number[]; lastMonthPaid: number[]; allPaid: number[] }) {
        db.tenant.findMany.mockResolvedValue([{ id: "a", status: "ACTIVE" }, { id: "b", status: "FROZEN" }]);
        db.patient.count.mockResolvedValueOnce(40).mockResolvedValueOnce(6).mockResolvedValueOnce(4);
        db.appointment.findMany.mockResolvedValue([{ status: "COMPLETED" }, { status: "COMPLETED" }, { status: "SCHEDULED" }, { status: "CANCELLED" }]);
        const rows = (xs: number[]) => xs.map((totalAmount) => ({ totalAmount }));
        db.invoice.findMany.mockImplementation(async ({ where }: any) => {
            if (where.OR) {
                // The month queries: distinguish by their range start.
                const from: Date = where.OR[0].paidAt.gte;
                const isThisMonth = from.getTime() === monthBounds().start.getTime();
                return rows(isThisMonth ? thisMonthPaid : lastMonthPaid);
            }
            return rows(allPaid);
        });
    }

    it("reports revenue only from paid invoices, with real monthly figures and growth", async () => {
        arrange({ allPaid: [300, 200, 100], thisMonthPaid: [150, 150], lastMonthPaid: [200] });
        const s = await getPlatformStats();
        expect(s.totalRevenue).toBe(600);
        expect(s.monthlyRevenue).toBe(300);
        expect(s.revenueGrowth).toBe(50); // 300 vs 200
        expect(s.patientGrowth).toBe(50); // 6 new vs 4 last month
        expect(s.activePatients).toBe(40);
    });

    it("only asks the database for PAID invoices for the all-time total (unpaid/refunded excluded)", async () => {
        arrange({ allPaid: [10], thisMonthPaid: [], lastMonthPaid: [] });
        await getPlatformStats();
        const allTimeCall = db.invoice.findMany.mock.calls.find(([a]: any) => !a.where.OR)![0];
        expect(allTimeCall.where).toEqual({ status: "PAID" });
    });

    it("does not count soft-deleted patients as active", async () => {
        arrange({ allPaid: [], thisMonthPaid: [], lastMonthPaid: [] });
        await getPlatformStats();
        for (const [args] of db.patient.count.mock.calls) {
            expect(args.where.deletedAt).toBeNull();
        }
    });

    it("computes completion rate and tenant counts", async () => {
        arrange({ allPaid: [], thisMonthPaid: [], lastMonthPaid: [] });
        const s = await getPlatformStats();
        expect(s.completionRate).toBe(50);
        expect(s.totalTenants).toBe(2);
        expect(s.activeTenants).toBe(1);
    });

    it("shows 0 growth, not a fake 100%, when last month had no revenue", async () => {
        arrange({ allPaid: [500], thisMonthPaid: [500], lastMonthPaid: [] });
        expect((await getPlatformStats()).revenueGrowth).toBe(0);
    });

    it("falls back to zeros if the database fails, rather than crashing the dashboard", async () => {
        db.tenant.findMany.mockRejectedValue(new Error("db down"));
        const s = await getPlatformStats();
        expect(s.totalRevenue).toBe(0);
        expect(s.totalTenants).toBe(0);
    });
});

describe("clinic stats", () => {
    beforeEach(() => vi.clearAllMocks());

    it("scopes revenue to the clinic and to PAID invoices", async () => {
        db.patient.count.mockResolvedValue(12);
        db.appointment.count.mockResolvedValueOnce(10).mockResolvedValueOnce(8);
        db.user.count.mockResolvedValue(5);
        db.invoice.findMany.mockImplementation(async ({ where }: any) => {
            expect(where.tenantId).toBe("tenant-a");
            expect(where.status).toBe("PAID");
            return [{ totalAmount: where.OR ? 120 : 480 }];
        });
        const s = await getClinicStats("tenant-a");
        expect(s).toMatchObject({ totalPatients: 12, totalStaff: 5, completionRate: 80, revenue: 480, monthlyRevenue: 120 });
    });
});

describe("tenant stats", () => {
    it("reports each tenant's own paid revenue and 0 for tenants with none", async () => {
        db.tenant.findMany.mockResolvedValue([
            { id: "a", name: "A", _count: { patients: 3, appointments: 9 } },
            { id: "b", name: "B", _count: { patients: 1, appointments: 2 } },
        ]);
        db.invoice.groupBy.mockResolvedValue([{ tenantId: "a", _sum: { totalAmount: 1234.5 } }]);
        const rows = await getTenantStats();
        expect(rows.find((r) => r.tenantId === "a")!.revenue).toBe(1234.5);
        expect(rows.find((r) => r.tenantId === "b")!.revenue).toBe(0);
        expect(db.invoice.groupBy.mock.calls[0][0].where.status).toBe("PAID");
    });
});
