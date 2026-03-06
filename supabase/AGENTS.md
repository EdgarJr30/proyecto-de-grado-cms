# AGENTS.md (`supabase`)

## Scope
- Applies to everything under `supabase/`.
- Overrides root `AGENTS.md` for edge function and migration work in this directory.

## Directory Overview
- `supabase/functions/send-push-from-outbox`: Deno edge worker for push delivery outbox processing.
- `supabase/migrations`: incremental SQL patches for deployed environments.

## Workflow Rules
- Treat `sql/modules` as canonical bootstrap source; keep `supabase/migrations` focused on incremental rollout patches.
- When a migration changes long-term baseline behavior, reflect it in `sql/modules` and related docs.
- Name migration files with sortable timestamps and concise intent.

## Edge Function Standards (`send-push-from-outbox`)
- Keep strict env validation at startup (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, VAPID keys).
- Preserve claim-and-process pattern (`claim_notification_outbox_batch`) to avoid duplicate sends.
- Keep retry/backoff logic bounded and configurable through env vars.
- Maintain cleanup of expired subscriptions (404/410 cases).
- Keep response payloads operationally useful (`claimed`, `processed`, `sent`, `failed`).

## Commands and Operations
- Deploy function: `npx supabase@latest functions deploy send-push-from-outbox --project-ref <project-ref>`
- Recommended manual invoke (batch): `curl -X POST "https://<project-ref>.functions.supabase.co/send-push-from-outbox?limit=100" -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "x-cron-secret: <PUSH_OUTBOX_CRON_SECRET>"`
- Recommended manual invoke (single outbox row): `curl -X POST "https://<project-ref>.functions.supabase.co/send-push-from-outbox?outbox_id=<uuid>&limit=1" -H "Authorization: Bearer <SERVICE_ROLE_KEY>" -H "x-cron-secret: <PUSH_OUTBOX_CRON_SECRET>"`
- Smoke validation: `node scripts/notifications-smoke.mjs` with required env vars from repo root.

## Security Requirements
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `VAPID_PRIVATE_KEY` to client-side code.
- Keep `x-cron-secret` validation enabled whenever `PUSH_OUTBOX_CRON_SECRET` is configured.
- Do not broaden function access patterns without explicit review.
- Migrations must not weaken RLS/policies unintentionally; review auth implications for each change.

## Post-Deploy Verification Checklist
- Function secrets are set correctly.
- Outbox rows transition as expected (`pending`/`processing` -> `sent` or `error` with retries).
- Realtime tables and replica identity requirements remain configured.
- Notification center and push flows still work from frontend (`/notificaciones` + ticket navigation links).
