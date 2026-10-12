#!/usr/bin/env node
/**
 * Run the database-backed provisioning tests against a DISPOSABLE database.
 *
 *   TEST_DATABASE_ADMIN_URL=postgresql://user@127.0.0.1:5432/postgres npm run test:provision
 *
 * 1. creates a brand-new database named nexus_c1_test_<timestamp>_<random>
 * 2. applies the committed migrations with `prisma migrate deploy` (a real clean install)
 * 3. runs the database-backed suites (tests/provision.integration.test.ts and
 *    tests/sessions.integration.test.ts, tests/backup.integration.test.ts and
 *    tests/demo.integration.test.ts) against it
 * 4. drops it again — only ever a database this script created
 *
 * Safety: the admin URL must point at localhost; it never touches any other
 * database on that server, and it deliberately ignores the repo's .env.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS script, like the other scripts/*.js */
const { spawnSync } = require("child_process");
const crypto = require("crypto");
const { Client } = require("pg");

const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
if (!adminUrl) {
  console.error("TEST_DATABASE_ADMIN_URL is not set (a local postgres URL that is allowed to CREATE DATABASE).");
  process.exit(2);
}

let admin;
try {
  admin = new URL(adminUrl);
} catch {
  console.error("TEST_DATABASE_ADMIN_URL is not a valid URL.");
  process.exit(2);
}
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(admin.hostname)) {
  console.error("Refusing to run: TEST_DATABASE_ADMIN_URL must point at localhost. Disposable test databases are never created on remote servers.");
  process.exit(2);
}

const dbName = `nexus_c1_test_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${dbName}`;

async function withAdmin(sql) {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

function run(args, extraEnv) {
  return spawnSync("npx", args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  }).status;
}

(async () => {
  let exitCode = 1;
  await withAdmin(`CREATE DATABASE "${dbName}"`);
  console.log(`Created disposable database ${dbName}`);
  try {
    // DATABASE_URL in the environment takes precedence over the repo's .env.
    const migrate = run(["prisma", "migrate", "deploy"], { DATABASE_URL: testUrl.toString() });
    if (migrate !== 0) {
      console.error("`prisma migrate deploy` failed on the empty database — a clean install is broken.");
      exitCode = migrate || 1;
    } else {
      exitCode = run(["vitest", "run", "--no-file-parallelism", "tests/provision.integration.test.ts", "tests/sessions.integration.test.ts", "tests/backup.integration.test.ts", "tests/demo.integration.test.ts"], {
        TEST_DATABASE_URL: testUrl.toString(),
        DATABASE_URL: testUrl.toString(),
      }) ?? 1;
    }
  } finally {
    if (dbName.startsWith("nexus_c1_test_")) {
      await withAdmin(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      console.log(`Dropped disposable database ${dbName}`);
    }
  }
  process.exit(exitCode);
})().catch((error) => {
  console.error("test:provision failed:", error.message);
  process.exit(1);
});
