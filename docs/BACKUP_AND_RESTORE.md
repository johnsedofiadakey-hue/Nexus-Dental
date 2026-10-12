# Backup, restore and background jobs

Every clinic deployment protects its data with **encrypted, off-project, verified backups**, proves they can be restored, and runs background work in a **separate always-on worker**. This document is the operator's runbook. Nothing here has been run against a production system. Every claim is labelled in [What was and was not exercised](#what-was-and-was-not-exercised) as **automated-test evidence**, **one-off rehearsal evidence**, or **not verified (cloud behaviour)**.

> A backup you have never restored is a hope, not a backup. Run a restore drill at least every 35 days. The app alerts you when one is overdue.

---

## 1. How backups work

```
nightly (03:00 UTC, GitHub Actions)
  pg_dump -Fc  →  check it is a real archive  →  encrypt with the PUBLIC key (age)
  →  SHA-256  →  create-only upload to a separate bucket  →  store-confirmed size  →  report to the app
```

- **CI holds only the public key.** A stolen CI secret cannot read any backup. The **private key stays offline** with the owner and is used only for restore drills and real recoveries.
- **Fails closed.** No public key, a bad or tiny dump, a failed encryption/upload/verification: the run is recorded `FAILED` and **nothing readable is ever uploaded**. There is no plaintext fallback.
- The plaintext dump exists only in a private temp folder and is deleted right after encryption.
- **Off-project and create-only.** The bucket lives in a *different cloud project* from the app. The backup job's credential can **create** new objects and **nothing else**: it cannot download, list, overwrite or delete (the upload code has no read method at all, and the object is created with an "only if it does not already exist" precondition). A compromised runner can therefore neither read earlier backups nor erase history, and age encryption remains an independent layer on top. Upload integrity is confirmed from the metadata the store returns for the upload itself (size, plus a checksum the SDK validates), which needs no read permission. Retention is enforced by the bucket (below), not by the job.
- **Restoring uses a different identity.** Downloading a backup needs a separate, **operator-controlled read identity** (your own login or a read-only service account) that is never stored in the backup workflow.
- Each backup has a small `.json` manifest next to it: format version, SHA-256, size, and a short *fingerprint* of the public key (never key material).
- Layout: `daily/YYYY-MM-DD/nexus-….dump.age` every night, plus `monthly/YYYY-MM/…` on the 1st.

## 2. One-time setup (owner)

None of this is automated, because it creates cloud resources and secrets.

### 2.1 Create the key pair (on your own computer)

```bash
npm run backup:keygen -- --out ~/offline/clinic-backup.key
```

It writes the **private key** to that file (mode 600; refuses an existing file or any path inside the repo) and prints the **public key** (`age1…`). Then:

1. Copy the private key file to **two offline places** (password manager + a printed paper copy in a safe). Do not email it, commit it, or paste it into any CI or app setting.
2. Put the **public key** in the GitHub secret `BACKUP_AGE_RECIPIENT`.

**If the private key is lost, every backup made with it is permanently unreadable. If it leaks, every backup is readable by whoever holds it and the encrypted files.** Treat it like the clinic's safe key.

### 2.2 Create the backup bucket (separate project)

In a **new Google Cloud project that is not the app's** (so one compromised account or one billing problem cannot take out both):

1. Create a bucket (uniform access, no public access), e.g. `clinic-backups-<clinic>`.
2. Turn on **object versioning** and a **retention policy of 30 days** (locked once you are happy).
3. Add lifecycle rules so old backups expire:
   ```json
   { "rule": [
     { "action": {"type": "Delete"}, "condition": {"age": 35,  "matchesPrefix": ["daily/"]}   },
     { "action": {"type": "Delete"}, "condition": {"age": 400, "matchesPrefix": ["monthly/"]} }
   ] }
   ```
   (`gcloud storage buckets update gs://BUCKET --lifecycle-file=lifecycle.json`). This keeps ~35 daily and ~13 monthly backups.
4. Create a **service account in that project** with only `roles/storage.objectCreator` (`storage.objects.create`: **no get, no list, no delete, no overwrite**). Nothing else is needed: the upload response itself carries the size. Create a JSON key for it, used only as the `BACKUP_GCS_SERVICE_ACCOUNT` secret. Keep a **separate** read identity for yourself (for restore drills); never put it in GitHub.
5. GitHub repository **secrets**: `BACKUP_BUCKET`, `BACKUP_GCS_SERVICE_ACCOUNT` (the JSON), `BACKUP_AGE_RECIPIENT`, `DATABASE_URL`, `APP_URL`, `BACKUP_WEBHOOK_SECRET`, `OPS_WATCHDOG_SECRET` (a *different* random value, see 2.3). Repository **variable** `PG_MAJOR` = the database server's major version (e.g. `16`), because `pg_dump` must not be older than the server.

