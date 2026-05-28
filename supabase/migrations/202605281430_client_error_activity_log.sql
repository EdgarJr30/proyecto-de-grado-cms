-- Permite registrar errores visibles/no controlados del cliente en public.activity_log.
-- Baseline canonico: sql/modules/core_cmms/17_activity_log.sql

CREATE OR REPLACE FUNCTION public.activity_resource_label_es(p_resource text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_resource
    WHEN 'tickets' THEN 'el ticket'
    WHEN 'users' THEN 'el usuario'
    WHEN 'assignees' THEN 'el técnico'
    WHEN 'locations' THEN 'la ubicación'
    WHEN 'societies' THEN 'la sociedad'
    WHEN 'special_incidents' THEN 'la incidencia'
    WHEN 'announcements' THEN 'el anuncio'
    WHEN 'app_settings' THEN 'la configuración'
    WHEN 'roles' THEN 'el rol'
    WHEN 'permissions' THEN 'el permiso'
    WHEN 'assets' THEN 'el activo'
    WHEN 'asset_categories' THEN 'la categoría de activo'
    WHEN 'parts' THEN 'el repuesto'
    WHEN 'part_categories' THEN 'la categoría de repuesto'
    WHEN 'warehouses' THEN 'el almacén'
    WHEN 'inventory_docs' THEN 'el documento de inventario'
    WHEN 'vendors' THEN 'el proveedor'
    WHEN 'client_errors' THEN 'el error de cliente'
    ELSE p_resource
  END;
$$;

CREATE OR REPLACE FUNCTION public.record_activity(
  p_action       text,
  p_resource     text,
  p_entity_id    text DEFAULT NULL,
  p_entity_label text DEFAULT NULL,
  p_summary      text DEFAULT NULL,
  p_metadata     jsonb DEFAULT '{}'::jsonb,
  p_user_agent   text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  IF p_action NOT IN (
    'auth.login', 'auth.logout',
    'tickets.exported', 'reports.exported',
    'inventory.exported', 'activity_log.exported',
    'client_error.displayed', 'client_error.unhandled'
  ) THEN
    RAISE EXCEPTION 'Acción no permitida para registro manual: %', p_action;
  END IF;

  RETURN public.write_activity_log(
    p_action, p_resource, p_entity_id, p_entity_label, p_summary,
    public.activity_redact_jsonb(COALESCE(p_metadata, '{}'::jsonb)), v_actor, p_user_agent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_activity(text, text, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_activity(text, text, text, text, text, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_activity_log(
  p_search   text DEFAULT NULL,
  p_resource text DEFAULT NULL,
  p_action   text DEFAULT NULL,
  p_actor    uuid DEFAULT NULL,
  p_from     timestamptz DEFAULT NULL,
  p_to       timestamptz DEFAULT NULL,
  p_limit    int DEFAULT 25,
  p_offset   int DEFAULT 0
)
RETURNS TABLE (
  id            uuid,
  occurred_at   timestamptz,
  actor_user_id uuid,
  actor_label   text,
  actor_role    text,
  action        text,
  resource      text,
  entity_id     text,
  entity_label  text,
  summary       text,
  metadata      jsonb,
  ip_address    inet,
  user_agent    text,
  total_count   bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 200);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
  v_search text := NULLIF(trim(COALESCE(p_search, '')), '');
  v_resource text := NULLIF(trim(COALESCE(p_resource, '')), '');
  v_action text := NULLIF(trim(COALESCE(p_action, '')), '');
BEGIN
  IF NOT (public.me_has_permission('logs:read') OR public.me_has_permission('logs:export')) THEN
    RAISE EXCEPTION 'No autorizado para ver la bitácora.';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT a.*
    FROM public.activity_log a
    WHERE (v_resource IS NULL OR a.resource = v_resource)
      AND (v_action IS NULL OR a.action = v_action)
      AND (p_actor IS NULL OR a.actor_user_id = p_actor)
      AND (p_from IS NULL OR a.occurred_at >= p_from)
      AND (p_to IS NULL OR a.occurred_at <= p_to)
      AND (
        v_search IS NULL
        OR a.summary ILIKE '%' || v_search || '%'
        OR a.actor_label ILIKE '%' || v_search || '%'
        OR a.entity_label ILIKE '%' || v_search || '%'
        OR a.action ILIKE '%' || v_search || '%'
        OR a.metadata::text ILIKE '%' || v_search || '%'
      )
  )
  SELECT
    f.id, f.occurred_at, f.actor_user_id, f.actor_label, f.actor_role,
    f.action, f.resource, f.entity_id, f.entity_label, f.summary,
    f.metadata, f.ip_address, f.user_agent,
    count(*) OVER () AS total_count
  FROM filtered f
  ORDER BY f.occurred_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_activity_log(
  text, text, text, uuid, timestamptz, timestamptz, int, int
) TO authenticated;
