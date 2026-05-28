-- Permite consultar la bitacora de un registro especifico sin traer toda la tabla.

DROP FUNCTION IF EXISTS public.list_activity_log(
  text, text, text, uuid, timestamptz, timestamptz, int, int
);

CREATE OR REPLACE FUNCTION public.list_activity_log(
  p_search    text DEFAULT NULL,
  p_resource  text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_action    text DEFAULT NULL,
  p_actor     uuid DEFAULT NULL,
  p_from      timestamptz DEFAULT NULL,
  p_to        timestamptz DEFAULT NULL,
  p_limit     int DEFAULT 25,
  p_offset    int DEFAULT 0
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
  v_entity_id text := NULLIF(trim(COALESCE(p_entity_id, '')), '');
  v_action text := NULLIF(trim(COALESCE(p_action, '')), '');
BEGIN
  IF NOT (public.me_has_permission('logs:read') OR public.me_has_permission('logs:export')) THEN
    RAISE EXCEPTION 'No autorizado para ver la bitacora.';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT a.*
    FROM public.activity_log a
    WHERE (v_resource IS NULL OR a.resource = v_resource)
      AND (v_entity_id IS NULL OR a.entity_id = v_entity_id)
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
  text, text, text, text, uuid, timestamptz, timestamptz, int, int
) TO authenticated;
