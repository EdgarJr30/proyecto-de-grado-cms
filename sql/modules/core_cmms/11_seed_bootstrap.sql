-- ============================================================
-- CMMS - Tenant bootstrap (idempotente)
-- Ejecutar en el esquema PUBLIC de Supabase
-- ============================================================

-- JOB nocturno para archivar automáticamente a los 14 días
-- Requiere pg_cron (disponible en Supabase)

-- Corre todos los días a las 03:00 AM GMT (ajusta si quieres)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='archive_finalized_tickets') THEN
      PERFORM cron.schedule(
        'archive_finalized_tickets',
        '0 3 * * *',
        $sql$
          update public.tickets
             set is_archived = true
           where is_archived = false
             and status = 'Finalizadas'
             and coalesce(finalized_at, created_at) < now() - interval '14 days';
        $sql$
      );
    END IF;
  END IF;
END$$;

-- =========[ 8) PLACEHOLDERS Y LIMPIEZA DE LEGADO ]=========
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.assignees
    WHERE name='SIN ASIGNAR' AND section='SIN ASIGNAR'
  ) THEN
    INSERT INTO public.assignees(name, last_name, section, is_active)
    VALUES ('SIN ASIGNAR', '', 'SIN ASIGNAR', true);
  END IF;
END$$;

-- Semilla: max 2 secundarios
SELECT public.set_app_setting('max_secondary_assignees', '{"v": 2}'::jsonb);

-- 11) Migración inicial: llevar assignee_id de tickets como PRIMARY activo (solo si no existe ya)
INSERT INTO public.work_order_assignees(work_order_id, assignee_id, role, is_active)
SELECT id, assignee_id, 'PRIMARY'::assignee_role_enum, true
FROM public.tickets
WHERE assignee_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.work_order_assignees wa
    WHERE wa.work_order_id = tickets.id
      AND wa.assignee_id   = tickets.assignee_id
  );
