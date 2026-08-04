# International Readiness Upgrade — Status & Handover

Tracks work against `Nexus_Dental_International_Readiness_Spec.md` (the build spec handed over 2026-08-03, alongside `Nexus_Dental_Security_and_Data_Protection.pdf` — the sales one-pager whose "Automated backups" claim this work is making true). Commits: [`f444df5`](https://github.com/johnsedofiadakey-hue/Nexus-Dental/commit/f444df5), [`719b588`](https://github.com/johnsedofiadakey-hue/Nexus-Dental/commit/719b588), on `main`, deployed.

**Read this before trusting any other doc in this repo that claims something is "done" or "production-ready" — several existing docs (`SYSTEM_OVERVIEW.md` in particular) are aspirational in places. Everything below is stated as either verified-in-production, verified-in-code-only, or not-started — no in-between.**

---

## Priority 1 — Real backups

### Done and verified in production
- [x] Replaced the fake backup system. `src/lib/system/backups.ts` used to push to an in-memory array that reset on every restart and never wrote a real file — deleted entirely. Real path now: `.github/workflows/backup.yml` → `scripts/run-backup.js` (`pg_dump` → Firebase Storage) → `POST /api/system/backups/complete` → real `BackupLog` row.
- [x] `BACKUP_WEBHOOK_SECRET` created in Google Cloud Secret Manager and IAM-granted to the App Hosting backend (`firebase-app-hosting-compute@nexusdentalsystem.iam.gserviceaccount.com`) — confirmed via `gcloud secrets get-iam-policy`, matches the same binding shape as the working `DATABASE_URL` secret.
- [x] Deployed to production (`nexusdental` backend, rollout succeeded on the second attempt — see "Bugs found & fixed" below for the first attempt's failure).
- [x] Fixed a real bug in `src/middleware.ts`: `/api/*` routes not on an explicit allowlist were rejected with 401 before reaching their own auth logic. This was silently blocking the **existing production Paystack webhook**, not just the new routes added here. Verified live: `POST /api/webhooks/paystack` with no signature now returns the handler's own `{"error":"Invalid signature"}` instead of middleware's `{"success":false,"error":"Authentication required"}` — i.e. real signature verification is now actually running.
- [x] `GET /api/health` confirmed live: `curl https://nexusdental--nexusdentalsystem.us-east4.hosted.app/api/health` → `200 {"status":"ok"}`.

### Not done — needs you, in this order
- [ ] **Add GitHub repo secrets** (github.com → this repo → Settings → Secrets and variables → Actions): `DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT` (paste the JSON from `secrets/firebase-service-account.json`), `FIREBASE_STORAGE_BUCKET`, `APP_URL` (`https://nexusdental--nexusdentalsystem.us-east4.hosted.app`), `BACKUP_WEBHOOK_SECRET` (same value as the one in Secret Manager — rotate it first if you're not sure it's still private, see note below).
- [ ] Run the workflow once manually (GitHub → Actions tab → "Nightly Database Backup" → Run workflow), confirm a real `BackupLog` row lands with `status: COMPLETED` and a real `fileSize`.
- [ ] Do the actual restore test together: create a Neon branch, `pg_restore` the dump into it, verify 5 tables have real rows, time it.
- [ ] Write `RESTORE_RUNBOOK.md` from what that restore test actually did (can't write this ahead of doing it — the whole point is it reflects the real steps, not assumed ones).
- [ ] Once restore-tested, the "Automated backups" claim in the security PDF's source content becomes true rather than aspirational — flag if you want that regenerated.

**Note on the secret you pasted into chat on 2026-08-04:** it matched what's now in Secret Manager. It's low-stakes (only authenticates one internal webhook callback), but since it went through chat in plaintext, consider rotating it (`firebase apphosting:secrets:set BACKUP_WEBHOOK_SECRET --project nexusdentalsystem`, then `firebase apphosting:secrets:grantaccess BACKUP_WEBHOOK_SECRET --backend nexusdental --project nexusdentalsystem`, then update the GitHub secret to match) before using it in the GitHub Actions secret.

---

## Priority 2 — Monitoring & alerting

### Done and verified in production
- [x] `GET /api/health` (public, unauthenticated, checks DB+Redis, `200`/`503`) — this is what an uptime monitor should point at, not the authenticated `/api/system/health`.
- [x] Sentry wired end-to-end in code: `instrumentation-client.ts` (browser), `src/instrumentation.ts` (server + edge init, `onRequestError`), `src/app/global-error.tsx` (root-layout crash boundary), `next.config.ts` (source-map upload, inactive until `SENTRY_AUTH_TOKEN` is set). Confirmed via a full production build with zero Sentry-related warnings. Currently a safe no-op in production — no DSN is configured yet, so it's live but silent.

### Not done — needs you
- [ ] Create a Sentry project (sentry.io, Next.js platform), set the alert email, hand over (or set yourself) `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` — see `.env.example` for the full list including the optional source-map upload vars.
- [ ] Create an UptimeRobot monitor pointed at `https://nexusdental--nexusdentalsystem.us-east4.hosted.app/api/health`, 5-minute interval, alert email set.
- [ ] Once both exist: fire one deliberate test error and one test alert, confirm both land by email — that's the spec's literal "done" bar.

---

## Priority 3 — Stripe for international payments

**Not started.** Parked by agreement — you're creating the Stripe account later. When ready, the plan (already scoped, not yet built): `TenantSettings.paymentProvider` (`PAYSTACK` | `STRIPE`), `Invoice.currency` (defaults `"GHS"`), `Invoice.stripeRef` alongside the existing `paystackRef`, `src/lib/payments/stripe.ts` mirroring `paystack.ts`, `/api/invoices/[id]/stripe-init` and `/api/webhooks/stripe` mirroring the existing Paystack routes. Paystack/GHS stays default and unchanged for Ghana tenants throughout.

---

## Bugs found & fixed along the way (not in the original spec)

1. **Middleware blocking unauthenticated webhooks** — see Priority 1 above. Real, pre-existing, live in production before this work; likely means past Paystack `charge.success` webhook deliveries were failing silently. Worth checking Paystack's dashboard for past webhook delivery failures to confirm the blast radius.
2. **`.env.example` was gitignored** — `.env*` in `.gitignore` swept up the example/docs file along with real `.env` files, so it was never actually tracked in git. Fixed with a `!.env.example` exception; real secret-bearing files remain ignored.
3. **First deploy attempt failed** — `apphosting.yaml` referenced `GITHUB_ACTIONS_TOKEN` as a required secret before that secret existed in Secret Manager. App Hosting secret references must all resolve at build time — one missing optional secret failed the entire build. Removed the reference (it's commented with instructions to re-add once the optional manual-dispatch feature is actually wanted); redeploy succeeded immediately after.

---

## Quick reference

```bash
# Check a Secret Manager secret exists (metadata only, never prints the value)
firebase apphosting:secrets:describe SECRET_NAME --project nexusdentalsystem

# Create/update a secret
firebase apphosting:secrets:set SECRET_NAME --project nexusdentalsystem

# Grant the backend access to it (required — set alone isn't enough)
firebase apphosting:secrets:grantaccess SECRET_NAME --backend nexusdental --project nexusdentalsystem

# Redeploy after any secret or code change
firebase deploy --only apphosting:nexusdental --project nexusdentalsystem

# Check current backend health directly
curl https://nexusdental--nexusdentalsystem.us-east4.hosted.app/api/health
```

Backend has no GitHub auto-deploy connection (`deployment-tool: cli-firebase` in its metadata) — every deploy is manual via the command above, pushing to GitHub alone does not redeploy the app. It does update what `.github/workflows/backup.yml` runs, since that's GitHub's own infrastructure, not App Hosting's.
