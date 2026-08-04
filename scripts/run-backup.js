// ============================================
// NEXUS DENTAL — Nightly backup runner
// Run by .github/workflows/backup.yml (ubuntu-latest, postgresql-client installed).
// pg_dump -> Firebase Storage -> POST /api/system/backups/complete
//
// Local test: DATABASE_URL=... FIREBASE_SERVICE_ACCOUNT=... FIREBASE_STORAGE_BUCKET=...
//             APP_URL=... BACKUP_WEBHOOK_SECRET=... node scripts/run-backup.js
// ============================================

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[Backup] Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function reportCompletion({ status, filePath, fileSize, startedAt, errorMessage }) {
  const appUrl = requireEnv('APP_URL');
  const secret = requireEnv('BACKUP_WEBHOOK_SECRET');

  const res = await fetch(`${appUrl}/api/system/backups/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Backup-Secret': secret,
    },
    body: JSON.stringify({
      type: 'FULL',
      status,
      filePath,
      fileSize,
      startedAt,
      completedAt: new Date().toISOString(),
      errorMessage,
    }),
  });

  if (!res.ok) {
    // Don't fail the whole job just because the callback failed — the dump itself
    // is what matters most. Log loudly so a broken callback doesn't go unnoticed.
    console.error(`[Backup] Failed to report completion to app (${res.status}): ${await res.text().catch(() => '')}`);
  } else {
    console.log(`[Backup] Reported ${status} to ${appUrl}`);
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const databaseUrl = requireEnv('DATABASE_URL');
  const serviceAccountJson = requireEnv('FIREBASE_SERVICE_ACCOUNT');
  const bucketName = requireEnv('FIREBASE_STORAGE_BUCKET');

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `nexus-${dateStr}-${Date.now()}.dump`;
  const localPath = path.join(os.tmpdir(), fileName);
  const storagePath = `backups/${dateStr}/${fileName}`;

  try {
    console.log('[Backup] Running pg_dump...');
    execFileSync(
      'pg_dump',
      [databaseUrl, '-Fc', '--no-owner', '--no-acl', '-f', localPath],
      { stdio: 'inherit' }
    );

    const fileSize = fs.statSync(localPath).size;
    console.log(`[Backup] Dump complete: ${localPath} (${fileSize} bytes)`);

    console.log('[Backup] Uploading to Firebase Storage...');
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: bucketName,
    });
    const bucket = admin.storage().bucket(bucketName);
    await bucket.upload(localPath, { destination: storagePath });
    console.log(`[Backup] Uploaded to gs://${bucketName}/${storagePath}`);

    fs.unlinkSync(localPath);

    await reportCompletion({
      status: 'COMPLETED',
      filePath: `gs://${bucketName}/${storagePath}`,
      fileSize,
      startedAt,
    });

    console.log('[Backup] Done.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Backup] FAILED:', message);

    await reportCompletion({
      status: 'FAILED',
      startedAt,
      errorMessage: message,
    }).catch(() => {});

    process.exit(1);
  }
}

main();
