# Clinic provisioning

Every clinic runs as its own **isolated deployment**: its own database, Redis, storage, Firebase project, domain and secrets, built from the one shared codebase. A deployment holds **exactly one clinic**, and nothing in the running app can create a second one.

This document covers turning an **empty, freshly migrated database** into that one configured clinic. Every command below was run end to end against a throwaway local database (see [Verification status](#verification-status) for what was and was not exercised).

> **Never run any of this against a database that holds real data unless you mean to.** The repository's own `.env` points at a live database. The commands here deliberately do **not** read it — configuration comes only from your shell.

---

## What you need first

| Item | Notes |
|---|---|
| An empty PostgreSQL database | Dedicated to this clinic. |
| A Redis instance | Dedicated instance or namespace. |
| A Firebase project | Auth + Storage, dedicated to this clinic. |
| A clinic manifest | `clients/<clinic>/clinic.yaml` — copy `clients/example/clinic.yaml`. Non-secret. |
| The secrets, in your environment | See [Environment](#environment). Never in the manifest, never in git. |

## Steps

Set the environment in your shell first. If you keep it in a file, **quote any value containing spaces or `<` `>`** (for example `EMAIL_FROM="Clinic Name <noreply@clinic.example>"`), or the shell will silently drop the variable. Keep that file **outside the repository**.

```bash
set -a; . /secure/location/clinic.env; set +a
```

### 1. Apply the migrations

```bash
npx prisma migrate deploy
```

`DATABASE_URL` **must already be set in your shell** — Prisma would otherwise fall back to the repository's `.env`. Never use `prisma db push` for a clinic deployment.

### 2. Check the configuration

```bash
npm run config:check -- --manifest clients/<clinic>/clinic.yaml
```

Validates the environment the same way the server does at start-up, and cross-checks it against the manifest (clinic id, app URL, Firebase project and bucket, enabled features). It prints variable **names** only, never values. Exit code `0` = ready.

### 3. Dry run

```bash
npm run clinic:provision -- --manifest clients/<clinic>/clinic.yaml --check
```

Validates the manifest, configuration, migrations and clinic identity, and reports what would happen. Writes nothing.

### 4. Provision

Choose **exactly one** way to deliver the owner's invitation:

```bash
# Write the single-use link to a private (0600) file OUTSIDE the repo
npm run clinic:provision -- --manifest clients/<clinic>/clinic.yaml --invite-out /secure/location/owner-invite.txt

# or email it (needs RESEND_API_KEY and EMAIL_FROM)
npm run clinic:provision -- --manifest clients/<clinic>/clinic.yaml --invite-email

# or create the clinic without inviting anyone yet
npm run clinic:provision -- --manifest clients/<clinic>/clinic.yaml --skip-owner-invite
```

The invitation link is **never printed**. Give the file's contents to the owner securely, then delete the file. The owner opens the link, sets their own password, and becomes the clinic owner. The link works once and expires (default 72 hours; `owner.inviteExpiryHours` in the manifest).

A **production** run is refused unless you type the clinic id back:

```bash
npm run clinic:provision -- --manifest clients/<clinic>/clinic.yaml --invite-out /secure/location/owner-invite.txt --confirm-production <clinic-id>
```

"Production" means `deployment.environment: production` in the manifest **or** `NODE_ENV=production` in the shell.

### 5. Re-running

Provisioning is safe to repeat. A second run changes nothing and creates no duplicates; it reports the existing state. To replace a pending owner link with a fresh one:

```bash
npm run clinic:provision -- --manifest clients/<clinic>/clinic.yaml --invite-out /secure/location/owner-invite.txt --reissue-invite
```

An expired invitation is re-issued automatically. Only a hash of the token is stored, so a lost link cannot be recovered — re-issue it.

---

## What provisioning creates

Run against an empty, migrated database it creates, inside one transaction:

- the **clinic** (its id is the manifest's `clinic.id`), settings and public content
- the **default consent templates** (starter wording — the clinic must review it)
- the **services** listed in the manifest
- an inactive `system-provisioner` account that belongs to no clinic. It exists only because an invitation requires an inviter and a brand-new clinic has no users. It cannot sign in and never appears in the clinic's staff list.
- the **owner invitation** (second transaction, so a failed delivery leaves nothing half-issued)
- audit entries for the above (never containing a token)

### What the manifest controls

| | Behaviour on re-run |
|---|---|
| `clinic.id`, `clinic.slug` | **Immutable.** A different slug is refused. A different id is a different clinic and is refused (see below). |
| `clinic.name`, `clinic.timezone`, `features` | **Authoritative** — re-applied from the manifest. |
| Contact details, logo | Filled in only where currently empty. |
| Branding, hours, public content, services, consent wording | **Initial values.** Created once, never overwritten, so a clinic's own edits in the app survive. |

## Environment

All of these are required in a deployment (the server **refuses to start in production** without them). Run `npm run config:check` to see what is missing.

| Variable | Notes |
|---|---|
| `DEPLOYMENT_MODE` | Must be `single_clinic`. |
| `DATABASE_URL` | `postgres://` or `postgresql://`. |
| `JWT_SECRET` | At least 32 characters; template placeholders are rejected. |
| `CLINIC_ID` | Must equal the manifest's `clinic.id`. |
| `REDIS_URL` | `redis://` or `rediss://`. |
| `NEXT_PUBLIC_APP_URL` | `https://` in production; must equal the manifest's `deployment.appUrl`. |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID` | `_PROJECT_ID` must equal the manifest's `infrastructure.firebaseProjectId`. |
| `FIREBASE_STORAGE_BUCKET` | Must equal the manifest's `infrastructure.storageBucket`. |
| `ENABLED_FEATURES` | **Required and explicit in production** (a missing or empty value is refused at start-up and, as a second layer, enables nothing). Comma-separated subset of `paystack,hubtel,resend,telehealth,mnotify`, or `none` for a clinic that uses no optional feature. Must match the manifest's `features`. |

Per-feature variables are required **only when that feature is enabled**:

| Feature | Variables |
|---|---|
| `paystack` | `PAYSTACK_SECRET_KEY` (hosted checkout is initialized and verified server-side) |
| `hubtel` | `HUBTEL_CLIENT_ID`, `HUBTEL_CLIENT_SECRET`, `HUBTEL_SENDER_ID` |
| `resend` | `RESEND_API_KEY`, `EMAIL_FROM` |
| `telehealth` | `DAILY_API_KEY` |
| `mnotify` | `MNOTIFY_API_KEY`, `MNOTIFY_SENDER_ID` (1-11 letters/digits), and `SMS_PROVIDER=mnotify` |

In a demonstration deployment `DEMO_MODE=true` additionally **requires** `DEMO_SMS_ALLOWLIST` (comma-separated E.164 numbers); see [LIVE_DEMO_AND_SMS.md](LIVE_DEMO_AND_SMS.md).

`ENABLED_FEATURES` decides **which secrets are mandatory** and is reported (with whether the credentials are actually present) in the `providers` part of `GET /api/auth/me` → `data.access`. It does not yet make individual API routes refuse requests for a disabled provider; that is the job of the `FEATURE_DISABLED` helper in `src/lib/config/features.ts`, to be applied route by route in later packets.

## What is switched off in a clinic deployment

- **`/api/onboarding`** (browser self-registration) always answers `410 ONBOARDING_DISABLED`. Clinics are created only with `clinic:provision`.
- **`/api/system/tenants`** and **`/api/system/tenants/[id]`** (list / create / update / freeze tenants) answer `403 TENANT_ADMIN_DISABLED` when `DEPLOYMENT_MODE=single_clinic`. System health and backup endpoints are unaffected.

## When provisioning refuses

| Code | Meaning | Fix |
|---|---|---|
| `PRODUCTION_CONFIRMATION_REQUIRED` | Production run without confirmation. | Add `--confirm-production <clinic-id>`. |
| `CONFIG_INVALID` | A variable is missing/invalid, or disagrees with the manifest. The message names the variables. | Fix the environment; re-run `config:check`. |
| `INVITE_DELIVERY_INVALID` | Email not configured; `--invite-out` is inside the repo, already exists, or its folder is missing. | Fix the path or configuration. |
| `INVITE_DELIVERY_FAILED` | The invitation could not be sent/written. **Nothing was recorded.** | Fix and re-run. |
| `MIGRATIONS_NOT_APPLIED` | Migrations missing, partial, or the database is *ahead* of this release. | `npx prisma migrate deploy` with this release. |
| `SECOND_CLINIC_REFUSED` | The database already holds a different clinic. | Use a separate database for each clinic. |
| `SLUG_IMMUTABLE` | The slug differs from the existing clinic's. | Restore the original slug. |
| `OWNER_EMAIL_IN_USE` | That email already belongs to a non-owner account. | Use another owner email. |

Unexpected failures print only the error type. Add `--verbose` to see the message (it may contain connection details).

## Adopting an existing database (not a clean install)

A database created earlier with `prisma db push` has no migration history, so `migrate deploy` stops with `P3005`. To adopt it, mark the migrations it already contains as applied, then deploy:

```bash
npx prisma migrate resolve --applied 20260602071052_init
npx prisma migrate resolve --applied 20260610110859_add_ondelete_constraints_insurance_enum
npx prisma migrate deploy
```

The last migration (`20261004120000_…join`) is idempotent and is a no-op on a database that already has that table. **Do this against a copy first, and only against a live database with the owner's explicit approval.** It was verified only on a scratch database shaped like production.

## Testing the provisioning path

```bash
TEST_DATABASE_ADMIN_URL="postgresql://<you>@127.0.0.1:5432/postgres" npm run test:provision
```

Creates a brand-new `nexus_c1_test_*` database on **localhost only**, applies the committed migrations (a genuine clean install), runs `tests/provision.integration.test.ts` and `tests/sessions.integration.test.ts` (one after the other — they share the database), then drops the database. It refuses remote servers and ignores the repository's `.env`. `npm test` runs everything else; the database-backed file is skipped there.

## Verification status

**Exercised:** clean install from migrations; provision, re-run, re-issue and `--check` through the real CLI; production refusal and confirmation; second-clinic, slug and `CLINIC_ID` refusals; concurrent runs; owner invitation accepted through the real accept endpoint; server refusing to start with incomplete configuration; no secret or invitation link in any output.

**Not exercised:**
- Emailing the invitation to a real mailbox. The email path is tested with an injected sender only. Use `--invite-out` until `RESEND_API_KEY` and a verified sender have been confirmed.
- Provisioning against a managed (remote) PostgreSQL such as Neon, and against a real Firebase project.
- Anything on the existing live deployment. Nothing was deployed and no production data was touched.
