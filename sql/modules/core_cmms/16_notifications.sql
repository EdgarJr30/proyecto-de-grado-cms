-- =========[ 16) NOTIFICATIONS + COMMENTS ]=========

-- -----------------------------------------------------------------------------
-- 1) Tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel_mask integer NOT NULL DEFAULT 1,
  read_at timestamptz NULL,
  seen_at timestamptz NULL,
  delivered_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_event_recipient_uk UNIQUE (event_id, recipient_user_id)
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text NULL,
  platform text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NULL,
  CONSTRAINT push_subscriptions_user_endpoint_uk UNIQUE (user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.notification_deliveries(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text NULL,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  CONSTRAINT notification_outbox_status_ck CHECK (status IN ('pending', 'sent', 'error')),
  CONSTRAINT notification_outbox_delivery_uk UNIQUE (delivery_id)
);

CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id bigserial PRIMARY KEY,
  ticket_id bigint NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_comments_body_nonempty_ck CHECK (char_length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_notification_events_entity
  ON public.notification_events(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_notification_events_created_at
  ON public.notification_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient_created
  ON public.notification_deliveries(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_unread
  ON public.notification_deliveries(recipient_user_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON public.notification_outbox(status, next_attempt_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_created
  ON public.ticket_comments(ticket_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2) Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_users_with_permission(p_code text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT DISTINCT au.id
  FROM auth.users au
  JOIN public.user_roles ur ON ur.user_id = au.id
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  LEFT JOIN public.users pu ON pu.id = au.id
  WHERE p.code = p_code
    AND p.is_active = true
    AND COALESCE(pu.is_active, true) = true
$$;

CREATE OR REPLACE FUNCTION public.notification_category_from_event(p_event_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_event_type IN ('ticket.assigned', 'ticket.unassigned') THEN 'assignments'
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

CREATE OR REPLACE FUNCTION public.resolve_notification_channel_mask(
  p_user_id uuid,
  p_event_type text,
  p_requested_channel_mask integer
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs jsonb := '{}'::jsonb;
  v_category text;
  v_category_enabled boolean := true;
  v_push_enabled boolean := false;
  v_mask integer := COALESCE(p_requested_channel_mask, 1);
BEGIN
  SELECT np.prefs
  INTO v_prefs
  FROM public.notification_preferences np
  WHERE np.user_id = p_user_id;

  v_category := public.notification_category_from_event(p_event_type);

  v_category_enabled := COALESCE((v_prefs #>> ARRAY['categories', v_category])::boolean, true);
  v_push_enabled := COALESCE((v_prefs ->> 'push_enabled')::boolean, false);

  -- Siempre deja canal in-app activo salvo que el usuario haya desactivado la categoría.
  v_mask := v_mask | 1;

  IF NOT v_category_enabled THEN
    RETURN 0;
  END IF;

  IF (v_mask & 2) = 2 AND NOT v_push_enabled THEN
    v_mask := v_mask & ~2;
  END IF;

  RETURN v_mask;
END;
$$;

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

    SELECT gp.user_id
    FROM unnest(COALESCE(p_admin_permission_codes, ARRAY[]::text[])) AS perms(code)
    CROSS JOIN LATERAL public.get_users_with_permission(perms.code) AS gp(user_id)
  )
  SELECT COALESCE(array_agg(DISTINCT user_id), ARRAY[]::uuid[])
  FROM recipients
  WHERE user_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.touch_notification_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.touch_notification_preferences_updated_at();

CREATE OR REPLACE FUNCTION public.guard_notification_delivery_client_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.event_id IS DISTINCT FROM OLD.event_id
       OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
       OR NEW.channel_mask IS DISTINCT FROM OLD.channel_mask
       OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Solo se permite actualizar read_at y seen_at.';
    END IF;

    IF OLD.read_at IS NOT NULL AND NEW.read_at IS NULL THEN
      NEW.read_at := OLD.read_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_notification_delivery_client_update ON public.notification_deliveries;
CREATE TRIGGER trg_guard_notification_delivery_client_update
BEFORE UPDATE ON public.notification_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.guard_notification_delivery_client_update();

CREATE OR REPLACE FUNCTION public.create_notification_event(
  p_event_type text,
  p_actor uuid,
  p_entity_type text,
  p_entity_id text,
  p_payload jsonb,
  p_recipient_user_ids uuid[],
  p_channel_mask integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_notify_actor boolean := (
    COALESCE((p_payload ->> 'notify_actor')::boolean, false)
    OR p_event_type = 'ticket.created'
  );
BEGIN
  INSERT INTO public.notification_events (
    event_type,
    actor_user_id,
    entity_type,
    entity_id,
    payload
  )
  VALUES (
    p_event_type,
    p_actor,
    p_entity_type,
    p_entity_id,
    COALESCE(p_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_event_id;

  WITH raw_recipients AS (
    SELECT DISTINCT r.user_id
    FROM unnest(COALESCE(p_recipient_user_ids, ARRAY[]::uuid[])) AS r(user_id)
    WHERE r.user_id IS NOT NULL
      AND (
        v_notify_actor
        OR p_actor IS NULL
        OR r.user_id <> p_actor
      )
  ),
  normalized AS (
    SELECT
      rr.user_id AS recipient_user_id,
      public.resolve_notification_channel_mask(
        rr.user_id,
        p_event_type,
        COALESCE(p_channel_mask, 1)
      ) AS final_channel_mask
    FROM raw_recipients rr
  ),
  inserted_deliveries AS (
    INSERT INTO public.notification_deliveries (
      event_id,
      recipient_user_id,
      channel_mask,
      delivered_at
    )
    SELECT
      v_event_id,
      n.recipient_user_id,
      n.final_channel_mask,
      CASE WHEN (n.final_channel_mask & 1) = 1 THEN now() ELSE NULL END
    FROM normalized n
    WHERE n.final_channel_mask > 0
    ON CONFLICT (event_id, recipient_user_id)
    DO UPDATE SET channel_mask = (public.notification_deliveries.channel_mask | EXCLUDED.channel_mask)
    RETURNING id, channel_mask
  )
  INSERT INTO public.notification_outbox (
    delivery_id,
    status,
    attempts,
    next_attempt_at
  )
  SELECT
    d.id,
    'pending',
    0,
    now()
  FROM inserted_deliveries d
  WHERE (d.channel_mask & 2) = 2
  ON CONFLICT (delivery_id) DO NOTHING;

  RETURN v_event_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3) Triggers: tickets / assignments / comments
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_ticket_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipients uuid[];
  v_payload jsonb;
BEGIN
  v_recipients := public.get_ticket_recipient_user_ids(
    NEW.id,
    ARRAY['work_requests:full_access', 'work_orders:full_access', 'work_orders:approve']
  );

  v_payload := jsonb_build_object(
    'ticket_id', NEW.id,
    'title', NEW.title,
    'old_status', NULL,
    'new_status', NEW.status,
    'deadline', NEW.deadline_date,
    'priority', NEW.priority,
    'urgent', NEW.is_urgent,
    'location_id', NEW.location_id,
    'message', format('Ticket #%s creado: %s', NEW.id, NEW.title),
    'url', format('/tickets/%s', NEW.id),
    'notify_actor', true
  );

  PERFORM public.create_notification_event(
    'ticket.created',
    NEW.created_by,
    'ticket',
    NEW.id::text,
    v_payload,
    v_recipients,
    3
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ticket_created ON public.tickets;
CREATE TRIGGER trg_notify_ticket_created
AFTER INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_created();

CREATE OR REPLACE FUNCTION public.notify_ticket_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(NEW.updated_by, auth.uid(), NEW.created_by);
  v_recipients uuid[];
  v_payload jsonb;
  v_finalized boolean := (
    (OLD.finalized_at IS NULL AND NEW.finalized_at IS NOT NULL)
    OR (COALESCE(OLD.status, '') <> 'Finalizadas' AND NEW.status = 'Finalizadas')
  );
BEGIN
  v_recipients := public.get_ticket_recipient_user_ids(
    NEW.id,
    ARRAY['work_requests:full_access', 'work_orders:full_access', 'work_orders:approve']
  );

  IF OLD.is_accepted = false AND NEW.is_accepted = true THEN
    v_payload := jsonb_build_object(
      'ticket_id', NEW.id,
      'title', NEW.title,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'deadline', NEW.deadline_date,
      'priority', NEW.priority,
      'urgent', NEW.is_urgent,
      'location_id', NEW.location_id,
      'message', format('Ticket #%s fue aceptado.', NEW.id),
      'url', format('/tickets/%s', NEW.id)
    );

    PERFORM public.create_notification_event(
      'ticket.accepted',
      v_actor,
      'ticket',
      NEW.id::text,
      v_payload,
      v_recipients,
      3
    );
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_payload := jsonb_build_object(
      'ticket_id', NEW.id,
      'title', NEW.title,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'deadline', NEW.deadline_date,
      'priority', NEW.priority,
      'urgent', NEW.is_urgent,
      'location_id', NEW.location_id,
      'message', format(
        'Ticket #%s cambió de estado: %s -> %s',
        NEW.id,
        COALESCE(OLD.status, 'N/A'),
        COALESCE(NEW.status, 'N/A')
      ),
      'url', format('/tickets/%s', NEW.id)
    );

    PERFORM public.create_notification_event(
      'ticket.status_changed',
      v_actor,
      'ticket',
      NEW.id::text,
      v_payload,
      v_recipients,
      3
    );
  END IF;

  IF OLD.deadline_date IS DISTINCT FROM NEW.deadline_date THEN
    v_payload := jsonb_build_object(
      'ticket_id', NEW.id,
      'title', NEW.title,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'old_deadline', OLD.deadline_date,
      'deadline', NEW.deadline_date,
      'priority', NEW.priority,
      'urgent', NEW.is_urgent,
      'location_id', NEW.location_id,
      'message', format('Ticket #%s actualizó fecha límite a %s.', NEW.id, COALESCE(NEW.deadline_date::text, 'N/A')),
      'url', format('/tickets/%s', NEW.id)
    );

    PERFORM public.create_notification_event(
      CASE
        WHEN OLD.deadline_date IS NULL AND NEW.deadline_date IS NOT NULL THEN 'ticket.deadline_set'
        ELSE 'ticket.deadline_changed'
      END,
      v_actor,
      'ticket',
      NEW.id::text,
      v_payload,
      v_recipients,
      3
    );
  END IF;

  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    v_payload := jsonb_build_object(
      'ticket_id', NEW.id,
      'title', NEW.title,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'deadline', NEW.deadline_date,
      'old_priority', OLD.priority,
      'priority', NEW.priority,
      'urgent', NEW.is_urgent,
      'location_id', NEW.location_id,
      'message', format('Ticket #%s cambió prioridad: %s -> %s.', NEW.id, COALESCE(OLD.priority::text, 'N/A'), COALESCE(NEW.priority::text, 'N/A')),
      'url', format('/tickets/%s', NEW.id)
    );

    PERFORM public.create_notification_event(
      'ticket.priority_changed',
      v_actor,
      'ticket',
      NEW.id::text,
      v_payload,
      v_recipients,
      3
    );
  END IF;

  IF OLD.is_urgent IS DISTINCT FROM NEW.is_urgent THEN
    v_payload := jsonb_build_object(
      'ticket_id', NEW.id,
      'title', NEW.title,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'deadline', NEW.deadline_date,
      'priority', NEW.priority,
      'urgent', NEW.is_urgent,
      'location_id', NEW.location_id,
      'message', format('Ticket #%s cambió urgencia: %s.', NEW.id, CASE WHEN NEW.is_urgent THEN 'URGENTE' ELSE 'normal' END),
      'url', format('/tickets/%s', NEW.id)
    );

    PERFORM public.create_notification_event(
      'ticket.urgent_changed',
      v_actor,
      'ticket',
      NEW.id::text,
      v_payload,
      v_recipients,
      3
    );
  END IF;

  IF v_finalized THEN
    v_payload := jsonb_build_object(
      'ticket_id', NEW.id,
      'title', NEW.title,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'deadline', NEW.deadline_date,
      'priority', NEW.priority,
      'urgent', NEW.is_urgent,
      'location_id', NEW.location_id,
      'finalized_at', NEW.finalized_at,
      'message', format('Ticket #%s fue finalizado.', NEW.id),
      'url', format('/tickets/%s', NEW.id)
    );

    PERFORM public.create_notification_event(
      'ticket.finalized',
      v_actor,
      'ticket',
      NEW.id::text,
      v_payload,
      v_recipients,
      3
    );
  END IF;

  -- Fallback legado para instalaciones que aún usan tickets.comments (texto plano)
  IF COALESCE(trim(NEW.comments), '') <> ''
     AND NEW.comments IS DISTINCT FROM OLD.comments THEN
    v_payload := jsonb_build_object(
      'ticket_id', NEW.id,
      'title', NEW.title,
      'comment_preview', left(trim(NEW.comments), 240),
      'legacy_comments', true,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'deadline', NEW.deadline_date,
      'priority', NEW.priority,
      'urgent', NEW.is_urgent,
      'location_id', NEW.location_id,
      'message', format('Se agregó comentario en ticket #%s.', NEW.id),
      'url', format('/tickets/%s', NEW.id)
    );

    PERFORM public.create_notification_event(
      'ticket.comment_added',
      v_actor,
      'ticket',
      NEW.id::text,
      v_payload,
      v_recipients,
      3
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ticket_updated ON public.tickets;
CREATE TRIGGER trg_notify_ticket_updated
AFTER UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_updated();

CREATE OR REPLACE FUNCTION public.notify_work_order_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := COALESCE(NEW.updated_by, NEW.created_by, auth.uid());
  v_ticket public.tickets%ROWTYPE;
  v_assignee_user_id uuid;
  v_assignee_name text;
  v_event_type text;
  v_recipients uuid[];
  v_payload jsonb;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_active = true THEN
    v_event_type := 'ticket.assigned';
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active = false AND NEW.is_active = true THEN
    v_event_type := 'ticket.assigned';
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    v_event_type := 'ticket.unassigned';
  ELSE
    RETURN NEW;
  END IF;

  SELECT * INTO v_ticket
  FROM public.tickets t
  WHERE t.id = NEW.work_order_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT a.user_id, concat_ws(' ', a.name, a.last_name)
  INTO v_assignee_user_id, v_assignee_name
  FROM public.assignees a
  WHERE a.id = NEW.assignee_id;

  v_recipients := COALESCE(
    ARRAY[v_ticket.created_by, v_assignee_user_id],
    ARRAY[]::uuid[]
  );

  v_recipients := v_recipients || COALESCE(
    ARRAY(
      SELECT public.get_users_with_permission('work_orders:full_access')
    ),
    ARRAY[]::uuid[]
  );

  v_payload := jsonb_build_object(
    'ticket_id', v_ticket.id,
    'title', v_ticket.title,
    'assignee_id', NEW.assignee_id,
    'assignee_user_id', v_assignee_user_id,
    'assignee_name', COALESCE(v_assignee_name, format('Técnico #%s', NEW.assignee_id)),
    'role', NEW.role,
    'assigned_at', NEW.assigned_at,
    'old_status', NULL,
    'new_status', v_ticket.status,
    'deadline', v_ticket.deadline_date,
    'priority', v_ticket.priority,
    'urgent', v_ticket.is_urgent,
    'location_id', v_ticket.location_id,
    'message', CASE
      WHEN v_event_type = 'ticket.assigned' THEN format('Ticket #%s asignado a %s.', v_ticket.id, COALESCE(v_assignee_name, format('técnico #%s', NEW.assignee_id)))
      ELSE format('Ticket #%s desasignado de %s.', v_ticket.id, COALESCE(v_assignee_name, format('técnico #%s', NEW.assignee_id)))
    END,
    'url', format('/tickets/%s', v_ticket.id)
  );

  PERFORM public.create_notification_event(
    v_event_type,
    v_actor,
    'ticket',
    v_ticket.id::text,
    v_payload,
    v_recipients,
    3
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_work_order_assignment_change ON public.work_order_assignees;
CREATE TRIGGER trg_notify_work_order_assignment_change
AFTER INSERT OR UPDATE ON public.work_order_assignees
FOR EACH ROW
EXECUTE FUNCTION public.notify_work_order_assignment_change();

CREATE OR REPLACE FUNCTION public.notify_ticket_comment_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_author_name text;
  v_recipients uuid[];
  v_payload jsonb;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets t
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT concat_ws(' ', u.name, u.last_name)
  INTO v_author_name
  FROM public.users u
  WHERE u.id = NEW.author_user_id;

  v_recipients := public.get_ticket_recipient_user_ids(
    NEW.ticket_id,
    ARRAY['work_orders:full_access']
  );

  v_payload := jsonb_build_object(
    'ticket_id', v_ticket.id,
    'title', v_ticket.title,
    'comment_id', NEW.id,
    'comment_preview', left(trim(NEW.body), 240),
    'author_user_id', NEW.author_user_id,
    'author_name', COALESCE(v_author_name, 'Usuario'),
    'old_status', NULL,
    'new_status', v_ticket.status,
    'deadline', v_ticket.deadline_date,
    'priority', v_ticket.priority,
    'urgent', v_ticket.is_urgent,
    'location_id', v_ticket.location_id,
    'message', format('Nuevo comentario en ticket #%s.', v_ticket.id),
    'url', format('/tickets/%s', v_ticket.id)
  );

  PERFORM public.create_notification_event(
    'ticket.comment_added',
    NEW.author_user_id,
    'ticket',
    NEW.ticket_id::text,
    v_payload,
    v_recipients,
    3
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ticket_comment_added ON public.ticket_comments;
CREATE TRIGGER trg_notify_ticket_comment_added
AFTER INSERT ON public.ticket_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_comment_added();

-- -----------------------------------------------------------------------------
-- 4) Scheduled reminders (due soon / overdue)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_due_soon_and_overdue_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_due_soon_hours integer := GREATEST(public.get_app_setting_int('notifications_due_soon_hours', 24), 1);
  v_due_soon_limit date := (now() + make_interval(hours => v_due_soon_hours))::date;
  v_row record;
  v_recipients uuid[];
  v_payload jsonb;
  v_key text;
BEGIN
  -- Due soon (ventana configurable en horas, dedupe diario por ticket)
  FOR v_row IN
    SELECT t.id, t.title, t.status, t.deadline_date, t.priority, t.is_urgent, t.location_id
    FROM public.tickets t
    WHERE t.is_archived = false
      AND t.deadline_date IS NOT NULL
      AND t.deadline_date >= current_date
      AND t.deadline_date <= v_due_soon_limit
      AND COALESCE(t.status, '') <> 'Finalizadas'
  LOOP
    v_key := format('due_soon:%s:%s', v_row.id, current_date::text);

    IF EXISTS (
      SELECT 1
      FROM public.notification_events ne
      WHERE ne.event_type = 'ticket.due_soon'
        AND ne.entity_type = 'ticket'
        AND ne.entity_id = v_row.id::text
        AND COALESCE(ne.payload ->> 'dedupe_key', '') = v_key
    ) THEN
      CONTINUE;
    END IF;

    v_recipients := public.get_ticket_recipient_user_ids(
      v_row.id,
      ARRAY['work_requests:full_access', 'work_orders:full_access', 'work_orders:approve']
    );

    v_payload := jsonb_build_object(
      'ticket_id', v_row.id,
      'title', v_row.title,
      'old_status', NULL,
      'new_status', v_row.status,
      'deadline', v_row.deadline_date,
      'priority', v_row.priority,
      'urgent', v_row.is_urgent,
      'location_id', v_row.location_id,
      'dedupe_key', v_key,
      'message', format('Ticket #%s vence pronto (%s).', v_row.id, v_row.deadline_date::text),
      'url', format('/tickets/%s', v_row.id)
    );

    PERFORM public.create_notification_event(
      'ticket.due_soon',
      NULL,
      'ticket',
      v_row.id::text,
      v_payload,
      v_recipients,
      3
    );
  END LOOP;

  -- Overdue (dedupe diario por ticket)
  FOR v_row IN
    SELECT t.id, t.title, t.status, t.deadline_date, t.priority, t.is_urgent, t.location_id
    FROM public.tickets t
    WHERE t.is_archived = false
      AND t.deadline_date IS NOT NULL
      AND t.deadline_date < current_date
      AND COALESCE(t.status, '') <> 'Finalizadas'
  LOOP
    v_key := format('overdue:%s:%s', v_row.id, current_date::text);

    IF EXISTS (
      SELECT 1
      FROM public.notification_events ne
      WHERE ne.event_type = 'ticket.overdue'
        AND ne.entity_type = 'ticket'
        AND ne.entity_id = v_row.id::text
        AND COALESCE(ne.payload ->> 'dedupe_key', '') = v_key
    ) THEN
      CONTINUE;
    END IF;

    v_recipients := public.get_ticket_recipient_user_ids(
      v_row.id,
      ARRAY['work_requests:full_access', 'work_orders:full_access', 'work_orders:approve']
    );

    v_payload := jsonb_build_object(
      'ticket_id', v_row.id,
      'title', v_row.title,
      'old_status', NULL,
      'new_status', v_row.status,
      'deadline', v_row.deadline_date,
      'priority', v_row.priority,
      'urgent', v_row.is_urgent,
      'location_id', v_row.location_id,
      'dedupe_key', v_key,
      'message', format('Ticket #%s está vencido (fecha límite %s).', v_row.id, v_row.deadline_date::text),
      'url', format('/tickets/%s', v_row.id)
    );

    PERFORM public.create_notification_event(
      'ticket.overdue',
      NULL,
      'ticket',
      v_row.id::text,
      v_payload,
      v_recipients,
      3
    );
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'enqueue_due_soon_overdue_notifications'
    ) THEN
      PERFORM cron.schedule(
        'enqueue_due_soon_overdue_notifications',
        '15 * * * *',
        $cron$SELECT public.enqueue_due_soon_and_overdue_notifications();$cron$
      );
    END IF;
  END IF;
END$$;

-- -----------------------------------------------------------------------------
-- 5) RLS + policies
-- -----------------------------------------------------------------------------

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_deliveries_select_own ON public.notification_deliveries;
DROP POLICY IF EXISTS notification_deliveries_update_own ON public.notification_deliveries;

CREATE POLICY notification_deliveries_select_own
ON public.notification_deliveries
FOR SELECT TO authenticated
USING (recipient_user_id = auth.uid());

CREATE POLICY notification_deliveries_update_own
ON public.notification_deliveries
FOR UPDATE TO authenticated
USING (recipient_user_id = auth.uid())
WITH CHECK (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS notification_events_select_for_recipient ON public.notification_events;

CREATE POLICY notification_events_select_for_recipient
ON public.notification_events
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.notification_deliveries d
    WHERE d.event_id = notification_events.id
      AND d.recipient_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS notification_preferences_select_own ON public.notification_preferences;
DROP POLICY IF EXISTS notification_preferences_insert_own ON public.notification_preferences;
DROP POLICY IF EXISTS notification_preferences_update_own ON public.notification_preferences;

CREATE POLICY notification_preferences_select_own
ON public.notification_preferences
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY notification_preferences_insert_own
ON public.notification_preferences
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY notification_preferences_update_own
ON public.notification_preferences
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;

CREATE POLICY push_subscriptions_select_own
ON public.push_subscriptions
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY push_subscriptions_insert_own
ON public.push_subscriptions
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY push_subscriptions_update_own
ON public.push_subscriptions
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY push_subscriptions_delete_own
ON public.push_subscriptions
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Outbox: sin policies para cliente => sin acceso directo

DROP POLICY IF EXISTS ticket_comments_select_involved ON public.ticket_comments;
DROP POLICY IF EXISTS ticket_comments_insert_involved ON public.ticket_comments;

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
      )
  )
);

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
      )
  )
);

-- -----------------------------------------------------------------------------
-- 6) Realtime
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notification_deliveries'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_deliveries';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ticket_comments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_comments';
  END IF;
END$$;

ALTER TABLE public.notification_deliveries REPLICA IDENTITY FULL;
ALTER TABLE public.ticket_comments REPLICA IDENTITY FULL;


-- =========[ 16) PATCH: ADMIN TEST TOOLS ]=========

-- Admin-only tools for notification QA / push diagnostics

CREATE OR REPLACE FUNCTION public.current_user_can_send_notification_tests()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND p.code IN ('users:full_access', 'rbac:manage_permissions')
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_can_send_notification_tests() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_notification_targets(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 25
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  is_active boolean,
  has_push_subscription boolean,
  last_push_seen_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := NULLIF(trim(COALESCE(p_search, '')), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida.';
  END IF;

  IF NOT public.current_user_can_send_notification_tests() THEN
    RAISE EXCEPTION 'No autorizado para listar usuarios de prueba.';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    NULLIF(trim(concat_ws(' ', u.name, u.last_name)), '') AS full_name,
    u.email,
    u.is_active,
    COALESCE(ps.has_subscription, false) AS has_push_subscription,
    ps.last_push_seen_at
  FROM public.users u
  LEFT JOIN LATERAL (
    SELECT
      max(s.last_seen_at) AS last_push_seen_at,
      count(*) > 0 AS has_subscription
    FROM public.push_subscriptions s
    WHERE s.user_id = u.id
  ) ps ON true
  WHERE (
    v_search IS NULL
    OR u.name ILIKE ('%' || v_search || '%')
    OR u.last_name ILIKE ('%' || v_search || '%')
    OR u.email ILIKE ('%' || v_search || '%')
  )
  ORDER BY
    COALESCE(ps.has_subscription, false) DESC,
    u.is_active DESC,
    NULLIF(trim(concat_ws(' ', u.name, u.last_name)), '') ASC NULLS LAST,
    u.email ASC NULLS LAST
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_notification_targets(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_send_test_notification(
  p_recipient_user_id uuid,
  p_title text DEFAULT 'Prueba de notificaciones',
  p_message text DEFAULT 'Mensaje de prueba enviado por un administrador.',
  p_url text DEFAULT '/notificaciones',
  p_send_push boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_event_id uuid;
  v_title text := COALESCE(NULLIF(trim(p_title), ''), 'Prueba de notificaciones');
  v_message text := COALESCE(
    NULLIF(trim(p_message), ''),
    'Mensaje de prueba enviado por un administrador.'
  );
  v_url text := COALESCE(NULLIF(trim(p_url), ''), '/notificaciones');
  v_channel_mask integer := CASE WHEN COALESCE(p_send_push, true) THEN 3 ELSE 1 END;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida.';
  END IF;

  IF p_recipient_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes indicar un usuario destino.';
  END IF;

  IF NOT public.current_user_can_send_notification_tests() THEN
    RAISE EXCEPTION 'No autorizado para enviar notificaciones de prueba.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_recipient_user_id
  ) THEN
    RAISE EXCEPTION 'El usuario destino no existe.';
  END IF;

  IF left(v_url, 1) <> '/' THEN
    v_url := '/notificaciones';
  END IF;

  v_event_id := public.create_notification_event(
    'system.test_notification',
    v_actor,
    'user',
    p_recipient_user_id::text,
    jsonb_build_object(
      'title', v_title,
      'message', v_message,
      'url', v_url,
      'target_user_id', p_recipient_user_id,
      'source', 'admin_test_tool',
      'notify_actor', true
    ),
    ARRAY[p_recipient_user_id],
    v_channel_mask
  );

  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_send_test_notification(uuid, text, text, text, boolean) TO authenticated;


-- =========[ 16) PATCH: PUSH OUTBOX REALTIME DISPATCH ]=========

-- Push outbox: concurrency-safe claiming + immediate webhook dispatch

-- 1) Allow an explicit processing lease state
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_outbox_status_ck'
      AND conrelid = 'public.notification_outbox'::regclass
  ) THEN
    ALTER TABLE public.notification_outbox
      DROP CONSTRAINT notification_outbox_status_ck;
  END IF;
END;
$$;

ALTER TABLE public.notification_outbox
  ADD CONSTRAINT notification_outbox_status_ck
  CHECK (status IN ('pending', 'processing', 'sent', 'error'));

-- 2) Claim rows atomically with SKIP LOCKED (safe for concurrent workers)
CREATE OR REPLACE FUNCTION public.claim_notification_outbox_batch(
  p_limit integer DEFAULT 100,
  p_outbox_id uuid DEFAULT NULL,
  p_processing_timeout_seconds integer DEFAULT 120
)
RETURNS TABLE (
  outbox_id uuid,
  delivery_id uuid,
  attempts integer,
  recipient_user_id uuid,
  event_id uuid,
  event_type text,
  entity_type text,
  entity_id text,
  payload jsonb,
  event_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 250);
  v_lease_seconds integer := LEAST(GREATEST(COALESCE(p_processing_timeout_seconds, 120), 15), 900);
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT o.id
    FROM public.notification_outbox o
    WHERE (
      p_outbox_id IS NOT NULL
      AND o.id = p_outbox_id
      AND o.status IN ('pending', 'processing')
      AND o.next_attempt_at <= now()
    )
    OR (
      p_outbox_id IS NULL
      AND o.status IN ('pending', 'processing')
      AND o.next_attempt_at <= now()
    )
    ORDER BY o.created_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.notification_outbox o
    SET
      status = 'processing',
      next_attempt_at = now() + make_interval(secs => v_lease_seconds)
    FROM candidates c
    WHERE o.id = c.id
    RETURNING o.id, o.delivery_id, o.attempts
  )
  SELECT
    c.id AS outbox_id,
    c.delivery_id,
    c.attempts,
    d.recipient_user_id,
    e.id AS event_id,
    e.event_type,
    e.entity_type,
    e.entity_id,
    e.payload,
    e.created_at AS event_created_at
  FROM claimed c
  JOIN public.notification_deliveries d ON d.id = c.delivery_id
  JOIN public.notification_events e ON e.id = d.event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_outbox_batch(integer, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_notification_outbox_batch(integer, uuid, integer) TO service_role;

-- 3) Best-effort immediate dispatch webhook on outbox insert.
-- Configuration via DB settings (set once in SQL editor):
--   ALTER DATABASE postgres SET app.settings.push_outbox_worker_url = 'https://<ref>.functions.supabase.co/send-push-from-outbox';
--   ALTER DATABASE postgres SET app.settings.push_outbox_service_jwt = '<service_role_jwt>';
--   ALTER DATABASE postgres SET app.settings.push_outbox_cron_secret = '<push_outbox_cron_secret>';

CREATE OR REPLACE FUNCTION public.enqueue_push_outbox_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := NULLIF(current_setting('app.settings.push_outbox_worker_url', true), '');
  v_service_jwt text := NULLIF(current_setting('app.settings.push_outbox_service_jwt', true), '');
  v_cron_secret text := NULLIF(current_setting('app.settings.push_outbox_cron_secret', true), '');
  v_headers jsonb;
  v_url_with_query text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  IF v_url IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    v_url_with_query := format(
      '%s%soutbox_id=%s&limit=1',
      v_url,
      CASE WHEN strpos(v_url, '?') > 0 THEN '&' ELSE '?' END,
      NEW.id::text
    );

    v_headers := jsonb_build_object('Content-Type', 'application/json');

    IF v_service_jwt IS NOT NULL THEN
      v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || v_service_jwt);
    END IF;

    IF v_cron_secret IS NOT NULL THEN
      v_headers := v_headers || jsonb_build_object('x-cron-secret', v_cron_secret);
    END IF;

    PERFORM net.http_post(
      url := v_url_with_query,
      headers := v_headers,
      body := jsonb_build_object(
        'source', 'notification_outbox_trigger',
        'outbox_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block business flow because webhook dispatch failed.
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_push_outbox_dispatch ON public.notification_outbox;
CREATE TRIGGER trg_enqueue_push_outbox_dispatch
AFTER INSERT ON public.notification_outbox
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_push_outbox_dispatch();


-- =========[ 16) PATCH: TICKET COMMENTS WRITE HARDENING ]=========

CREATE OR REPLACE FUNCTION public.add_ticket_comment(
  p_ticket_id bigint,
  p_body text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_body text := trim(COALESCE(p_body, ''));
  v_comment_id bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  IF v_body = '' THEN
    RAISE EXCEPTION 'El comentario no puede estar vacío.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_user_id
  ) THEN
    RAISE EXCEPTION 'No se encontró el perfil del usuario en public.users.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = p_ticket_id
  ) THEN
    RAISE EXCEPTION 'El ticket no existe.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = p_ticket_id
      AND (
        t.created_by = v_user_id
        OR public.me_has_permission('work_orders:read')
        OR public.me_has_permission('work_orders:full_access')
        OR public.me_has_permission('work_orders:approve')
        OR public.me_has_permission('work_requests:read')
        OR public.me_has_permission('work_requests:full_access')
        OR EXISTS (
          SELECT 1
          FROM public.work_order_assignees wa
          JOIN public.assignees a
            ON a.id = wa.assignee_id
          WHERE wa.work_order_id = t.id
            AND wa.is_active = true
            AND a.user_id = v_user_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'No tienes permiso para comentar en este ticket.';
  END IF;

  INSERT INTO public.ticket_comments (
    ticket_id,
    author_user_id,
    body
  )
  VALUES (
    p_ticket_id,
    v_user_id,
    v_body
  )
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.add_ticket_comment(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_ticket_comment(bigint, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_ticket_comment_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_author_name text;
  v_recipients uuid[];
  v_payload jsonb;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets t
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT concat_ws(' ', u.name, u.last_name)
  INTO v_author_name
  FROM public.users u
  WHERE u.id = NEW.author_user_id;

  v_recipients := public.get_ticket_recipient_user_ids(
    NEW.ticket_id,
    ARRAY[
      'work_requests:full_access',
      'work_orders:full_access',
      'work_orders:approve'
    ]
  );

  v_payload := jsonb_build_object(
    'ticket_id', v_ticket.id,
    'title', v_ticket.title,
    'comment_id', NEW.id,
    'comment_preview', left(trim(NEW.body), 240),
    'author_user_id', NEW.author_user_id,
    'author_name', COALESCE(v_author_name, 'Usuario'),
    'old_status', NULL,
    'new_status', v_ticket.status,
    'deadline', v_ticket.deadline_date,
    'priority', v_ticket.priority,
    'urgent', v_ticket.is_urgent,
    'location_id', v_ticket.location_id,
    'message', format('%s comentó en ticket #%s.', COALESCE(v_author_name, 'Usuario'), v_ticket.id),
    'url', format('/tickets/%s', v_ticket.id)
  );

  PERFORM public.create_notification_event(
    'ticket.comment_added',
    NEW.author_user_id,
    'ticket',
    NEW.ticket_id::text,
    v_payload,
    v_recipients,
    3
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Nunca romper el flujo de comentarios por una falla de notificaciones.
    RETURN NEW;
END;
$$;


-- =========[ 16) PATCH: UNREAD TOGGLE ]=========

-- Allow authenticated users to toggle read_at both ways (read/unread)
CREATE OR REPLACE FUNCTION public.guard_notification_delivery_client_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.event_id IS DISTINCT FROM OLD.event_id
       OR NEW.recipient_user_id IS DISTINCT FROM OLD.recipient_user_id
       OR NEW.channel_mask IS DISTINCT FROM OLD.channel_mask
       OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Solo se permite actualizar read_at y seen_at.';
    END IF;

    -- Keep seen_at monotonic for clients; do not allow clearing once set.
    IF OLD.seen_at IS NOT NULL AND NEW.seen_at IS NULL THEN
      NEW.seen_at := OLD.seen_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- =========[ 16) PATCH: COMMENTS RPC + NOTIFICATION ALIGNMENT ]=========

CREATE OR REPLACE FUNCTION public.list_ticket_comments(p_ticket_id bigint)
RETURNS TABLE (
  id bigint,
  ticket_id bigint,
  author_user_id uuid,
  body text,
  created_at timestamptz,
  author_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tc.id::bigint,
    tc.ticket_id,
    tc.author_user_id,
    tc.body,
    tc.created_at,
    COALESCE(NULLIF(trim(concat_ws(' ', u.name, u.last_name)), ''), 'Usuario') AS author_name
  FROM public.ticket_comments tc
  LEFT JOIN public.users u
    ON u.id = tc.author_user_id
  WHERE tc.ticket_id = p_ticket_id
    AND EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = p_ticket_id
        AND (
          t.created_by = auth.uid()
          OR public.me_has_permission('work_orders:read')
          OR public.me_has_permission('work_orders:full_access')
          OR public.me_has_permission('work_requests:read')
          OR public.me_has_permission('work_requests:full_access')
          OR EXISTS (
            SELECT 1
            FROM public.work_order_assignees wa
            JOIN public.assignees a
              ON a.id = wa.assignee_id
            WHERE wa.work_order_id = t.id
              AND wa.is_active = true
              AND a.user_id = auth.uid()
          )
        )
    )
  ORDER BY tc.created_at ASC, tc.id ASC;
$$;

REVOKE ALL ON FUNCTION public.list_ticket_comments(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_ticket_comments(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_ticket_comment_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_author_name text;
  v_recipients uuid[];
  v_payload jsonb;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets t
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT concat_ws(' ', u.name, u.last_name)
  INTO v_author_name
  FROM public.users u
  WHERE u.id = NEW.author_user_id;

  v_recipients := public.get_ticket_recipient_user_ids(
    NEW.ticket_id,
    ARRAY[
      'work_requests:full_access',
      'work_orders:full_access',
      'work_orders:approve'
    ]
  );

  v_payload := jsonb_build_object(
    'ticket_id', v_ticket.id,
    'title', v_ticket.title,
    'comment_id', NEW.id,
    'comment_preview', left(trim(NEW.body), 240),
    'author_user_id', NEW.author_user_id,
    'author_name', COALESCE(v_author_name, 'Usuario'),
    'old_status', NULL,
    'new_status', v_ticket.status,
    'deadline', v_ticket.deadline_date,
    'priority', v_ticket.priority,
    'urgent', v_ticket.is_urgent,
    'location_id', v_ticket.location_id,
    'message', format('%s comentó en ticket #%s.', COALESCE(v_author_name, 'Usuario'), v_ticket.id),
    'url', format('/tickets/%s', v_ticket.id)
  );

  PERFORM public.create_notification_event(
    'ticket.comment_added',
    NEW.author_user_id,
    'ticket',
    NEW.ticket_id::text,
    v_payload,
    v_recipients,
    3
  );

  RETURN NEW;
END;
$$;


-- =========[ 16) PATCH: COMMENT NOTIFY FAIL-SAFE ]=========

CREATE OR REPLACE FUNCTION public.notify_ticket_comment_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_author_name text;
  v_recipients uuid[];
  v_payload jsonb;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets t
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT concat_ws(' ', u.name, u.last_name)
  INTO v_author_name
  FROM public.users u
  WHERE u.id = NEW.author_user_id;

  v_recipients := public.get_ticket_recipient_user_ids(
    NEW.ticket_id,
    ARRAY[
      'work_requests:full_access',
      'work_orders:full_access',
      'work_orders:approve'
    ]
  );

  v_payload := jsonb_build_object(
    'ticket_id', v_ticket.id,
    'title', v_ticket.title,
    'comment_id', NEW.id,
    'comment_preview', left(trim(NEW.body), 240),
    'author_user_id', NEW.author_user_id,
    'author_name', COALESCE(v_author_name, 'Usuario'),
    'old_status', NULL,
    'new_status', v_ticket.status,
    'deadline', v_ticket.deadline_date,
    'priority', v_ticket.priority,
    'urgent', v_ticket.is_urgent,
    'location_id', v_ticket.location_id,
    'message', format('%s comentó en ticket #%s.', COALESCE(v_author_name, 'Usuario'), v_ticket.id),
    'url', format('/tickets/%s', v_ticket.id)
  );

  PERFORM public.create_notification_event(
    'ticket.comment_added',
    NEW.author_user_id,
    'ticket',
    NEW.ticket_id::text,
    v_payload,
    v_recipients,
    3
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'notify_ticket_comment_added failed for ticket_id=% comment_id=%: %',
      NEW.ticket_id, NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ticket_comment_added ON public.ticket_comments;
CREATE TRIGGER trg_notify_ticket_comment_added
AFTER INSERT ON public.ticket_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_comment_added();


-- =========[ 16) PATCH: NOTIFICATION SECURITY HARDENING ]=========

-- Security hardening:
-- 1) prevent direct client usage of create_notification_event
-- 2) add safe self-test wrapper
-- 3) include comment participants as recipients for comment notifications

REVOKE ALL ON FUNCTION public.create_notification_event(text, uuid, text, text, jsonb, uuid[], integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_notification_event(text, uuid, text, text, jsonb, uuid[], integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification_event(text, uuid, text, text, jsonb, uuid[], integer) TO service_role;

REVOKE ALL ON FUNCTION public.get_users_with_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_users_with_permission(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_with_permission(text) TO service_role;

CREATE OR REPLACE FUNCTION public.send_self_test_notification(
  p_title text DEFAULT 'Prueba de notificaciones',
  p_message text DEFAULT 'Esta es una notificación de prueba para tu dispositivo.',
  p_send_push boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_title text := COALESCE(NULLIF(trim(p_title), ''), 'Prueba de notificaciones');
  v_message text := COALESCE(
    NULLIF(trim(p_message), ''),
    'Esta es una notificación de prueba para tu dispositivo.'
  );
  v_channel_mask integer := CASE WHEN COALESCE(p_send_push, true) THEN 3 ELSE 1 END;
  v_event_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  v_event_id := public.create_notification_event(
    'system.self_test_notification',
    v_user_id,
    'user',
    v_user_id::text,
    jsonb_build_object(
      'title', v_title,
      'message', v_message,
      'url', '/notificaciones',
      'notify_actor', true,
      'source', 'self_test_tool'
    ),
    ARRAY[v_user_id],
    v_channel_mask
  );

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_self_test_notification(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_self_test_notification(text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_ticket_comment_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
  v_author_name text;
  v_recipients uuid[];
  v_payload jsonb;
BEGIN
  SELECT * INTO v_ticket
  FROM public.tickets t
  WHERE t.id = NEW.ticket_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT concat_ws(' ', u.name, u.last_name)
  INTO v_author_name
  FROM public.users u
  WHERE u.id = NEW.author_user_id;

  v_recipients := public.get_ticket_recipient_user_ids(
    NEW.ticket_id,
    ARRAY[
      'work_requests:full_access',
      'work_orders:full_access',
      'work_orders:approve'
    ]
  );

  v_recipients := v_recipients || COALESCE(
    ARRAY(
      SELECT DISTINCT tc.author_user_id
      FROM public.ticket_comments tc
      WHERE tc.ticket_id = NEW.ticket_id
        AND tc.author_user_id IS NOT NULL
    ),
    ARRAY[]::uuid[]
  );

  v_payload := jsonb_build_object(
    'ticket_id', v_ticket.id,
    'title', v_ticket.title,
    'comment_id', NEW.id,
    'comment_preview', left(trim(NEW.body), 240),
    'author_user_id', NEW.author_user_id,
    'author_name', COALESCE(v_author_name, 'Usuario'),
    'old_status', NULL,
    'new_status', v_ticket.status,
    'deadline', v_ticket.deadline_date,
    'priority', v_ticket.priority,
    'urgent', v_ticket.is_urgent,
    'location_id', v_ticket.location_id,
    'message', format('%s comentó en ticket #%s.', COALESCE(v_author_name, 'Usuario'), v_ticket.id),
    'url', format('/tickets/%s', v_ticket.id)
  );

  PERFORM public.create_notification_event(
    'ticket.comment_added',
    NEW.author_user_id,
    'ticket',
    NEW.ticket_id::text,
    v_payload,
    v_recipients,
    3
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'notify_ticket_comment_added failed for ticket_id=% comment_id=%: %',
      NEW.ticket_id, NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ticket_comment_added ON public.ticket_comments;
CREATE TRIGGER trg_notify_ticket_comment_added
AFTER INSERT ON public.ticket_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_ticket_comment_added();