### 2.3 Alerts and independent monitoring

Set `ALERT_EMAIL_TO` (comma-separated) in the **web and worker** environment, and make sure `RESEND_API_KEY` / `EMAIL_FROM` are configured with a **verified sender**. Without `RESEND_API_KEY` an alert is reported as *unconfigured*, never as sent. Until a real sender is verified, alert delivery is unconfirmed: send a test by running a deliberately failing backup once.

**A worker cannot report its own death**, so worker monitoring does not live in the worker:

- `POST /api/system/watchdog` (header `x-ops-watchdog-secret`) is called by a **scheduled GitHub workflow** (`.github/workflows/ops-watchdog.yml`, every 15 minutes). It checks the worker heartbeat, backup freshness, restore-drill age and the dead-letter backlog, raises rate-limited alerts, and answers `200` when healthy or `503` (listing condition *names* only) when something needs attention, so **the workflow run fails visibly** when something is wrong.
- It authenticates with its own dedicated secret `OPS_WATCHDOG_SECRET` (`openssl rand -hex 32`). It never accepts a user token or the backup callback secret. Set the same value as a GitHub secret and in the web app's environment.
- **Honest limits:** GitHub scheduled workflows are best-effort. They can start minutes late, be skipped under load, and are disabled after 60 days without repository activity. This is a **backup monitor, not a real-time SLA**.
- **Production-grade monitoring to add later (not done here):** point a real uptime monitor or Cloud Scheduler job at the same endpoint (and at `/api/health`, watching the body), page a human on repeated failure, and alert on the worker service's own restart count.

You are told when: a backup **fails**; **no valid encrypted backup** is recorded for 26 h (the job may not be running at all); a strict restore drill is **overdue** (35 days); **no fresh worker heartbeat reporting all four workers** is seen; or 5+ background jobs have run out of retries. Each condition alerts at most once per interval (6 h; 2 h for the worker; 24 h for drills), decided by one atomic database update so several replicas still send one message.

**What counts as a backup.** One rule (`src/lib/backup/validity.ts`) is used both when a report is accepted and when health is judged. A backup counts only if it is a recent `FULL` run, `COMPLETED`, `encrypted`, in the **current format version**, with a valid SHA-256, a real object path, a plausible size and sane timestamps. Older plaintext rows or rows missing any proof stay visible in history but **never** make backup health "ok", and `POST /api/system/backups/complete` answers `400` and writes nothing for a completed report that lacks any of it.

## 3. Restore drill (do this monthly)

A drill restores a backup into a **brand-new local throwaway database** and checks it. It can never touch an existing or remote database: it refuses any server that is not `localhost`, and only creates databases named `nexus_restore_test_*`.

**A drill is strict.** It passes, and can be recorded, only if **all** of these hold. There is no softer "success":

1. the file's SHA-256 matches the **expected checksum** (mandatory: from the app's backup record via `--sha256`, or the backup's `.json` manifest beside the file);
2. it decrypts, is a valid PostgreSQL archive, and restores without error;
3. **exactly one clinic** row exists (zero or two is a hard failure);
4. migration history (`_prisma_migrations`) is present, contains nothing unknown to this release, and every migration of this release is applied;
5. every foreign key recorded in the archive exists in the restored database and is validated.

Steps:

1. Download the newest backup file (and its `.json` manifest) from the bucket to your computer, using **your own read identity**.
2. Have PostgreSQL running locally with a user that may `CREATE DATABASE`.
3. Run (the key path must be outside the repo):
   ```bash
   TEST_DATABASE_ADMIN_URL="postgresql://you@127.0.0.1:5432/postgres" \
   npm run backup:restore -- \
     --file ~/Downloads/nexus-2026-….dump.age \
     --key-file ~/offline/clinic-backup.key \
     --sha256 <SHA-256 from the app's backup record> \
     --min-rows tenants=1 \
     --report
   ```
   `--report` records the drill in the app (needs `APP_URL` and `BACKUP_WEBHOOK_SECRET` in your shell). **Only a passing, checksum-verified drill is recorded as completed**, and only if the app can match its checksum to a valid recorded backup. A failing drill is recorded as failed (and alerts). Neither case is recorded if you pass `--unverified`.
4. Read the result. Every line must say `PASS` and the last line must read `RESULT: strict drill PASSED`.
5. The temporary database is dropped automatically (`--keep` leaves it for inspection). The output lists table names and **row counts only**, never data.

Exit codes: `0` passed, `1` failed, `2` bad usage (for example no checksum available, or the key stored inside the repository).

