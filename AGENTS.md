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
