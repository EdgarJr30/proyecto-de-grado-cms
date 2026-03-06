-- ============================================================================
-- assets/02_ticket_assets_policies_patch.sql
-- Ajusta políticas RLS de public.ticket_assets para que la gestión desde OT
-- (vincular, marcar principal y desvincular) funcione con assets:update.
-- ============================================================================

-- Asegura RLS habilitado (idempotente)
ALTER TABLE IF EXISTS public.ticket_assets ENABLE ROW LEVEL SECURITY;

-- Reemplaza políticas para mantener consistencia con permisos del frontend
DROP POLICY IF EXISTS ticket_assets_insert ON public.ticket_assets;
DROP POLICY IF EXISTS ticket_assets_update ON public.ticket_assets;
DROP POLICY IF EXISTS ticket_assets_delete ON public.ticket_assets;

CREATE POLICY ticket_assets_insert
ON public.ticket_assets
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.me_has_permission('assets:update')
    OR public.me_has_permission('assets:full_access')
  )
  AND (created_by IS NULL OR created_by = auth.uid())
);

CREATE POLICY ticket_assets_update
ON public.ticket_assets
FOR UPDATE
TO authenticated
USING (
  public.me_has_permission('assets:update')
  OR public.me_has_permission('assets:full_access')
)
WITH CHECK (
  public.me_has_permission('assets:update')
  OR public.me_has_permission('assets:full_access')
);

CREATE POLICY ticket_assets_delete
ON public.ticket_assets
FOR DELETE
TO authenticated
USING (
  public.me_has_permission('assets:update')
  OR public.me_has_permission('assets:full_access')
);