**Restoring a backup from an older release.** An older backup lacks newer migrations and therefore does **not** pass. If you must recover from one, add `--older-backup --apply-migrations`: the drill then runs `prisma migrate deploy` against the *restored throwaway copy only* and re-checks. It counts as a drill only if that re-check is clean. `--older-backup` alone is shown as `NON-PASSING`.

**`--unverified` is for developers only.** It restores without a checksum, always exits `1`, can never be combined with `--report`, and never resets the drill clock.

Failure messages are deliberate: *wrong key* and *damaged file* are indistinguishable (`DECRYPT_FAILED`); a wrong checksum is `CHECKSUM_MISMATCH`; a file that decrypts but is not a database is `DUMP_INVALID`. In every failure case nothing is restored.

## 4. Real recovery (data loss, bad deploy, ransomware)

Decide first: **is the live database still trustworthy?** If a deploy or migration broke it but the data is intact, prefer fixing forward or rolling the release back. Restore only for data loss or corruption.

1. **Stop writes.** Scale the web service to zero (or put it in maintenance) and stop the worker, so nothing writes while you recover.
2. **Preserve evidence.** Take a final `pg_dump` of the damaged database before touching it, if the server still answers.
3. **Pick the backup.** The newest `daily/…` before the incident. Everything after it is lost (see RPO).
4. **Rehearse it first.** Run the strict drill above on that exact file (with its recorded checksum). If it fails, try the previous night. If it is from an older release, use `--older-backup --apply-migrations`.
5. **Restore into a new database on the managed server** (not over the damaged one): create an empty database, then
   ```bash
   # decrypt on your own machine with the offline key, then:
   pg_restore --no-owner --no-acl -d "<NEW_DATABASE_URL>" restore.dump
   ```
   Delete the decrypted `restore.dump` afterwards. (The drill command only restores locally by design; for a production restore you run `pg_restore` yourself after the drill has passed.)
6. **Migrate to this release:** `DATABASE_URL=<NEW> npx prisma migrate deploy`.
7. **Verify:** `npm run config:check`, then one clinic row, plausible patient/appointment counts, and a test login.
8. **Switch over:** point `DATABASE_URL` at the new database, start the worker, then scale the web service up. Sign-in sessions are stored in the database, so staff and patients whose sessions pre-date the backup may need to sign in again.
9. **Write down** what was lost (the gap between the backup and the incident) and tell the clinic.

### Recovery objectives (be honest with the clinic)

| | Value | Basis |
|---|---|---|
| **RPO** (data you can lose) | up to **24 h** (nightly) | Backups run once a day. Anything entered since the last run is lost. Point-in-time recovery needs WAL archiving on the managed database; it is **not** built here and is recommended for a real clinic. |
| **RTO** (time to recover) | machine time is minutes; **human time dominates**, plan **1–2 h** | Measured on a 249 MB synthetic database (200,000 patients): backup ≈ 1 s, restore + verification ≈ 3.4 s. Real data compresses differently and a managed database restores more slowly; re-measure with your own backup. The rest is decisions, downloads and verification. |

## 5. Key rotation and key loss

- **Rotate** (e.g. staff change, suspected exposure): generate a new pair with `backup:keygen`, set the new public key in `BACKUP_AGE_RECIPIENT`. New backups use the new key; **keep the old private key** for as long as old backups must stay readable. `BACKUP_AGE_RECIPIENT` accepts several keys (comma/space separated) so a backup can be readable by two custodians.
- **Lost key:** backups made for it are unrecoverable. Make a fresh pair immediately and take a manual backup (GitHub Actions → *Nightly Database Backup* → *Run workflow*).
- **Leaked key:** assume everything encrypted to it is readable by the holder; rotate, and treat it as a data incident (see the privacy/incident documents).

## 6. Background jobs: the worker

The web service scales to zero, so jobs started inside it stop when the site is idle. Background work therefore runs in a **separate always-on process**:

```bash
npm run worker                      # node --import tsx src/worker/index.ts
# or the container: docker build -f Dockerfile.worker -t nexus-worker .
```

- Needs the **same environment as the web app** (it applies the same fail-closed configuration check and exits `1` naming missing variables) and `ALERT_EMAIL_TO`.
- Run **at least one instance, always** (Cloud Run: `--min-instances=1`, CPU always allocated; or any small always-on host). More than one is safe: schedules are registered by fixed id, jobs are claimed atomically, and alerts are rate-limited in the database.
- **Recurring jobs** (registered by the worker, UTC): recall check 09:00 daily; insurance stale-claims check 08:00 daily. Appointment reminders are *delayed jobs created at booking* and are processed by the worker.
- **Health:** `GET :8081/healthz` (liveness) and `/readyz` (Redis + database reachable). Use `/healthz` for restart decisions and `/readyz` for traffic. If Redis is down the worker stays alive and reports *not ready*.
- **Shutdown:** SIGTERM drains and exits within 6 s.
- The web service **no longer starts workers**. It only enqueues jobs.

