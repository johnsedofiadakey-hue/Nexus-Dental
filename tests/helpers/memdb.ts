/* eslint-disable @typescript-eslint/no-explicit-any -- a tiny Prisma-shaped table stand-in */
// A small in-memory table with Prisma-like semantics, so tests can exercise
// CONCURRENCY properly: every operation here is synchronous inside its own
// microtask, which makes `updateMany` genuinely atomic (check-and-set), exactly the
// property the code under test relies on from PostgreSQL's single-statement UPDATE.
import { vi } from "vitest";

type Row = Record<string, any>;

const isDate = (v: unknown): v is Date => v instanceof Date;
const cmp = (a: any, b: any) => (isDate(a) ? a.getTime() : a) - (isDate(b) ? b.getTime() : b);

function matchValue(actual: any, cond: any): boolean {
    if (cond === null) return actual === null || actual === undefined;
    if (cond === undefined) return true;
    if (isDate(cond)) return isDate(actual) && actual.getTime() === cond.getTime();
    if (typeof cond === "object" && !Array.isArray(cond)) {
        return Object.entries(cond).every(([op, v]) => {
            switch (op) {
                case "not": return v === null ? actual !== null && actual !== undefined : !matchValue(actual, v);
                case "in": return (v as any[]).includes(actual);
                case "lte": return actual !== null && actual !== undefined && cmp(actual, v) <= 0;
                case "lt": return actual !== null && actual !== undefined && cmp(actual, v) < 0;
                case "gte": return actual !== null && actual !== undefined && cmp(actual, v) >= 0;
                case "gt": return actual !== null && actual !== undefined && cmp(actual, v) > 0;
                default: throw new Error(`memdb: unsupported operator ${op}`);
            }
        });
    }
    return actual === cond;
}

export function matches(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([k, v]) => {
        if (k === "AND") return (v as Row[]).every((w) => matches(row, w));
        if (k === "OR") return (v as Row[]).some((w) => matches(row, w));
        if (k === "NOT") return !matches(row, v as Row);
        return matchValue(row[k], v);
    });
}

function applyData(row: Row, data: Row) {
    for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === "object" && !isDate(v) && "increment" in (v as Row)) row[k] = (row[k] ?? 0) + (v as Row).increment;
        else row[k] = v;
    }
}

export interface MemTableOptions {
    key?: string | string[]; // unique key field(s)
    defaults?: () => Row;
    /** Run before every write, e.g. to inject a failure. */
    beforeWrite?: (op: string) => void | Promise<void>;
}

export function memTable(rows: Row[] = [], opts: MemTableOptions = {}) {
    const keys = opts.key ? (Array.isArray(opts.key) ? opts.key : [opts.key]) : [];
    const ordered = (list: Row[], orderBy?: Row | Row[]) => {
        const o = (Array.isArray(orderBy) ? orderBy[0] : orderBy) ?? null;
        if (!o) return list;
        const [field, dir] = Object.entries(o)[0] as [string, "asc" | "desc"];
        return [...list].sort((a, b) => (dir === "desc" ? -1 : 1) * cmp(a[field] ?? 0, b[field] ?? 0));
    };
    // Reads return COPIES, like a real database: a row read earlier must not silently change when the
    // table is updated later (that aliasing once hid a missing re-check in the code under test).
    const copy = (row: Row | undefined | null) => (row ? { ...row } : null);
    const locate = (where: Row) => {
        const flat: Row = {};
        for (const [k, v] of Object.entries(where)) Object.assign(flat, v && typeof v === "object" && !isDate(v) && !("not" in (v as Row)) ? v : { [k]: v });
        return rows.find((r) => matches(r, flat));
    };
    const uniqueClash = (row: Row) => keys.length > 0 && rows.some((r) => keys.every((k) => r[k] === row[k]));
    const t = {
        rows,
        findFirst: vi.fn(async (a: any = {}) => copy(ordered(rows.filter((r) => matches(r, a.where)), a.orderBy)[0])),
        findMany: vi.fn(async (a: any = {}) => {
            const list = ordered(rows.filter((r) => matches(r, a.where)), a.orderBy).map((r) => ({ ...r }));
            return a.take ? list.slice(0, a.take) : list;
        }),
        findUnique: vi.fn(async (a: any) => copy(locate(a.where))),
        count: vi.fn(async (a: any = {}) => rows.filter((r) => matches(r, a.where)).length),
        create: vi.fn(async ({ data }: any) => {
            await opts.beforeWrite?.("create");
            const row = { ...(opts.defaults?.() ?? {}), ...data };
            if (uniqueClash(row)) throw Object.assign(new Error("unique violation"), { code: "P2002" });
            rows.push(row);
            return { ...row };
        }),
        createMany: vi.fn(async ({ data, skipDuplicates }: any) => {
            await opts.beforeWrite?.("createMany");
            let count = 0;
            for (const d of data) {
                const row = { ...(opts.defaults?.() ?? {}), ...d };
                if (uniqueClash(row)) { if (skipDuplicates) continue; throw new Error("unique violation"); }
                rows.push(row); count++;
            }
            return { count };
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
            await opts.beforeWrite?.("updateMany");
            // No await between the match and the write: this is the atomic check-and-set.
            const hit = rows.filter((r) => matches(r, where));
            hit.forEach((r) => applyData(r, data));
            return { count: hit.length };
        }),
        upsert: vi.fn(async ({ where, create, update }: any) => {
            await opts.beforeWrite?.("upsert");
            const existing = locate(where);
            if (existing) { applyData(existing, update); return { ...existing }; }
            return t.create({ data: create });
        }),
    };
    return t;
}
