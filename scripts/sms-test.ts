#!/usr/bin/env tsx
/**
 * Send ONE real test SMS through the provider-neutral service, to prove the sender works before a demo.
 *
 *   SMS_PROVIDER=mnotify MNOTIFY_API_KEY=… MNOTIFY_SENDER_ID=… \
 *   DEMO_MODE=true DEMO_SMS_ALLOWLIST=+233… \
 *   npm run sms:test -- --to <a number on the allowlist> --confirm-send
 *
 * Makes a real network call ONLY with --confirm-send. In demo mode it can only ever text a number on
 * DEMO_SMS_ALLOWLIST. Prints the provider's campaign id and status ("SENT" = accepted by the provider,
 * NOT delivered); never prints the key, the request URL or the full phone number. Check the handset.
 *
 * Exit codes: 0 accepted by the provider · 1 failed or refused · 2 bad usage
 */
import { parseArgs } from "node:util";
import { maskPhone } from "../src/lib/phone";
import { SmsError, sendSms } from "../src/lib/sms";
import { readSmsConfig } from "../src/lib/sms/config";

async function main(): Promise<number> {
    let values;
    try {
        values = parseArgs({ options: { to: { type: "string" }, "confirm-send": { type: "boolean", default: false } }, allowPositionals: false }).values;
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        return 2;
    }
    if (!values.to) {
        console.error("Usage: sms:test --to <number> --confirm-send");
        return 2;
    }
    const cfg = readSmsConfig();
    console.log(`provider: ${cfg.provider ?? "none"}   demo mode: ${cfg.demoMode ? `on (${cfg.demoAllowlist.length} approved number(s))` : "off"}   to: ${maskPhone(values.to)}`);
    if (!values["confirm-send"]) {
        console.log("Dry run: nothing was sent. Add --confirm-send to send one real SMS.");
        return 0;
    }
    try {
        const r = await sendSms(values.to, "Test message from your clinic system. If you received this, SMS sending works. No action needed.");
        console.log(`ACCEPTED by ${r.provider}: campaign ${r.providerMessageId}, status ${r.status}. (Delivery is not tracked: check the handset.)`);
        return 0;
    } catch (error) {
        if (error instanceof SmsError) console.error(`NOT SENT [${error.code}]: ${error.message}`);
        else console.error("NOT SENT: unexpected error");
        return 1;
    }
}
main().then((c) => { process.exitCode = c; });
