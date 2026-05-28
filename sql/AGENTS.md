# AGENTS.md (`sql`)

## Scope
- Applies to everything under `sql/`.
- Overrides root `AGENTS.md` for SQL authoring and rollout decisions.

## SQL Source of Truth
- `sql/modules` is the canonical source for provisioning a tenant from zero.
- Current module groups are `core_cmms` (CMMS core, RBAC, tickets, policies, storage, notifications), `assets` (fixed assets + preventive maintenance), and `inventory` (inventory/repuestos scripts; isolated module).
- `sql/Inventario&RepuestosMantenimiento.sql` is the legacy full inventory reference script.

## Execution Order (Do Not Reorder Without Intentional Migration Plan)
- Core CMMS: run `00_extensions.sql` through `16_notifications.sql` in numeric order.
- Assets module: run `01_activos_fijos.sql`, `02_ticket_assets_policies_patch.sql`, `03_preventive_maintenance.sql`.
- Inventory module: run inventory scripts separately from core if object names overlap.
- Keep `sql/modules/README.md` updated when execution order or module composition changes.

## Authoring Conventions
- Prefer idempotent SQL (`IF NOT EXISTS`, guarded `DO $$ ... $$`, `DROP ... IF EXISTS`).
- Keep object ownership explicit by schema (`public`, `auth`, `storage`) where relevant.
- For `SECURITY DEFINER` functions, set explicit `search_path`.
- Keep policies/RLS and grants least-privilege; avoid broad anonymous access.
- Match permission codes with frontend registry (`src/rbac/permissionRegistry.ts`).
- Keep naming and file ordering numeric (`NN_description.sql`) to preserve deterministic bootstrap.

## Activity Log Capture (Bitácora) — MANDATORY
- Source of truth: `core_cmms/17_activity_log.sql`. Any new actionable change (insert/update/delete, state change, assignment, security-relevant op) must produce an `public.activity_log` entry.
- New business table → add its name to `public.refresh_activity_logging()` so the generic `log_activity()` trigger attaches (idempotent; safe to re-run with `SELECT public.refresh_activity_logging();`). Mirror the addition in the rollout migration under `supabase/migrations/`.
- Generic trigger only fits single-`id` tables. For junction tables (no single PK) and bulk RPCs, emit a single semantic entry by calling `public.write_activity_log(action, resource, entity_id, entity_label, summary, metadata, actor)` inside the relevant `SECURITY DEFINER` function/trigger (see `set_role_permissions`, `sync_permissions`, `log_ticket_comment_added`, `log_work_order_assignment_change`).
- Never store sensitive values: extend the redaction list in `activity_redact_jsonb()` if a new column could be sensitive (password/token/image/etc.).
- Do not weaken `activity_log` RLS: SELECT-only, gated by `logs:read`/`logs:export`; writes only through `SECURITY DEFINER` functions (no client INSERT/UPDATE/DELETE grants).

## Testing and Verification
- Validate on a fresh database using module order before promoting to shared environments.
- After policy changes, verify table RLS status, policy existence/compilation, and authorized vs unauthorized behavior.
- After notifications/push-related SQL changes, run smoke flow: `node scripts/notifications-smoke.mjs` with required env vars.
- Use README verification queries for privileges/outbox status after deploy.

## Security and Safety Guardrails
- Treat `sql/modules/inventory/00_inventory_drop_all.sql` as destructive; never run casually.
- Do not mix `inventory` module with `core_cmms` in the same schema when homonymous objects conflict (e.g., `warehouses`, `uoms`) unless migration strategy is explicit.
- Preserve hardening choices in notifications (client restrictions, dedupe, retry, outbox integrity).
- Avoid removing policy checks based on `public.me_has_permission(...)` unless a full RBAC redesign is planned.

## Relationship with `supabase/migrations`
- If you add an incremental patch in `supabase/migrations`, mirror equivalent canonical logic in `sql/modules` when it affects bootstrap behavior.
- Keep migration intent small and explicit; do not hide broad schema refactors in one patch.
