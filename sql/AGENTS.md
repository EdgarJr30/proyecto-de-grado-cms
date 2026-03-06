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
