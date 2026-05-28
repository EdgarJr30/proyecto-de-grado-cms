-- =========[ 17) ACTIVITY LOG (BITÁCORA DE AUDITORÍA) ]=========
--
-- Bitácora append-only e inmutable de toda mutación relevante de la plataforma
-- (tickets, asignaciones, comentarios/chat, usuarios, roles/permisos, catálogos,
-- inventario y activos) más eventos de seguridad de app (login/logout, exportes).
--
-- Captura:
--   1) Triggers genéricos AFTER INSERT/UPDATE/DELETE -> public.log_activity()
--   2) Triggers semánticos (comentarios, asignaciones) para entradas legibles
--   3) Logging dentro de RPCs sensibles (ver 04_functions_triggers.sql)
--   4) RPC public.record_activity(...) para eventos de app (login/exportes)
--
-- Acceso: RLS solo SELECT para quien tenga 'logs:read' o 'logs:export'.
-- Escrituras: únicamente vía funciones SECURITY DEFINER (sin policies de cliente).

-- -----------------------------------------------------------------------------
-- 1) Tabla
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.activity_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  actor_label   text NULL,          -- snapshot del nombre/email del actor
  actor_role    text NULL,          -- snapshot del rol principal
  action        text NOT NULL,      -- p.ej. 'ticket.created', 'ticket.assigned', 'user.updated'
  resource      text NOT NULL,      -- p.ej. 'tickets', 'users', 'rbac', 'auth'
  entity_id     text NULL,          -- id de la fila afectada (cast a text)
  entity_label  text NULL,          -- texto legible (título/nombre/código)
  summary       text NULL,          -- frase legible en español para la UI
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,  -- diff old/new + contexto
  ip_address    inet NULL,          -- reservado para eventos vía edge function
  user_agent    text NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_occurred_at
  ON public.activity_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor
  ON public.activity_log (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity
  ON public.activity_log (resource, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action
  ON public.activity_log (action);
CREATE INDEX IF NOT EXISTS idx_activity_log_metadata_gin
  ON public.activity_log USING gin (metadata);

-- -----------------------------------------------------------------------------
-- 2) Helpers
-- -----------------------------------------------------------------------------

-- Redacta claves sensibles de un objeto jsonb (no se guardan valores reales).
CREATE OR REPLACE FUNCTION public.activity_redact_jsonb(p_obj jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_key text;
  v_out jsonb := COALESCE(p_obj, '{}'::jsonb);
  v_patterns text[] := ARRAY[
    'password', 'token', 'encrypted', 'p256dh', 'secret',
    'image', 'logo_url', 'login_img'
  ];
BEGIN
  FOR v_key IN SELECT jsonb_object_keys(v_out) LOOP
    IF EXISTS (SELECT 1 FROM unnest(v_patterns) p WHERE v_key ILIKE '%' || p || '%') THEN
      v_out := jsonb_set(v_out, ARRAY[v_key], '"[omitido]"'::jsonb);
    END IF;
  END LOOP;
  RETURN v_out;
END;
$$;

-- Etiqueta legible (español) por recurso para construir el summary.
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
    ELSE p_resource
  END;
$$;

-- Inserción central de bitácora (resuelve snapshot del actor). SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.write_activity_log(
  p_action       text,
  p_resource     text,
  p_entity_id    text,
  p_entity_label text,
  p_summary      text,
  p_metadata     jsonb,
  p_actor        uuid DEFAULT NULL,
  p_user_agent   text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(p_actor, auth.uid());
  v_actor_label text;
  v_actor_role text;
  v_id uuid;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT
      COALESCE(
        NULLIF(trim(concat_ws(' ', u.name, u.last_name)), ''),
        u.email
      ),
      r.name
    INTO v_actor_label, v_actor_role
    FROM public.users u
    LEFT JOIN public.roles r ON r.id = u.rol_id
    WHERE u.id = v_actor;
  END IF;

  INSERT INTO public.activity_log (
    actor_user_id, actor_label, actor_role, action, resource,
    entity_id, entity_label, summary, metadata, user_agent
  )
  VALUES (
    v_actor, v_actor_label, v_actor_role, p_action, p_resource,
    p_entity_id, p_entity_label, p_summary,
    COALESCE(p_metadata, '{}'::jsonb), p_user_agent
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3) Trigger genérico de captura
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new jsonb;
  v_old jsonb;
  v_diff jsonb := '{}'::jsonb;
  v_meta jsonb;
  v_entity_id text;
  v_entity_label text;
  v_resource text := TG_TABLE_NAME;
  v_verb text;
  v_verb_es text;
  v_action text;
  v_summary text;
  v_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW); v_verb := 'created'; v_verb_es := 'creó';
  ELSIF TG_OP = 'UPDATE' THEN
    v_new := to_jsonb(NEW); v_old := to_jsonb(OLD); v_verb := 'updated'; v_verb_es := 'actualizó';
  ELSE
    v_old := to_jsonb(OLD); v_verb := 'deleted'; v_verb_es := 'eliminó';
  END IF;

  v_action := v_resource || '.' || v_verb;

  v_entity_id := COALESCE(
    v_new->>'id', v_old->>'id',
    v_new->>'key', v_old->>'key',
    v_new->>'code', v_old->>'code'
  );

  v_entity_label := COALESCE(
    v_new->>'title', v_old->>'title',
    NULLIF(trim(concat_ws(' ', v_new->>'name', v_new->>'last_name')), ''),
    NULLIF(trim(concat_ws(' ', v_old->>'name', v_old->>'last_name')), ''),
    v_new->>'name', v_old->>'name',
    v_new->>'code', v_old->>'code'
  );

  IF TG_OP = 'UPDATE' THEN
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key IN ('updated_at', 'updated_by', 'created_at') THEN CONTINUE; END IF;
      IF (v_new -> v_key) IS DISTINCT FROM (v_old -> v_key) THEN
        v_diff := v_diff || jsonb_build_object(
          v_key,
          public.activity_redact_jsonb(
            jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key)
          )
        );
      END IF;
    END LOOP;

    -- Sin cambios significativos -> no se registra.
    IF v_diff = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

    v_meta := jsonb_build_object('changes', v_diff);
  ELSIF TG_OP = 'INSERT' THEN
    v_meta := jsonb_build_object('new', public.activity_redact_jsonb(v_new));
  ELSE
    v_meta := jsonb_build_object('old', public.activity_redact_jsonb(v_old));
  END IF;

  v_summary := format(
    'Se %s %s%s',
    v_verb_es,
    public.activity_resource_label_es(v_resource),
    CASE WHEN v_entity_id IS NOT NULL THEN ' #' || v_entity_id ELSE '' END
  );

  PERFORM public.write_activity_log(
    v_action, v_resource, v_entity_id, v_entity_label, v_summary, v_meta
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Engancha el trigger genérico a una tabla (idempotente, omite si no existe).
CREATE OR REPLACE FUNCTION public.attach_activity_logging(p_table text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN;
  END IF;
  EXECUTE format('DROP TRIGGER IF EXISTS trg_activity_log ON public.%I;', p_table);
  EXECUTE format(
    'CREATE TRIGGER trg_activity_log AFTER INSERT OR UPDATE OR DELETE ON public.%I '
    || 'FOR EACH ROW EXECUTE FUNCTION public.log_activity();',
    p_table
  );
END;
$$;

-- (Re)engancha el logging a todas las tablas de negocio existentes.
-- Es idempotente y se puede llamar tras crear módulos (assets/inventory).
-- NOTA: tablas de unión sin PK simple (work_order_assignees, role_permissions,
-- user_roles) y catálogos ruidosos (permissions) se cubren con eventos
-- semánticos, no con el trigger genérico.
CREATE OR REPLACE FUNCTION public.refresh_activity_logging()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    -- core
    'tickets', 'users', 'assignees', 'locations', 'societies',
    'special_incidents', 'announcements', 'app_settings', 'roles',
    -- assets
    'assets', 'asset_categories', 'asset_preventive_maintenance_plans',
    'asset_preventive_maintenance_runs',
    -- inventory
    'warehouses', 'warehouse_bins', 'uoms', 'parts', 'part_categories',
    'part_costs', 'part_vendors', 'vendors', 'inventory_docs',
    'inventory_doc_lines', 'reorder_policies'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    PERFORM public.attach_activity_logging(v_table);
  END LOOP;
END;
$$;

SELECT public.refresh_activity_logging();

-- -----------------------------------------------------------------------------
-- 4) Triggers semánticos (legibles): comentarios / asignaciones
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_ticket_comment_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
BEGIN
  SELECT title INTO v_title FROM public.tickets WHERE id = NEW.ticket_id;

  PERFORM public.write_activity_log(
    'ticket.comment_added',
    'tickets',
    NEW.ticket_id::text,
    COALESCE(v_title, 'Ticket #' || NEW.ticket_id),
    format('Comentario agregado en ticket #%s', NEW.ticket_id),
    jsonb_build_object('comment_id', NEW.id, 'preview', left(trim(NEW.body), 240)),
    NEW.author_user_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_ticket_comment_added ON public.ticket_comments;
CREATE TRIGGER trg_log_ticket_comment_added
AFTER INSERT ON public.ticket_comments
FOR EACH ROW
EXECUTE FUNCTION public.log_ticket_comment_added();

CREATE OR REPLACE FUNCTION public.log_work_order_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(NEW.updated_by, NEW.created_by, auth.uid());
  v_event text;
  v_assignee_name text;
  v_title text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
    v_event := 'ticket.assigned';
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active = false AND NEW.is_active = true THEN
    v_event := 'ticket.assigned';
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    v_event := 'ticket.unassigned';
  ELSE
    RETURN NEW;
  END IF;

  SELECT concat_ws(' ', a.name, a.last_name)
  INTO v_assignee_name
  FROM public.assignees a
  WHERE a.id = NEW.assignee_id;

  SELECT title INTO v_title FROM public.tickets WHERE id = NEW.work_order_id;

  PERFORM public.write_activity_log(
    v_event,
    'tickets',
    NEW.work_order_id::text,
    COALESCE(v_title, 'Ticket #' || NEW.work_order_id),
    CASE
      WHEN v_event = 'ticket.assigned'
        THEN format('Ticket #%s asignado a %s', NEW.work_order_id, COALESCE(v_assignee_name, 'técnico #' || NEW.assignee_id))
      ELSE format('Ticket #%s desasignado de %s', NEW.work_order_id, COALESCE(v_assignee_name, 'técnico #' || NEW.assignee_id))
    END,
    jsonb_build_object('assignee_id', NEW.assignee_id, 'role', NEW.role),
    v_actor
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_work_order_assignment ON public.work_order_assignees;
CREATE TRIGGER trg_log_work_order_assignment
AFTER INSERT OR UPDATE ON public.work_order_assignees
FOR EACH ROW
EXECUTE FUNCTION public.log_work_order_assignment_change();

-- -----------------------------------------------------------------------------
-- 5) RPC: eventos de app (login/logout, exportes)
-- -----------------------------------------------------------------------------

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

  -- Lista blanca de acciones que el cliente puede registrar manualmente
  -- (evita falsificar entradas de auditoría desde el frontend).
  IF p_action NOT IN (
    'auth.login', 'auth.logout',
    'tickets.exported', 'reports.exported',
    'inventory.exported', 'activity_log.exported'
  ) THEN
    RAISE EXCEPTION 'Acción no permitida para registro manual: %', p_action;
  END IF;

  RETURN public.write_activity_log(
    p_action, p_resource, p_entity_id, p_entity_label, p_summary,
    COALESCE(p_metadata, '{}'::jsonb), v_actor, p_user_agent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_activity(text, text, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_activity(text, text, text, text, text, jsonb, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6) RPC: lectura con filtros + paginación (exige permiso de logs)
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 7) RLS + grants (solo lectura, condicionada a permiso)
-- -----------------------------------------------------------------------------

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_log_select_by_perm ON public.activity_log;
CREATE POLICY activity_log_select_by_perm
ON public.activity_log
FOR SELECT TO authenticated
USING (
  public.me_has_permission('logs:read')
  OR public.me_has_permission('logs:export')
);

-- Sin policies de INSERT/UPDATE/DELETE: las escrituras solo ocurren vía
-- funciones SECURITY DEFINER (write_activity_log / record_activity).
REVOKE INSERT, UPDATE, DELETE ON public.activity_log FROM authenticated;
GRANT SELECT ON public.activity_log TO authenticated;

-- -----------------------------------------------------------------------------
-- 8) Retención (opcional, configurable vía app_settings)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_activity_log()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days int := public.get_app_setting_int('activity_log_retention_days', 365);
BEGIN
  IF v_days <= 0 THEN
    RETURN;
  END IF;
  DELETE FROM public.activity_log
  WHERE occurred_at < now() - make_interval(days => v_days);
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge_activity_log') THEN
      PERFORM cron.schedule(
        'purge_activity_log',
        '30 3 * * *',
        $cron$SELECT public.purge_activity_log();$cron$
      );
    END IF;
  END IF;
END$$;
