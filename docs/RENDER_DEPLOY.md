# Deploying the demo to Render

A **synthetic-data** demonstration on Render. It uses its own database and Redis, not the production
`.env` ones. It is not approval for real patients. `render.yaml` at the repository root describes
everything; this page is what to do around it.

## What gets created

| Resource | Type | Notes |
|---|---|---|
| `nexus-dental-demo` | Web service (Node 22) | `npm run build`, `npm start`; runs `prisma migrate deploy` before each release |
| `nexus-demo-worker` | Background worker (Docker, `Dockerfile.worker`) | The only reminder worker; **must be a paid, always-on instance** |
| `nexus-demo-db` | Postgres 16 | Fresh database, built purely from the migrations (the tested clean-install path) |
| `nexus-demo-redis` | Key Value, `noeviction` | BullMQ queues; eviction would lose jobs |

Approximate cost is the starter web and worker instances, the smallest paid Postgres and the starter Key Value store. Check Render's current pricing before creating them.

## Steps

1. **Push the branch** `claude/c1-single-clinic-provisioning` to GitHub (the blueprint deploys from it).
2. In Render: **Environment Groups → New**, name it exactly `nexus-secrets`, and add:

   | Key | Value |
   |---|---|
   | `JWT_SECRET` | 48+ random characters, e.g. `openssl rand -base64 48` (shared by web and worker) |
   | `MNOTIFY_API_KEY` | the mNotify key |
   | `MNOTIFY_SENDER_ID` | the approved sender ID (1–11 characters) |
   | `DEMO_SMS_ALLOWLIST` | the numbers the demo may text, E.164, comma-separated, e.g. `+233201234567` |
   | `OPS_WATCHDOG_SECRET` | optional, random |
   | `ALERT_EMAIL_TO` | optional |

3. **New → Blueprint**, pick the repository and this branch, and apply. Both services must start;
   a service that refuses to start names the missing variable (never a value) in its logs.
   If Render appends a suffix to the web service URL (the name was taken), change `NEXT_PUBLIC_APP_URL`,
   `NEXT_PUBLIC_API_URL` in `render.yaml` and `deployment.appUrl` in `clients/nexus-demo/clinic.yaml` to the real URL and redeploy; it is baked in at build time.
4. **Provision the clinic and the synthetic data** from your computer, using the database's **External** connection string (Render → `nexus-demo-db` → Connections). Put the demo environment in a file outside the repository and never run these with the repository `.env`:

   ```bash
   env -i HOME="$HOME" PATH="$PATH" bash -c '
     set -a; . ~/.nexus-secrets/render-demo.env; set +a
     npm run clinic:provision -- --manifest clients/nexus-demo/clinic.yaml --skip-owner-invite
     npm run demo:provision -- --check
     npm run demo:provision -- --confirm-clinic nexus-demo --credentials-out ~/.nexus-secrets/demo-accounts.txt
     npm run demo:provision -- --check
   '
   ```

   `render-demo.env` holds `DATABASE_URL` (external), `CLINIC_ID=nexus-demo`, `DEPLOYMENT_MODE=single_clinic`, `ENABLED_FEATURES=mnotify`, `DEMO_MODE=true`, `SMS_PROVIDER=mnotify`, the mNotify key/sender, `DEMO_SMS_ALLOWLIST`, `DEMO_PATIENT_PHONE` (a phone you control, on the allowlist), and the Firebase `NEXT_PUBLIC_*` values from `render.yaml`. The staff passwords exist only in `demo-accounts.txt` (mode 0600).
5. **Firebase console** (project `nexusdentalsystem`): Authentication → Sign-in method → Phone is enabled; Settings → Authorised domains includes `nexus-dental-demo.onrender.com`; add a test phone number with a fixed code for `DEMO_PATIENT_PHONE`, or use a phone you hold.
6. **Verify** (details in `docs/LIVE_DEMO_AND_SMS.md` §3):
   - `GET https://nexus-dental-demo.onrender.com/api/health` reports workers `ok` (a fresh worker heartbeat).
   - `npm run sms:test -- --to <allowlisted number> --confirm-send` sends one real SMS.
   - Book an appointment about 75 minutes ahead for the demo patient and watch two reminders go `PENDING` → `SENT`.

## Notes

- The web service uses the production Firebase project for sign-in only; file uploads are not configured for the demo (no service-account file), and Paystack, Hubtel and e-mail are off, so the demo takes cash payments only and cannot charge a card.
- After provisioning you may restrict the database's allowed IPs in Render.
- Re-deploys are safe: migrations are idempotent and `clinic:provision` / `demo:provision` can be re-run.
- Not verified from this repository: that Render accepts the blueprint as written (it validates it when applied), phone login against the real Firebase project, and the worker against a real Redis.
