-- Corrige notificaciones de colaboradores:
-- - El evento de colaborador pertenece a la categoria de asignaciones.
-- - Si alguien se agrega a si mismo como colaborador, tambien debe recibir aviso.

CREATE OR REPLACE FUNCTION public.notification_category_from_event(p_event_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_event_type IN (
      'ticket.assigned',
      'ticket.unassigned',
      'ticket.collaborator_added',
      'ticket.collaborator_removed'
    ) THEN 'assignments'
    WHEN p_event_type = 'ticket.comment_added' THEN 'comments'
    WHEN p_event_type IN (
      'ticket.status_changed',
      'ticket.accepted',
      'ticket.priority_changed',
      'ticket.urgent_changed',
      'ticket.finalized'
    ) THEN 'status_changes'
    WHEN p_event_type IN (
      'ticket.deadline_set',
      'ticket.deadline_changed',
      'ticket.due_soon',
      'ticket.overdue'
    ) THEN 'deadlines'
    ELSE 'admin_system'
  END
$$;

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
    RAISE EXCEPTION 'No hay sesion activa.';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario invalido.';
  END IF;
  IF NOT public.can_i_manage_ticket_collaborators(p_ticket_id) THEN
    RAISE EXCEPTION 'No autorizado para gestionar colaboradores de este ticket.';
  END IF;

  INSERT INTO public.ticket_collaborators(ticket_id, user_id, added_by)
  VALUES (p_ticket_id, p_user_id, v_uid)
  ON CONFLICT (ticket_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF NOT v_inserted THEN
    RETURN;
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
        p_ticket_id, COALESCE(v_title, 'sin titulo')
      ),
      'url', format('/tickets/%s', p_ticket_id),
      'notify_actor', true
    ),
    ARRAY[p_user_id], 3
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_ticket_collaborator(bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_ticket_collaborator(bigint, uuid) TO authenticated;
