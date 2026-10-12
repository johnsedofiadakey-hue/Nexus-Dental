#!/usr/bin/env tsx
/**
 * Generate the backup encryption key pair - ONCE, on the owner's own machine.
 *
 *   npm run backup:keygen -- --out ~/offline/clinic-backup.key
 *
 * Writes the PRIVATE key to --out (mode 0600; refuses an existing file and refuses
 * any path inside this repository) and prints only the PUBLIC key, which is the
 * value for BACKUP_AGE_RECIPIENT. The private key is never printed. Store it
 * offline (password manager + a paper copy); lose it and every backup is
 * unreadable, expose it and every backup is readable.
 */
import fs from "fs";
import path from "path";
import { parseArgs } from "node:util";
import { generateKeyPair } from "../src/lib/backup/crypto";

const ROOT = path.resolve(__dirname, "..");

async function main(): Promise<number> {
    const out = parseArgs({ options: { out: { type: "string" } }, allowPositionals: false }).values.out;
    if (!out) {
        console.error("Usage: npm run backup:keygen -- --out <path outside the repository>");
        return 2;
    }
    const target = path.resolve(out.replace(/^~(?=$|\/)/, process.env.HOME ?? "~"));
    if (target.startsWith(ROOT + path.sep)) {
        console.error("Refusing: the private key must be stored outside the repository.");
        return 2;
    }
    if (fs.existsSync(target)) {
        console.error("Refusing: that file already exists. Overwriting a key would make existing backups unreadable.");
        return 2;
    }
    const { identity, recipient } = await generateKeyPair();
    fs.writeFileSync(target, identity + "\n", { mode: 0o600, flag: "wx" });
    console.log(`Private key written to ${target} (mode 600). Store it offline; never put it in CI, the app or git.`);
    console.log("\nPublic key - set this as the BACKUP_AGE_RECIPIENT secret:\n");
    console.log(recipient);
    return 0;
}
main().then((c) => process.exit(c), () => { console.error("Key generation failed."); process.exit(1); });
