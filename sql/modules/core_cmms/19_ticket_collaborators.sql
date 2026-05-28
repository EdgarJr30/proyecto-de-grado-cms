-- =============================================================================
-- Colaboradores de ticket (estilo Asana)
-- =============================================================================
-- Un colaborador es un USUARIO de la plataforma (no un assignee/responsable).
-- No tiene responsabilidad sobre la orden: solo-lectura de los datos + acceso al
-- chat del ticket, y recibe en su inbox TODAS las notificaciones del ticket.
--
-- Gestión: la pueden hacer admins (work_orders:full_access) y el técnico
-- responsable (principal/secundario activo) del ticket.
-- Las escrituras van únicamente por RPCs SECURITY DEFINER (sin policies de cliente).
-- Idempotente.

-- -----------------------------------------------------------------------------
-- 1) Tabla
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_collaborators (
  ticket_id  bigint NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id    uuid   NOT NULL REFERENCES public.users(id)   ON DELETE CASCADE,
  added_by   uuid   REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_collaborators_ticket
  ON public.ticket_collaborators (ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_collaborators_user
  ON public.ticket_collaborators (user_id);

-- -----------------------------------------------------------------------------
-- 2) Helpers
-- -----------------------------------------------------------------------------

-- ¿El usuario es responsable (principal/secundario activo o assignee legacy) del ticket?
CREATE OR REPLACE FUNCTION public.is_ticket_responsible(p_uid uuid, p_ticket_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.work_order_assignees wa
    JOIN public.assignees a ON a.id = wa.assignee_id
    WHERE wa.work_order_id = p_ticket_id
      AND wa.is_active = true
      AND a.user_id = p_uid
  )
  OR EXISTS (
    SELECT 1
    FROM public.tickets t
    JOIN public.assignees a ON a.id = t.assignee_id
    WHERE t.id = p_ticket_id
      AND a.user_id = p_uid
  );
$$;

-- ¿El usuario actual puede gestionar colaboradores del ticket?
CREATE OR REPLACE FUNCTION public.can_i_manage_ticket_collaborators(p_ticket_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.me_has_permission('work_orders:full_access')
      OR public.is_ticket_responsible(auth.uid(), p_ticket_id);
$$;

GRANT EXECUTE ON FUNCTION public.is_ticket_responsible(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_i_manage_ticket_collaborators(bigint) TO authenticated;

-- IDs de colaboradores (para componer destinatarios de notificaciones).
CREATE OR REPLACE FUNCTION public.get_ticket_collaborator_user_ids(p_ticket_id bigint)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT user_id), ARRAY[]::uuid[])
  FROM public.ticket_collaborators
  WHERE ticket_id = p_ticket_id;
$$;

-- -----------------------------------------------------------------------------
-- 3) RPCs
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_ticket_collaborator(p_ticket_id bigint, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_title text;
  v_label text;
  v_inserted boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario inválido.';
  END IF;
  IF NOT public.can_i_manage_ticket_collaborators(p_ticket_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar colaboradores de este ticket.';
  END IF;

  INSERT INTO public.ticket_collaborators(ticket_id, user_id, added_by)
  VALUES (p_ticket_id, p_user_id, v_uid)
  ON CONFLICT (ticket_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF NOT v_inserted THEN
    RETURN;  -- ya era colaborador: no duplicar bitácora/notificación
  END IF;

  SELECT title INTO v_title FROM public.tickets WHERE id = p_ticket_id;
  SELECT NULLIF(trim(concat_ws(' ', name, last_name)), '')
    INTO v_label FROM public.users WHERE id = p_user_id;

  PERFORM public.write_activity_log(
    'ticket.collaborator_added', 'tickets', p_ticket_id::text,
    COALESCE(v_title, 'Ticket #' || p_ticket_id),
    format('Colaborador agregado al ticket #%s', p_ticket_id),
    jsonb_build_object('user_id', p_user_id, 'collaborator', v_label),
    v_uid
  );

  PERFORM public.create_notification_event(
    'ticket.collaborator_added', v_uid, 'ticket', p_ticket_id::text,
    jsonb_build_object(
      'ticket_id', p_ticket_id,
      'title', v_title,
      'message', format(
        'Te agregaron como colaborador del ticket #%s (%s).',
        p_ticket_id, COALESCE(v_title, 'sin título')
      ),
      'url', format('/tickets/%s', p_ticket_id),
      'notify_actor', true
    ),
    ARRAY[p_user_id], 3
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_ticket_collaborator(p_ticket_id bigint, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_title text;
  v_deleted boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;
  IF NOT public.can_i_manage_ticket_collaborators(p_ticket_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar colaboradores de este ticket.';
  END IF;

  DELETE FROM public.ticket_collaborators
  WHERE ticket_id = p_ticket_id AND user_id = p_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF NOT v_deleted THEN
    RETURN;
  END IF;

  SELECT title INTO v_title FROM public.tickets WHERE id = p_ticket_id;

  PERFORM public.write_activity_log(
    'ticket.collaborator_removed', 'tickets', p_ticket_id::text,
    COALESCE(v_title, 'Ticket #' || p_ticket_id),
    format('Colaborador removido del ticket #%s', p_ticket_id),
    jsonb_build_object('user_id', p_user_id),
    v_uid
  );
END;
$$;

-- Colaboradores actuales del ticket (para la UI).
CREATE OR REPLACE FUNCTION public.get_ticket_collaborators(p_ticket_id bigint)
RETURNS TABLE (user_id uuid, full_name text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    public.can_i_manage_ticket_collaborators(p_ticket_id)
    OR public.me_has_permission('work_orders:read')
    OR EXISTS (
      SELECT 1 FROM public.ticket_collaborators c
      WHERE c.ticket_id = p_ticket_id AND c.user_id = auth.uid()
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, NULLIF(trim(concat_ws(' ', u.name, u.last_name)), ''), u.email
  FROM public.ticket_collaborators c
  JOIN public.users u ON u.id = c.user_id
  WHERE c.ticket_id = p_ticket_id
  ORDER BY u.name NULLS LAST, u.last_name NULLS LAST, u.email;
END;
$$;

-- Usuarios candidatos a colaborador (excluye responsables y ya-colaboradores).
-- SECURITY DEFINER: el responsable puede no tener 'users:read'.
CREATE OR REPLACE FUNCTION public.list_collaborator_candidates(
  p_ticket_id bigint,
  p_search text DEFAULT NULL
)
RETURNS TABLE (user_id uuid, full_name text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_search text := NULLIF(trim(COALESCE(p_search, '')), '');
BEGIN
  IF NOT public.can_i_manage_ticket_collaborators(p_ticket_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, NULLIF(trim(concat_ws(' ', u.name, u.last_name)), ''), u.email
  FROM public.users u
  WHERE u.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.ticket_collaborators c
      WHERE c.ticket_id = p_ticket_id AND c.user_id = u.id
    )
    AND NOT public.is_ticket_responsible(u.id, p_ticket_id)
    AND (
      v_search IS NULL
      OR concat_ws(' ', u.name, u.last_name) ILIKE '%' || v_search || '%'
      OR u.email ILIKE '%' || v_search || '%'
    )
  ORDER BY u.name NULLS LAST, u.last_name NULLS LAST, u.email
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.add_ticket_collaborator(bigint, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_ticket_collaborator(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_ticket_collaborator(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_ticket_collaborator(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket_collaborators(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_collaborator_candidates(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket_collaborator_user_ids(bigint) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) RLS (solo SELECT a cliente; escrituras vía RPC)
-- -----------------------------------------------------------------------------

ALTER TABLE public.ticket_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_collaborators_select ON public.ticket_collaborators;
CREATE POLICY ticket_collaborators_select ON public.ticket_collaborators
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.me_has_permission('work_orders:read')
  OR public.me_has_permission('work_orders:full_access')
  OR public.is_ticket_responsible(auth.uid(), ticket_id)
);

GRANT SELECT ON public.ticket_collaborators TO authenticated;

-- -----------------------------------------------------------------------------
-- 5) Chat: dar acceso (lectura + escritura) a los colaboradores
--    (re-crea las policies de ticket_comments definidas en 16_notifications.sql)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS ticket_comments_select_involved ON public.ticket_comments;
CREATE POLICY ticket_comments_select_involved
ON public.ticket_comments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = ticket_comments.ticket_id
      AND (
        t.created_by = auth.uid()
        OR public.me_has_permission('work_orders:read')
        OR public.me_has_permission('work_orders:full_access')
        OR public.me_has_permission('work_requests:read')
        OR public.me_has_permission('work_requests:full_access')
        OR EXISTS (
          SELECT 1
          FROM public.work_order_assignees wa
          JOIN public.assignees a ON a.id = wa.assignee_id
          WHERE wa.work_order_id = t.id
            AND wa.is_active = true
            AND a.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.ticket_collaborators c
          WHERE c.ticket_id = t.id AND c.user_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS ticket_comments_insert_involved ON public.ticket_comments;
CREATE POLICY ticket_comments_insert_involved
ON public.ticket_comments
FOR INSERT TO authenticated
WITH CHECK (
  author_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = ticket_comments.ticket_id
      AND (
        t.created_by = auth.uid()
        OR public.me_has_permission('work_orders:full_access')
        OR public.me_has_permission('work_requests:full_access')
        OR EXISTS (
          SELECT 1
          FROM public.work_order_assignees wa
          JOIN public.assignees a ON a.id = wa.assignee_id
          WHERE wa.work_order_id = t.id
            AND wa.is_active = true
            AND a.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1
          FROM public.ticket_collaborators c
          WHERE c.ticket_id = t.id AND c.user_id = auth.uid()
        )
      )
  )
);

-- -----------------------------------------------------------------------------
-- 6) Notificaciones: incluir colaboradores en TODOS los eventos del ticket
--    (re-define get_ticket_recipient_user_ids de 16_notifications.sql)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_ticket_recipient_user_ids(
  p_ticket_id bigint,
  p_admin_permission_codes text[]
)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recipients AS (
    SELECT t.created_by AS user_id
    FROM public.tickets t
    WHERE t.id = p_ticket_id

    UNION

    SELECT a.user_id AS user_id
    FROM public.work_order_assignees wa
    JOIN public.assignees a ON a.id = wa.assignee_id
    WHERE wa.work_order_id = p_ticket_id
      AND wa.is_active = true
      AND a.user_id IS NOT NULL

    UNION

    SELECT c.user_id
    FROM public.ticket_collaborators c
    WHERE c.ticket_id = p_ticket_id

    UNION

    SELECT gp.user_id
    FROM unnest(COALESCE(p_admin_permission_codes, ARRAY[]::text[])) AS perms(code)
    CROSS JOIN LATERAL public.get_users_with_permission(perms.code) AS gp(user_id)
  )
  SELECT COALESCE(array_agg(DISTINCT user_id), ARRAY[]::uuid[])
  FROM recipients
  WHERE user_id IS NOT NULL
$$;
