// ============================================
// NEXUS DENTAL — Is SMS reminding switched on for this clinic?
//
// The clinic's own setting (TenantSettings.featureFlags: enableSmsReminders, absent = on)
// AND a working SMS provider on this deployment. Booking and the worker both ask THIS
// function, so a switched-off clinic never sends and never pretends to schedule.
// ============================================

import prisma from "@/lib/db/prisma";
import type { CapabilityState } from "@/contracts/access";
import { resolveModules, resolveProviders } from "@/lib/config/features";
import { readSmsConfig, smsAvailable, type Env } from "@/lib/sms/config";

export async function smsRemindersState(tenantId: string, env: Env = process.env): Promise<CapabilityState> {
    const settings = await prisma.tenantSettings.findUnique({ where: { tenantId }, select: { featureFlags: true } });
    const modules = resolveModules(settings?.featureFlags, env);
    if (!modules.smsReminders.enabled) return modules.smsReminders;
    // resolveModules checks ENABLED_FEATURES + credentials; also require a usable demo allowlist.
    if (!smsAvailable(env)) return { enabled: false, reason: "PROVIDER_UNAVAILABLE" };
    return { enabled: true };
}

/** Provider availability for the contract/readiness output: names only, never values. */
export function smsProviderStatus(env: Env = process.env): { provider: "mnotify" | "console" | null; configured: boolean; demoMode: boolean; allowlistSize: number } {
    const c = readSmsConfig(env);
    return { provider: c.provider, configured: smsAvailable(env), demoMode: c.demoMode, allowlistSize: c.demoAllowlist.length };
}

export { resolveProviders };
