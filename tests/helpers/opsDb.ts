/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma-shaped stand-ins */
import { vi } from "vitest";
import { memTable } from "./memdb";

/** One shared in-memory "database" for the operations tests (alert state, backup log, dead letters). */
export const ops = {
    alertState: memTable([], { key: "condition", defaults: () => ({ lastSentAt: null, claimedAt: null, claimToken: null }) }),
    backupLog: memTable([], { defaults: () => ({ id: `b${Math.random().toString(16).slice(2)}`, tenantId: null, triggeredBy: "test", encrypted: false, formatVersion: null, sha256: null, filePath: null, fileSize: null, completedAt: null, errorMessage: null }) }),
    failedJob: memTable([], { key: ["queue", "jobId"], defaults: () => ({ retriedAt: null, retryClaimedAt: null, retryClaimToken: null, retryClaimedBy: null, retryError: null, retryAttempts: 0 }) }),
    reset() {
        for (const t of [this.alertState, this.backupLog, this.failedJob]) {
            t.rows.length = 0;
            for (const fn of Object.values(t)) if (typeof fn === "function" && "mockClear" in (fn as any)) (fn as any).mockClear();
        }
        this.queryRaw.mockReset();
        this.queryRaw.mockResolvedValue([1]);
    },
    queryRaw: vi.fn(async () => [1] as unknown[]),
};

export const opsDb: any = {
    opsAlertState: ops.alertState,
    backupLog: ops.backupLog,
    failedJob: ops.failedJob,
    $queryRaw: ops.queryRaw,
};

/** A backup row that satisfies every part of the current proof. Override a field to break exactly one. */
export function validBackupRow(over: Record<string, unknown> = {}, at: Date = new Date()) {
    const day = at.toISOString().slice(0, 10);
    return {
        type: "FULL",
        status: "COMPLETED",
        encrypted: true,
        formatVersion: 1,
        sha256: "a".repeat(64),
        filePath: `daily/${day}/nexus-${day}-${at.getTime()}.dump.age`,
        fileSize: 7_000_000,
        startedAt: new Date(at.getTime() - 60_000),
        completedAt: at,
        ...over,
    };
}

export function validDrillRow(over: Record<string, unknown> = {}, at: Date = new Date()) {
    return {
        type: "RESTORE_DRILL",
        status: "COMPLETED",
        encrypted: true,
        formatVersion: 1,
        sha256: "a".repeat(64),
        filePath: null,
        fileSize: null,
        startedAt: new Date(at.getTime() - 5_000),
        completedAt: at,
        ...over,
    };
}
