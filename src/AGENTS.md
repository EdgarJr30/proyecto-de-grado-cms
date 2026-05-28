# AGENTS.md (`src`)

## Scope
- Applies to everything under `src/`.
- Overrides root `AGENTS.md` when instructions differ.

## Frontend Overview
- Single-page app with React 19, TypeScript, Vite, Tailwind CSS v4.
- Route registry is centralized in `src/Routes/appRoutes.tsx` using lazy-loaded pages.
- Access control is enforced through `ProtectedRoute` + `RequirePerm` + permissions context.
- Data access is service-driven (`src/services/**`) using Supabase client wrappers.

## Important Files and Responsibilities
- `src/main.tsx`: app bootstrap, providers, global listeners, service worker registration.
- `src/Routes/appRoutes.tsx`: route map, sidebar metadata, permission requirements.
- `src/rbac/permissionRegistry.ts`: frontend permission catalog and code definitions.
- `src/lib/supabaseClient.ts`: authenticated frontend client (anon key only).
- `src/services/**`: DB/RPC interaction layer; keep side effects and error mapping here.

## Coding Conventions
- Use strict TypeScript types; avoid `any` unless absolutely necessary.
- Follow existing formatting style (single quotes, semicolons, concise utility helpers).
- Prefer functional components and hooks; keep business logic in hooks/services when possible.
- Keep user-facing copy consistent with current Spanish UI terminology.
- Reuse existing primitives in `src/components/ui` before adding new component patterns.
- After mutations, dispatch `invalidateData(...)` for relevant domains when needed.
- Preserve backward-compatible fallbacks where services already support missing RPCs.

## Activity Log Events (Bitácora) — MANDATORY
- Data mutations are already captured by DB triggers; do NOT duplicate them from the client.
- Only app-level actions the database cannot observe must be logged from `src`: auth (login/logout), file/CSV exports, and similar. Use `recordActivity(...)` / `recordAuthEvent(...)` from `src/services/activityLogService.ts` (best-effort, never block the flow).
- Any new manual action string must also be whitelisted in the `record_activity` RPC (see `sql/modules/core_cmms/17_activity_log.sql`); otherwise it is rejected server-side.
- New log views/queries must go through `list_activity_log` and stay gated by `logs:read` / `logs:export`. Keep the export button visible only with `logs:export`.

## Environment Variables Used by Frontend
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_WEB_PUSH_PUBLIC_KEY`
- `VITE_APP_ENV`
- `VITE_ENABLE_REMOTE_REPORT_LAYOUT`

## Build and Test Instructions
- Required before handoff: `npm run lint` and `npm run build`.
- Recommended manual checks for touched areas:
- Auth + protected navigation (`/login`, protected route redirects, `/403`)
- Ticket lifecycle (`/crear-ticket`, `/solicitudes`, `/ordenes_trabajo`, `/tickets/:id`)
- Admin/RBAC screens (`/admin_usuarios`, `/admin/roles*`, settings modules)
- Inventory/assets pages if impacted
- Notification center and badge behavior if impacted
- Push/PWA behavior if impacted (`/notificaciones`, service worker interactions)

## Security and Reliability Rules
- Never expose or reference service-role credentials in `src`.
- Keep permission checks aligned with backend policies (do not trust UI-only gating).
- Do not remove session hardening patterns in auth flows without a replacement.
- Keep notification URLs internal (`/path`) unless there is an explicit trusted requirement.
- Preserve reduced-motion and accessibility-safe behavior in interactive UI changes.

## Performance Notes
- The current build reports large chunks; prefer lazy loading and scoped imports for new features.
- Avoid adding heavy libraries without confirming they are necessary for the target flow.
