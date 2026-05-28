-- =============================================================================
-- Acceso de la OT para el técnico asignado SIN full_access — idempotente
-- =============================================================================
-- Copia y pega TODO este archivo en el SQL Editor de Supabase y ejecútalo.
--
-- Objetivo: un usuario con work_orders:read_own (sin full_access) que es el
-- TÉCNICO ASIGNADO de una OT pueda VERLA y OPERARLA (cambiar estado, enviar a
-- validación, llenar checklist) sin necesidad de work_orders:full_access.
--
-- Cambios:
--   1) helper is_ticket_assigned_technician (por si la migración del checklist
--      aún no se aplicó) + RPC am_i_ticket_assigned_technician para el frontend.
--   2) tickets_select_work_orders: read_own ahora incluye las OT asignadas a mí
--      (además de las que yo creé).
--   3) tickets_update_work_orders: el técnico asignado puede actualizar su OT.
-- Baseline canónico: sql/modules/core_cmms/09_policies.sql

-- -----------------------------------------------------------------------------
-- 1) Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_ticket_assigned_technician(p_uid uuid, p_ticket_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assignees a
    WHERE a.user_id = p_uid
      AND (
        EXISTS (
          SELECT 1 FROM public.work_order_assignees wa
          WHERE wa.work_order_id = p_ticket_id
            AND wa.assignee_id = a.id
            AND wa.is_active = true
        )
        OR EXISTS (
          SELECT 1 FROM public.tickets t
          WHERE t.id = p_ticket_id AND t.assignee_id = a.id
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.am_i_ticket_assigned_technician(p_ticket_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_ticket_assigned_technician(auth.uid(), p_ticket_id);
$$;

GRANT EXECUTE ON FUNCTION public.is_ticket_assigned_technician(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.am_i_ticket_assigned_technician(bigint) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2) SELECT: read_own incluye OT creadas por mí o asignadas a mí
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS tickets_select_work_orders ON public.tickets;
CREATE POLICY tickets_select_work_orders
ON public.tickets FOR SELECT TO authenticated
USING (
  is_accepted = true AND (
    public.me_has_permission('work_orders:read')
    OR public.me_has_permission('work_orders:full_access')
    OR (
      public.me_has_permission('work_orders:read_own')
      AND (
        created_by = auth.uid()
        OR public.is_ticket_assigned_technician(auth.uid(), id)
      )
    )
  )
);

-- -----------------------------------------------------------------------------
-- 3) UPDATE: el técnico asignado puede actualizar su OT
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS tickets_update_work_orders ON public.tickets;
CREATE POLICY tickets_update_work_orders
ON public.tickets FOR UPDATE TO authenticated
USING (
  is_accepted = true AND (
    public.me_has_permission('work_orders:full_access')
    OR (public.me_has_permission('work_orders:create') AND created_by = auth.uid())
    OR public.is_ticket_assigned_technician(auth.uid(), id)
  )
)
WITH CHECK (
  is_accepted = true AND (
    public.me_has_permission('work_orders:full_access')
    OR (public.me_has_permission('work_orders:create') AND created_by = auth.uid())
    OR public.is_ticket_assigned_technician(auth.uid(), id)
  )
);
