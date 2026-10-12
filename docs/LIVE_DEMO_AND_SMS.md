# Live demonstration, SMS reminders and the worker

This is the operator's guide for a **synthetic-data** product demonstration with real SMS appointment reminders. It is **not** approval for real clinic or patient use.

Nothing here has been deployed or run against a live system. Every command below is for the release owner to run, in order, after review. Evidence classes are stated at the end.

---

## 1. mNotify SMS

SMS goes through one provider-neutral service (`src/lib/sms`). mNotify is the only SMS provider. Hubtel remains for payments and WhatsApp; it is **never** a fallback for SMS.

**API contract implemented** ([official docs](https://readthedocs.mnotify.com/)): `POST https://api.mnotify.com/api/sms/quick?key=<API_KEY>` with JSON `{ recipient: [..], sender, message, is_schedule: false, schedule_date: "" }`. Success is `status: "success"`, `code: "2000"` and a campaign id in `summary._id`. No `sms_type: "otp"` is sent for reminders. The sender ID is at most 11 characters. Ghana numbers are sent as `0XXXXXXXXX`, other numbers as digits without `+`.

What counts as failure: any non-2xx; a body that is not JSON; `status` other than `success` or `code` other than `2000`; no campaign id; any rejected recipient; a timeout (10 s). A provider acceptance is recorded as **`SENT`, never "delivered"**.

Never logged or stored: the API key, the request URL (it contains the key), a full phone number, or a provider response body. Provider error text is redacted before it is saved.

### Configuration

| Variable | Notes |
|---|---|
| `SMS_PROVIDER=mnotify` | Required for SMS. `console` exists for development only and is refused in production. |
| `MNOTIFY_API_KEY` | **Secret.** Secret Manager only. |
| `MNOTIFY_SENDER_ID` | Your **approved** sender ID, 1-11 letters/digits. |
| `ENABLED_FEATURES` | Must include `mnotify` (start-up refuses otherwise). |
| `DEMO_MODE=true` | Demonstration instance only. SMS may then reach **only** `DEMO_SMS_ALLOWLIST`. |
| `DEMO_SMS_ALLOWLIST` | **Required** while `DEMO_MODE=true`: comma-separated E.164 numbers. An empty or unparsable list blocks every SMS. |
| `DEMO_PATIENT_PHONE` | A phone **you control**. Used by `demo:provision` as the demo patient's number; must be on the allowlist. |

Without a usable configuration the system **fails closed**: the SMS call raises an error, nothing is sent, and nothing claims it was. In production there is no console "success" fallback.

> **The mNotify API key that was pasted into a chat during planning must be treated as exposed.** Revoke it in the mNotify dashboard and create a new one before any production use. Store the new key only in Secret Manager. Do not paste keys into chats, tickets or files in the repository.

## 2. Appointment reminders

**60 minutes and 30 minutes before** the appointment, by SMS, to the patient's phone. (The old 24-hour reminder and the old WhatsApp reminder no longer exist.)

| Appointment is... | Reminders created |
|---|---|
| more than 60 min away | 60 and 30 |
| 30-60 min away | only 30 |
| 30 min or less away | none (and the booking response says so) |

- **Durable.** The reminder rows (`appointment_reminders`) are written **in the same transaction as the appointment**. Queue jobs are only an accelerator; the worker re-creates any missing job from the rows every minute, so a Redis outage or flush loses nothing. A unique key `(appointment, offset, appointment time)` makes a duplicate impossible.
- **At most one SMS per reminder.** The worker claims a reminder with one conditional database update before it calls mNotify; concurrent or retried jobs cannot both win. A reminder that is `SENT` is never sent again. The one unavoidable gap is a crash *between* mNotify accepting a message and the worker recording it; the claim lease (10 min) bounds it, after which that reminder could be sent once more.
- **Never for the wrong appointment.** Cancelled, checked-in, completed, checkout and no-show appointments send nothing (cancellation marks pending reminders `CANCELLED`, and the worker re-checks the appointment itself). A reminder is made for one specific appointment time and will not fire for a different one.
- **Time zones are explicit.** Times are interpreted in the clinic's zone (`Africa/Accra` for the demo), stored as UTC, and printed in the clinic's zone. The server's own zone is never used.
- **Truthful booking response.** `POST /api/appointments/book` returns `remindersScheduled` (see below). If Redis is down the booking still succeeds, the response says `NOT_QUEUED`, and the reconciler queues it as soon as it can.
- **Evidence.** Each accepted SMS writes a `Notification` row (channel `SMS`, status `SENT`, metadata: provider, campaign id, reminder offset, appointment id) and an audit entry, with no secret or provider payload. A failed send records the redacted reason on the reminder and goes through the queue's retry policy and then the dead-letter list.
- **There is currently no appointment-reschedule API.** When one is added it must cancel the old reminders and create new ones for the new time (`cancelPendingReminders` then `scheduleAppointmentReminders` in `src/lib/reminders/schedule.ts`). Reopening a cancelled appointment already recreates them.
- The message never says "reply CANCEL": no inbound-SMS workflow exists.

### Contracts for the UI (Codex)

**Booking** `POST /api/appointments/book` → `data.remindersScheduled`:

```jsonc
{
  "enabled": true,                  // clinic switch AND an SMS provider both allow reminders
  "reason": "DISABLED_BY_CLINIC",   // only when enabled is false (or "PROVIDER_UNAVAILABLE")
  "timeZone": "Africa/Accra",
  "complete": true,                 // every reminder that should exist is recorded AND queued
  "items": [ { "offsetMinutes": 60, "scheduledFor": "2026-10-12T13:30:00.000Z", "status": "PENDING" } ]
  // status: PENDING | NOT_QUEUED | SKIPPED_PAST | FAILED
}
```

**History** `GET /api/appointments/{id}/reminders` (staff with `appointments:view`, or the patient who owns it) → `data.items[]`: `{ id, offsetMinutes, scheduledFor, status (PENDING|PROCESSING|SENT|FAILED|CANCELLED), sentAt, provider, providerMessageId (staff only), attempts, error (staff only) }`. `SENT` means accepted by the SMS provider, not delivered.

**Settings** `GET /api/clinic/settings` → `data.effective.smsReminders` = `{ enabled, reason? }` (what booking and the worker actually enforce). `POST` accepts `featureFlags: { enableSmsReminders: true|false }`; unknown keys and non-booleans are rejected (400) and omitted flags are left untouched.

**Access contract** `GET /api/auth/me` → `data.access.modules.smsReminders` and `data.access.providers.mnotify` (`{ enabled, reason? }`; no values).

## 3. The worker (reminders run outside the web service)

The web service scales to zero and cannot execute delayed jobs. `src/worker/index.ts` / `Dockerfile.worker` is the **only** reminder worker path. It registers the workers once, the recurring schedules by fixed id, a 60-second reconciler for reminders, a heartbeat, and a health endpoint (`/healthz`, `/readyz`).

**Cloud Run (documented, not executed).** Build and run with the same database, Redis and clinic configuration as the demo app, **at least one instance always running**:

```bash
gcloud run deploy nexus-worker --source . --dockerfile Dockerfile.worker \
  --region <region> --min-instances 1 --max-instances 1 --no-cpu-throttling \
  --set-env-vars "NODE_ENV=production,DEPLOYMENT_MODE=single_clinic,CLINIC_ID=<id>,ENABLED_FEATURES=<..,mnotify>,SMS_PROVIDER=mnotify,DEMO_MODE=true,DEMO_SMS_ALLOWLIST=<+233…>,ALERT_EMAIL_TO=<you>,WORKER_HEALTH_PORT=8080" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,JWT_SECRET=JWT_SECRET:latest,MNOTIFY_API_KEY=MNOTIFY_API_KEY:latest,MNOTIFY_SENDER_ID=MNOTIFY_SENDER_ID:latest"
```

(Adjust to your hosting; the code is host-neutral. Use `/healthz` for liveness and `/readyz` for readiness.)

**The web app needs the same SMS/demo variables**, because booking decides whether to create reminders and the settings page reports availability. Add these Secret Manager **bindings** to the web service's `apphosting.yaml` (this file was **not** edited): `MNOTIFY_API_KEY`, `MNOTIFY_SENDER_ID` as secrets; and `SMS_PROVIDER`, `DEMO_MODE`, `DEMO_SMS_ALLOWLIST`, `ENABLED_FEATURES` (including `mnotify`), `DEPLOYMENT_MODE`, `OPS_WATCHDOG_SECRET`, `ALERT_EMAIL_TO` as values/secrets as appropriate. **Never put the mNotify key in `apphosting.yaml` as plain text.**

### Verifying the worker and one real SMS before the demo

1. **Worker heartbeat.** `GET <app>/api/health` should answer `{"status":"ok","workers":"ok","backup":...}` (`workers: ok` means a fresh heartbeat reporting all four workers). As system owner, `GET /api/system/queues` shows the heartbeat per instance and queue depths. `workers: "down"` means no worker is running.
2. **One real, allowlisted SMS.** From a shell with the demo environment (not the repository `.env`):
   ```bash
   npm run sms:test -- --to <your allowlisted number>                 # dry run, sends nothing
   npm run sms:test -- --to <your allowlisted number> --confirm-send  # sends ONE real SMS
   ```
   It prints the mNotify campaign id and `SENT`. Confirm the message arrives on the handset (delivery is not tracked by the app). In demo mode it refuses any number that is not on the allowlist.
3. **A real reminder.** Book an appointment ~75 minutes ahead for the demo patient; `GET /api/appointments/{id}/reminders` should show two `PENDING` reminders, then `SENT` with a campaign id at each time.

## 4. Synthetic demo data

```bash
# readiness report (writes nothing; no credentials or full phone numbers in the output)
DATABASE_URL=… CLINIC_ID=… DEMO_MODE=true DEMO_PATIENT_PHONE=… DEMO_SMS_ALLOWLIST=… SMS_PROVIDER=mnotify MNOTIFY_API_KEY=… MNOTIFY_SENDER_ID=… \
  npm run demo:provision -- --check

# fill the clinic with clearly labelled synthetic data (typed-back clinic id is mandatory)
… npm run demo:provision -- --confirm-clinic <CLINIC_ID> --credentials-out /secure/place/demo-accounts.txt
```

It needs an **already provisioned** clinic (`npm run clinic:provision` first) and refuses unless `DEMO_MODE=true`. It never deletes, never runs the legacy seed, and only creates or updates records with `demo-` ids (a real record that collides is a hard refusal). It creates: an owner, a receptionist and a dentist (e-mails on the reserved `.invalid` domain, **random passwords written only to the 0600 file**, outside the repository, which must not exist), four sample services, one demo patient on `DEMO_PATIENT_PHONE`, a completed visit with a prescription and a paid cash invoice, an upcoming appointment (**without reminders**, so seeding never sends an SMS), a three-step treatment plan, and two chart entries. It is safe to re-run (nothing duplicates, passwords are not changed unless `--rotate-passwords`) and leaves an audit entry. The readiness report also needs `--check` to be green on: demo mode, SMS provider, allowlist, the demo phone, migrations, exactly one clinic, the three accounts, the patient, the records, and the clinic's reminders switch.

### The rehearsal flow this supports

Receptionist signs in → creates or finds the synthetic patient (from Patient 360 → "Book appointment" the patient is pre-selected) → books an appointment (book **exactly one service** until you have confirmed the additional-services invoice fix on your build) → two reminders recorded → mNotify texts the allowlisted phone at 60 and 30 minutes → check-in → doctor opens the workspace/chart/treatment plan (and can **add steps**) → invoice created, paid in **cash** (manual card is no longer offered) → the patient signs in with their own phone OTP and sees appointment, treatment, records, prescription and invoice.

## 5. Firebase Phone Auth prerequisites (console settings, cannot be checked from code)

- Phone sign-in is **enabled** as an authentication provider in the demo's Firebase project.
- The live domain is in **Authorised domains**.
- Either a **test phone number with a fixed code** is configured in the console for the demo patient, or the demonstrator controls the real phone and the project has SMS quota. Firebase token verification is **never** bypassed by this system.

## 6. Applying the new migrations to the live database (do NOT do this without a rehearsal)

The live database has no Prisma migration history. Rehearse on a **restored copy** first (see `docs/BACKUP_AND_RESTORE.md` for the strict restore drill):

```bash
# 1. restore the latest backup into a throwaway LOCAL database and keep it
npm run backup:restore -- --file <backup.dump.age> --key-file <offline key> --sha256 <recorded> --keep
# 2. on that copy (explicit DATABASE_URL, never the repository .env), baseline once:
npx prisma migrate resolve --applied 20260602071052_init
npx prisma migrate resolve --applied 20260610110859_add_ondelete_constraints_insurance_enum
npx prisma migrate deploy        # applies the join table, sessions, ops/backup, and reminders migrations
npx prisma migrate status
```

Only after that passes, and with the owner's explicit approval, repeat on the live database. New migrations in this packet: `20261012090000_add_appointment_reminders` (additive: one enum, one table).

## 7. What was and was not exercised

**Automated tests (no real SMS, Redis, email or cloud call):** the mNotify request/response contract, redaction, fail-closed configuration and the demo allowlist; phone normalization; explicit time zones; 60/30-minute planning and exact timestamps; atomic dispatch under concurrency (ten simultaneous jobs → one SMS), retries after failure, cancellation and state re-checks; reconciliation; the truthful booking response including a Redis outage; Patient 360 booking and phone de-duplication; rejection of unsupported payment methods; invoice totals for several services; treatment-step creation and its authorisation; settings validation; and the demo provisioner against a real throwaway PostgreSQL, including two simultaneous runs.

**Not verified:** a real mNotify exchange (the exact request shape follows the documentation but has never been sent to mNotify from this code; `sms:test` is the check), the sender-ID approval, delivery to a handset, the worker against a real Redis, the deployed worker and its secrets, Firebase Phone Auth in the console, and the web UI in a browser at mobile sizes.
