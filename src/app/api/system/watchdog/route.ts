// ============================================
// NEXUS DENTAL — System: Operations watchdog
// POST /api/system/watchdog
//
// Called by an EXTERNAL scheduler (.github/workflows/ops-watchdog.yml), never by the
// worker, so the death of the worker is still noticed. Authenticated by its own
// dedicated secret OPS_WATCHDOG_SECRET (header x-ops-watchdog-secret): not a user JWT,
// not the backup callback secret, and not a public endpoint.
//
// 200 = everything healthy. 503 = something needs attention (the response lists WHICH
// conditions, never details), so the scheduled run fails visibly. Alerts are rate-limited,
// so calling this every few minutes does not flood anyone.
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/auth";
import { isUsableSecret, secretMatches } from "@/lib/system/secret";
import { runWatchdog } from "@/lib/system/watchdog";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const secret = process.env.OPS_WATCHDOG_SECRET;
        if (!isUsableSecret(secret)) {
            console.error("[System] OPS_WATCHDOG_SECRET is not configured (or is a placeholder) — rejecting watchdog call");
            return apiError("Not configured", 503);
        }
        if (!secretMatches(request.headers.get("x-ops-watchdog-secret"), secret)) {
            return apiError("Unauthorized", 401);
        }

        const result = await runWatchdog();
        return NextResponse.json(
            { success: result.ok, data: { issues: result.issues, worker: result.worker?.status ?? null, backup: result.backup?.backup ?? null, drill: result.backup?.drill ?? null, deadLetters: result.deadLetters, alerts: result.alerts } },
            { status: result.ok ? 200 : 503 }
        );
    } catch (error) {
        console.error("[System] Watchdog error:", error instanceof Error ? error.message : "unknown");
        return apiError("Internal server error", 500);
    }
}
