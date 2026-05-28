# AGENTS.md

## Scope and Precedence
- This file applies to the whole repository.
- Nested files in `src/`, `sql/`, and `supabase/` override this file for their subtrees.
- If instructions conflict, follow direct user/developer instructions first, then nearest `AGENTS.md`.

## Project Overview
- CMMS frontend for maintenance operations (tickets, work requests/orders, inventory, assets, notifications, and RBAC).
- Frontend stack: React 19 + TypeScript + Vite + Tailwind CSS v4.
- Backend platform: Supabase (Postgres, Auth, RLS, Realtime, Storage, Edge Functions).
- SQL bootstrap and module composition live under `sql/modules`.

## Repository Map
- `src/`: React app, routing, contexts, services, RBAC, pages/components.
- `sql/`: canonical SQL modules for tenant bootstrap and DB feature modules.
- `supabase/`: Edge Function and incremental migration patches.
- `scripts/`: operational scripts (`create-first-admin`, notifications smoke test).
- `public/`: PWA/service worker assets plus deployment headers/redirects.

## Setup and Build Commands
- Install dependencies: `npm install`
- Run dev server: `npm run dev`
- Production build: `npm run build`
- QA build: `npm run build:qa`
- Production-mode build: `npm run build:prod`
- Preview build: `npm run preview`
- Lint: `npm run lint`

## Testing and Validation
- There is no formal unit/integration test suite yet.
- Minimum validation for code changes is `npm run lint` and `npm run build`.
- For notifications/push changes, also run smoke test: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... TEST_RECIPIENT_USER_ID=<uuid> node scripts/notifications-smoke.mjs`
- Perform manual UI checks for changed flows (auth, permissions, affected pages).

## Code Style and Engineering Conventions
- Respect TypeScript strict mode and existing ESLint rules.
- Keep changes scoped and avoid unrelated refactors.
- Reuse existing service/context/routing patterns instead of introducing parallel abstractions.
- Keep permission codes aligned across frontend RBAC and SQL policy/seed definitions.
- Prefer compatibility-safe changes when DB RPCs may not yet exist in all environments.

## Activity Log Requirement (Bitácora) — MANDATORY
- Every new actionable feature MUST be captured in the activity log (`public.activity_log`). "Actionable" = anything that mutates business data (create/update/delete), changes state, assigns/unassigns, comments, or is security-relevant (auth, role/permission changes, exports). Read-only views are NOT logged.
- Default mechanism is the database trigger layer (it cannot be bypassed by the client). When you add a new business table, register it in `public.refresh_activity_logging()` inside `sql/modules/core_cmms/17_activity_log.sql` AND its rollout migration under `supabase/migrations/`.
- For actions the generic table trigger cannot capture well (junction tables without a single `id`, bulk RPC operations, semantic events), call `public.write_activity_log(...)` inside the relevant `SECURITY DEFINER` function/trigger to emit a single readable entry.
- For app-only events the DB cannot see (login/logout, file/CSV exports), call `record_activity(...)` via `src/services/activityLogService.ts` (best-effort, must not block the flow). New manual actions must be added to the whitelist in `record_activity`.
- Never log sensitive values (passwords, tokens, base64 images): rely on/extend the redaction list in `activity_redact_jsonb()` and the generic trigger.
- Gate any new log surface/query behind the `logs:read` / `logs:export` RBAC permissions; do not weaken `activity_log` RLS (SELECT-only by permission, writes only via `SECURITY DEFINER`).
- See `sql/modules/core_cmms/17_activity_log.sql`, `sql/AGENTS.md`, and `src/AGENTS.md` for the concrete patterns.

## Release and Commit Conventions
- Follow Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`, `chore(...)`).
- Use release scripts for versioning: `npm run release:patch`, `npm run release:minor`, `npm run release:major`.
- `preversion` already runs lint + build; `postversion` pushes commits and tags.

## Security Considerations
- Never commit secrets (`.env*`, service role keys, VAPID private keys).
- Frontend must only use `VITE_SUPABASE_ANON_KEY`; service-role keys are server/ops-only.
- Do not weaken or bypass RLS/policies for convenience.
- Preserve security/caching behavior in `public/_headers`, `public/_redirects`, and `public/sw.js`.
- Validate auth and permission boundaries when touching protected routes or RBAC logic.

## Deployment Notes
- SPA routing depends on `public/_redirects` (`/* /index.html 200`).
- Push notifications require SQL notifications setup, Edge Function deploy (`supabase/functions/send-push-from-outbox`), and proper secrets/cron wiring (see `README.md` and `sql/modules/README.md`).
