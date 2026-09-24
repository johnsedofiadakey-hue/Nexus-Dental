#!/usr/bin/env node
/**
 * Create a temporary CLINIC_OWNER account with a random one-time password.
 *
 * Use this to get a working login after the seeded accounts were locked, until
 * real staff are onboarded through the invitation flow. It never overwrites an
 * existing account and prints the password exactly once.
 *
 *   node scripts/ops/create-placeholder-owner.js [email]
 *
 * Default email: placeholder-owner@nexusdental.app
 * The clinic is taken from CLINIC_ID. Change the password after first sign-in
 * and delete/suspend this account once real owners exist.
 */
require("dotenv").config({ quiet: true });
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const email = (process.argv[2] || "placeholder-owner@nexusdental.app").toLowerCase().trim();
const tenantId = process.env.CLINIC_ID;

if (!tenantId) {
  console.error("CLINIC_ID is not set; refusing to guess which clinic to create the account in.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Meets the app's password policy (upper, lower, digit, special, >= 8).
function generatePassword() {
  const core = crypto.randomBytes(12).toString("base64url");
  return `${core}Aa1!`;
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) {
    console.error(`No tenant found with id "${tenantId}".`);
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    console.error(`An account for ${email} already exists. Nothing was changed.`);
    process.exit(1);
  }

  const password = generatePassword();
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      firstName: "Placeholder",
      lastName: "Owner",
      status: "ACTIVE",
      tenantId: tenant.id,
      roles: { create: { systemRole: "CLINIC_OWNER" } },
    },
    select: { id: true },
  });

  console.log(`Created CLINIC_OWNER for "${tenant.name}" (id ${user.id})`);
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log("Shown once. Change it after signing in.");
}

main()
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