### Seeing and fixing failures (system owner)

- `GET /api/system/queues` – per queue: waiting / active / delayed / failed counts, age of the oldest waiting job; worker heartbeats (UP/DOWN); and the 50 most recent **dead-lettered** jobs.
- A job that has used all its retries is saved in the database (`failed_jobs`) with a **redacted** error and the **names** of its payload fields, never the values, so it survives a Redis flush.
- `POST /api/system/dead-letters/{id}/retry` re-queues the original job if Redis still holds it. The retry is **claimed in the database before Redis is called**, so simultaneous requests cause exactly one retry; if Redis refuses, the claim is released and the redacted reason is stored so you can deliberately try again (audited as `DEAD_LETTER_RETRIED` / `DEAD_LETTER_RETRY_FAILED`). If Redis no longer holds the job it says the payload is gone.
- `GET /api/system/health` – database, Redis, workers, queues, dead-letter count and backup/drill state.
- Public `GET /api/health` is coarse on purpose: `503` only when the database or Redis is down (and it answers within ~2.5 s even then); `200 {"status":"degraded"}` with `workers`/`backup` labels when only the worker or backup needs attention. Point an uptime monitor at it and alert on the body, not just the status code.

## What was and was not exercised

### Automated-test evidence (runs in `npm test` and `npm run test:provision`, on a disposable local PostgreSQL, synthetic data)

- real `pg_dump` → encryption → real `pg_restore` into a second database; table-by-table counts and content hashes identical; the report never contains row data;
- strict drill: no/bad/wrong checksum, zero or two clinics, missing or unknown migration history, an older backup (non-passing until `migrate deploy` is applied and re-checked, then passing, end to end), no foreign keys, an unvalidated foreign key, damaged/truncated/wrong-key/non-archive files all fail and cannot be recorded; `--unverified` can never report;
- the real command-line scripts, including a fake local app server proving a passing drill reports `COMPLETED` with its summary and a failing one reports `FAILED`;
- create-only upload: neither destination implementation has any read, list, download or delete method; a backup completes with only `put()`; an existing object is never overwritten;
- fail-closed behaviour on every failure path; every missing-proof variant of a completed backup callback returns `400` and writes nothing; a legacy or incomplete row never makes backup health ok;
- concurrency (an in-memory table with atomic check-and-set, not sequential mocks): ten simultaneous alert checks send one alert; ten simultaneous dead-letter retries call Redis once; a Redis failure releases the claim and a later retry works; a crashed claimant's lease expires;
- worker health requires all four workers on a fresh heartbeat; the watchdog endpoint's authentication and 200/503 behaviour; recovery clears the unhealthy result;
- the real worker process refusing bad configuration and staying alive-but-not-ready with Redis unreachable; health endpoints answering within their bounds.

### One-off rehearsal evidence (run by hand on the day C3 was built; not in CI)

A 200,000-patient synthetic database (about 249 MB on disk) was backed up through `npm run backup:run` to a local folder (about 7.5 MB encrypted; about 1 s) and restored and verified through `npm run backup:restore` (about 3.4 s). The synthetic data compresses very well, so these timings say little about a real clinic. **To reproduce**, in a throwaway local database named `nexus_c1_test_…`: apply the migrations with `prisma migrate deploy`; insert one tenant; insert 200,000 patients with `generate_series` and a ~1 KB note each; generate keys with `npm run backup:keygen`; run `npm run backup:run` with `BACKUP_LOCAL_DIR`; then `npm run backup:restore` with `--sha256` from the `.json` manifest. This rehearsal predates the strict drill; the strict drill is covered by the automated tests above.

### Not verified (cloud and provider behaviour)

- A real upload to a real bucket (the Google Cloud destination is implemented but untested against Google), the create-only service-account permissions, the `ifGenerationMatch` precondition against the real API, and the bucket lifecycle/retention rules.
- Real alert e-mail delivery (needs a verified sender).
- The GitHub Actions workflows themselves (backup and watchdog), the 15-minute schedule actually firing, and `pg_dump` against the managed (Neon) database / its version.
- The worker against a **real Redis** (none was available locally): workers consuming jobs, repeatable schedules being created, and heartbeats appearing were verified only with test doubles, not live; the bounded `worker.close()` shutdown path is likewise untested (the bounded Redis quit is tested). Do this on first deployment and confirm `/api/system/queues` shows a live worker and the two schedules.
- The `Dockerfile.worker` image (no container runtime was available).
- Restoring onto a managed production database, and point-in-time recovery (not built).
