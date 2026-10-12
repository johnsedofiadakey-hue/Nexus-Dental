// ============================================
// NEXUS DENTAL — Operational alerts
//
// One place that tells a human something operational is wrong (backup failed,
// worker stopped, jobs dead-lettering). Alerts are:
//   * rate-limited per condition and DURABLE (ops_alert_states), so a stuck failure
//     cannot flood anyone and a restart cannot reset the limit
//   * decided ATOMICALLY: the rate limit and the "someone is already sending" lease
//     are a single conditional UPDATE, never read-then-write, so two replicas
//     evaluating the same condition at the same instant send at most one message
//   * never holding a database transaction open across the e-mail call: the claim is
//     a short lease that is released if delivery fails (so the next check retries) and
//     expires by itself if the sender dies
//   * free of secrets, tokens and patient data - callers pass short plain text
//   * honest about delivery: the result says whether it was sent, suppressed, or could
//     not be sent because no recipient or no e-mail provider is configured
// ============================================

import { randomUUID } from "crypto";
import prisma from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/sender";

export type AlertOutcome = "sent" | "suppressed" | "unconfigured" | "failed";

export const DEFAULT_ALERT_INTERVAL_HOURS = 6;
/** How long a sender may hold the claim before another replica may take over (a send takes seconds). */
export const ALERT_CLAIM_LEASE_MS = 5 * 60_000;

export function alertRecipients(env: Record<string, string | undefined> = process.env): string[] {
    return (env.ALERT_EMAIL_TO ?? "")
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function sendOpsAlert(
    condition: string,
    subject: string,
    body: string,
    opts: { now?: Date; minIntervalHours?: number; env?: Record<string, string | undefined> } = {}
): Promise<AlertOutcome> {
    const now = opts.now ?? new Date();
    const env = opts.env ?? process.env;
    const recipients = alertRecipients(env);
    if (recipients.length === 0) {
        console.error(`[Alert] ${condition}: ALERT_EMAIL_TO is not configured - nobody was told: ${subject}`);
        return "unconfigured";
    }
    // sendEmail() only logs to the console when there is no provider key; calling that "sent" would be a lie.
    if (!env.RESEND_API_KEY) {
        console.error(`[Alert] ${condition}: RESEND_API_KEY is not configured - nobody was told: ${subject}`);
        return "unconfigured";
    }

    const intervalMs = (opts.minIntervalHours ?? DEFAULT_ALERT_INTERVAL_HOURS) * 3600_000;
    const sentBefore = new Date(now.getTime() - intervalMs);
    const leaseBefore = new Date(now.getTime() - ALERT_CLAIM_LEASE_MS);
    const token = randomUUID();

    // 1. Claim the slot in ONE atomic statement: allowed only if the last send is older than the
    //    interval AND nobody holds a live lease. Concurrent callers: exactly one UPDATE matches.
    try {
        await prisma.opsAlertState.createMany({ data: [{ condition }], skipDuplicates: true });
        const claim = await prisma.opsAlertState.updateMany({
            where: {
                condition,
                AND: [
                    { OR: [{ lastSentAt: null }, { lastSentAt: { lte: sentBefore } }] },
                    { OR: [{ claimedAt: null }, { claimedAt: { lte: leaseBefore } }] },
                ],
            },
            data: { claimedAt: now, claimToken: token },
        });
        if (claim.count !== 1) return "suppressed";
    } catch (error) {
        console.error(`[Alert] ${condition}: could not evaluate rate limit:`, error instanceof Error ? error.message : "unknown");
        return "failed";
    }

    // 2. Send with no transaction open. Delivered to at least one recipient counts as sent.
    const release = () =>
        prisma.opsAlertState
            .updateMany({ where: { condition, claimToken: token }, data: { claimedAt: null, claimToken: null } })
            .catch((e: Error) => console.error(`[Alert] ${condition}: could not release the claim:`, e.message));

    const html = `<p>${escapeHtml(body)}</p><p style="color:#666;font-size:12px">Automated operational alert (${escapeHtml(condition)}).</p>`;
    const results = await Promise.allSettled(recipients.map((to) => sendEmail({ to, subject: `[Nexus Dental] ${subject}`, html })));
    const delivered = results.filter((r) => r.status === "fulfilled").length;
    if (delivered === 0) {
        const reason = (results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined)?.reason;
        console.error(`[Alert] ${condition}: sending failed:`, reason instanceof Error ? reason.message : "unknown");
        await release(); // the next check may try again instead of staying silent for hours
        return "failed";
    }
    if (delivered < recipients.length) console.error(`[Alert] ${condition}: delivered to ${delivered} of ${recipients.length} recipients`);

    // 3. Record the send and drop the lease. If this fails the e-mail still went out; the lease
    //    simply expires and a later check may send once more - preferable to silence.
    try {
        await prisma.opsAlertState.updateMany({ where: { condition, claimToken: token }, data: { lastSentAt: now, claimedAt: null, claimToken: null } });
    } catch (error) {
        console.error(`[Alert] ${condition}: sent, but could not record it:`, error instanceof Error ? error.message : "unknown");
    }
    return "sent";
}
