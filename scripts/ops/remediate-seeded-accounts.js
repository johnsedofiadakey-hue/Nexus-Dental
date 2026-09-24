#!/usr/bin/env node
/**
 * Post-incident remediation for accounts created by the old seed script.
 *
 * The seed script used to hard-code passwords that were also written in the
 * README, so any live account still using one of them is effectively public.
 * This tool:
 *
 *   1. Finds active users whose password hash still matches a known seed
 *      password (bcrypt comparison — no plaintext is ever stored or read back).
 *   2. With --apply: replaces each such password with a fresh random one and
 *      prints it ONCE so the owner can hand it over securely.
 *   3. Finds audit_logs rows whose old/new value contains a password hash
 *      (written by the old audit extension) and redacts those fields.
 *
 * SAFE BY DEFAULT: without --apply it only reports what it WOULD change and
 * writes nothing.
 *
 *   node scripts/ops/remediate-seeded-accounts.js            # dry run
 *   node scripts/ops/remediate-seeded-accounts.js --apply    # make the changes
 *
 * IMPORTANT — this does not by itself sign anyone out. Existing sessions remain
 * valid until they expire (24h staff / 30d patients). To force every session to
 * end immediately, rotate JWT_SECRET in Secret Manager and redeploy:
 *
 *   firebase apphosting:secrets:set JWT_SECRET --project nexusdentalsystem
 *   firebase deploy --only apphosting --project nexusdentalsystem
 */
require("dotenv").config();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const APPLY = process.argv.includes("--apply");

// Passwords that were previously committed to the repository.
const KNOWN_SEED_PASSWORDS = ["dev123", "admin123", "staff123", "doc123", "doctor123"];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function host() {
  try {
    return new URL(process.env.DATABASE_URL).host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

function redactHashes(value) {
  if (value === null || typeof value !== "object") return { value, changed: false };
  let changed = false;
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      const out = {};
      for (const [k, v] of Object.entries(node)) {
        if (/password/i.test(k)) {
          out[k] = "[REDACTED]";
          changed = true;
        } else {
          out[k] = walk(v);
        }
      }
      return out;
    }
    return node;
  };
  return { value: walk(value), changed };
}

async function main() {
  console.log(`Database host: ${host()}`);
  console.log(APPLY ? "MODE: --apply (WILL WRITE)\n" : "MODE: dry run (no writes)\n");

  // ── 1. Accounts still using a known seed password ──────────────────────
  const users = await prisma.user.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: { id: true, email: true, passwordHash: true, roles: { select: { systemRole: true } } },
  });

  const affected = [];
  for (const u of users) {
    for (const candidate of KNOWN_SEED_PASSWORDS) {
      if (await bcrypt.compare(candidate, u.passwordHash)) {
        affected.push(u);
        break;
      }
    }
  }

  console.log(`Active accounts using a known seed password: ${affected.length}`);
  for (const u of affected) {
    const roles = u.roles.map((r) => r.systemRole).filter(Boolean).join(", ") || "no role";
    console.log(`  - ${u.email}  [${roles}]`);
  }

  const issued = [];
  if (APPLY) {
    for (const u of affected) {
      const fresh = crypto.randomBytes(18).toString("base64url");
      const hash = await bcrypt.hash(fresh, 12);
      await prisma.user.update({ where: { id: u.id }, data: { passwordHash: hash } });
      issued.push({ email: u.email, password: fresh });
    }
  }

  // ── 2. Audit logs that captured password hashes ────────────────────────
  const logs = await prisma.auditLog.findMany({
    select: { id: true, oldValue: true, newValue: true },
  });

  let dirty = 0;
  for (const log of logs) {
    // The old extension stored JSON.stringify(record) — a string — so parse it first.
    const parse = (v) => {
      if (typeof v !== "string") return v;
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    };
    const oldParsed = parse(log.oldValue);
    const newParsed = parse(log.newValue);
    const o = redactHashes(oldParsed);
    const n = redactHashes(newParsed);
    if (o.changed || n.changed) {
      dirty++;
      if (APPLY) {
        await prisma.auditLog.update({
          where: { id: log.id },
          data: {
            ...(o.changed ? { oldValue: o.value } : {}),
            ...(n.changed ? { newValue: n.value } : {}),
          },
        });
      }
    }
  }
  console.log(`\nAudit log rows containing password fields: ${dirty} of ${logs.length}`);

  if (APPLY && issued.length) {
    console.log("\nNEW PASSWORDS — shown once, store them securely and have each person change theirs:");
    for (const i of issued) console.log(`  ${i.email}: ${i.password}`);
  }

  if (!APPLY) console.log("\nNothing was changed. Re-run with --apply to remediate.");
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
