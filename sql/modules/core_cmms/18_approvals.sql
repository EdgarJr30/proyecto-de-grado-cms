-- =========[ 18) APPROVALS (PROCESOS DE APROBACIÓN / VALIDACIÓN DE CIERRE) ]=========
--
-- Módulo de procesos de aprobación: un proceso agrupa APROBADORES y SOLICITANTES.
-- Caso de uso: antes de finalizar un ticket, el técnico (solicitante) sube
-- evidencia (imagen obligatoria) y envía a validación -> estado 'En Validación';
-- cualquier aprobador del proceso valida con un botón (-> 'Finalizadas') o rechaza
-- (-> 'En Ejecución').
--
-- Excepciones: usuarios con 'work_orders:full_access' y los aprobadores finalizan
-- directo. Técnicos sin proceso asignado finalizan como hoy.
--
-- Reusa: me_has_permission (04), create_notification_event/get_users_with_permission
-- (16), write_activity_log/attach_activity_logging (17), set_created_by/set_updated_by (04).

-- -----------------------------------------------------------------------------
-- 1) Tablas
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.approval_processes (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  require_evidence boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id),
  updated_by uuid REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.approval_process_approvers (
  process_id bigint NOT NULL REFERENCES public.approval_processes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (process_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.approval_process_requesters (
  process_id bigint NOT NULL REFERENCES public.approval_processes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (process_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id bigint NOT NULL REFERENCES public.approval_processes(id),
  ticket_id bigint NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  requester_user_id uuid NOT NULL REFERENCES public.users(id),
  evidence_image text NOT NULL DEFAULT '[]',   -- JSON array de paths en bucket 'attachments'
  note text,
  status text NOT NULL DEFAULT 'pending',
  approver_user_id uuid REFERENCES public.users(id),
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_requests_status_ck CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_requests_one_pending
  ON public.approval_requests (ticket_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_approval_requests_ticket
  ON public.approval_requests (ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status
  ON public.approval_requests (status);
CREATE INDEX IF NOT EXISTS idx_approval_process_approvers_user
  ON public.approval_process_approvers (user_id);
CREATE INDEX IF NOT EXISTS idx_approval_process_requesters_user
  ON public.approval_process_requesters (user_id);

-- Autogenera 'code' (slug único a partir del nombre) si no se provee.
CREATE OR REPLACE FUNCTION public.approval_processes_set_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_code text;
  v_n int := 1;
BEGIN
  IF NEW.code IS NOT NULL AND length(trim(NEW.code)) > 0 THEN
    RETURN NEW;
  END IF;

  v_base := lower(trim(COALESCE(NEW.name, '')));
  v_base := translate(
    v_base,
    'áàäâãéèëêíìïîóòöôõúùüûñç',
    'aaaaaeeeeiiiiooooouuuunc'
  );
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '_', 'g');
  v_base := regexp_replace(v_base, '^_+|_+$', '', 'g');
  IF v_base = '' THEN
    v_base := 'proceso';
  END IF;

  v_code := v_base;
  WHILE EXISTS (SELECT 1 FROM public.approval_processes WHERE code = v_code) LOOP
    v_n := v_n + 1;
    v_code := v_base || '_' || v_n;
  END LOOP;

  NEW.code := v_code;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approval_processes_set_code ON public.approval_processes;
CREATE TRIGGER trg_approval_processes_set_code
BEFORE INSERT ON public.approval_processes
FOR EACH ROW EXECUTE FUNCTION public.approval_processes_set_code();

-- Trazabilidad del proceso (reusa funciones genéricas de 04_functions_triggers.sql)
DROP TRIGGER IF EXISTS trg_approval_processes_created ON public.approval_processes;
CREATE TRIGGER trg_approval_processes_created
BEFORE INSERT ON public.approval_processes
FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_approval_processes_updated ON public.approval_processes;
CREATE TRIGGER trg_approval_processes_updated
BEFORE UPDATE ON public.approval_processes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();

-- -----------------------------------------------------------------------------
-- 2) Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_approval_requester(p_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.approval_process_requesters r
    JOIN public.approval_processes p ON p.id = r.process_id
    WHERE r.user_id = p_uid AND p.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_active_process_for_requester(p_uid uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id
  FROM public.approval_process_requesters r
  JOIN public.approval_processes p ON p.id = r.process_id
  WHERE r.user_id = p_uid AND p.is_active = true
  ORDER BY p.id
  LIMIT 1;
$$;

-- ¿El usuario es aprobador de algún proceso por el que pasó este ticket?
CREATE OR REPLACE FUNCTION public.is_ticket_approver(p_uid uuid, p_ticket_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.approval_requests r
    JOIN public.approval_process_approvers ap ON ap.process_id = r.process_id
    WHERE r.ticket_id = p_ticket_id AND ap.user_id = p_uid
  );
$$;

CREATE OR REPLACE FUNCTION public.am_i_ticket_approver(p_ticket_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_ticket_approver(auth.uid(), p_ticket_id);
$$;

GRANT EXECUTE ON FUNCTION public.am_i_ticket_approver(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_process_approver_user_ids(p_process_id bigint)
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT user_id), ARRAY[]::uuid[])
  FROM public.approval_process_approvers
  WHERE process_id = p_process_id;
$$;

-- ¿El usuario actual es solicitante en algún proceso activo?
CREATE OR REPLACE FUNCTION public.am_i_approval_requester()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_approval_requester(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.am_i_approval_requester() TO authenticated;

-- Aprobadores asignados a la solicitud pendiente de un ticket (para mostrar en UI).
CREATE OR REPLACE FUNCTION public.get_ticket_pending_approvers(p_ticket_id bigint)
RETURNS TABLE (user_id uuid, full_name text, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    public.me_has_permission('approvals:read')
    OR public.me_has_permission('approvals:full_access')
    OR public.me_has_permission('work_orders:full_access')
    OR EXISTS (
      SELECT 1 FROM public.approval_requests r
      WHERE r.ticket_id = p_ticket_id AND r.requester_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.assignees a
      WHERE a.user_id = auth.uid()
        AND (
          EXISTS (
            SELECT 1 FROM public.work_order_assignees wa
            WHERE wa.work_order_id = p_ticket_id AND wa.assignee_id = a.id AND wa.is_active = true
          )
          OR EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = p_ticket_id AND t.assignee_id = a.id
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.approval_requests r
      JOIN public.approval_process_approvers ap ON ap.process_id = r.process_id
      WHERE r.ticket_id = p_ticket_id AND r.status = 'pending' AND ap.user_id = auth.uid()
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, NULLIF(trim(concat_ws(' ', u.name, u.last_name)), ''), u.email
  FROM public.approval_requests r
  JOIN public.approval_process_approvers ap ON ap.process_id = r.process_id
  JOIN public.users u ON u.id = ap.user_id
  WHERE r.ticket_id = p_ticket_id AND r.status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ticket_pending_approvers(bigint) TO authenticated;

-- -----------------------------------------------------------------------------
-- 3) RPCs: configuración de membresías (gated por approvals:full_access)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_process_approvers(p_process_id bigint, p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.me_has_permission('approvals:full_access') THEN
    RAISE EXCEPTION 'No autorizado: requiere approvals:full_access.';
  END IF;

  DELETE FROM public.approval_process_approvers
  WHERE process_id = p_process_id
    AND user_id <> ALL (COALESCE(p_user_ids, ARRAY[]::uuid[]));

  INSERT INTO public.approval_process_approvers(process_id, user_id)
  SELECT p_process_id, u
  FROM unnest(COALESCE(p_user_ids, ARRAY[]::uuid[])) AS u
  ON CONFLICT DO NOTHING;

  PERFORM public.write_activity_log(
    'approval.process_members_changed', 'approval_processes', p_process_id::text,
    (SELECT name FROM public.approval_processes WHERE id = p_process_id),
    format('Aprobadores actualizados (%s)', COALESCE(array_length(p_user_ids, 1), 0)),
    jsonb_build_object('process_id', p_process_id, 'role', 'approver', 'user_ids', to_jsonb(p_user_ids))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_process_requesters(p_process_id bigint, p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.me_has_permission('approvals:full_access') THEN
    RAISE EXCEPTION 'No autorizado: requiere approvals:full_access.';
  END IF;

  DELETE FROM public.approval_process_requesters
  WHERE process_id = p_process_id
    AND user_id <> ALL (COALESCE(p_user_ids, ARRAY[]::uuid[]));

  INSERT INTO public.approval_process_requesters(process_id, user_id)
  SELECT p_process_id, u
  FROM unnest(COALESCE(p_user_ids, ARRAY[]::uuid[])) AS u
  ON CONFLICT DO NOTHING;

  PERFORM public.write_activity_log(
    'approval.process_members_changed', 'approval_processes', p_process_id::text,
    (SELECT name FROM public.approval_processes WHERE id = p_process_id),
    format('Solicitantes actualizados (%s)', COALESCE(array_length(p_user_ids, 1), 0)),
    jsonb_build_object('process_id', p_process_id, 'role', 'requester', 'user_ids', to_jsonb(p_user_ids))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_process_approvers(bigint, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_process_requesters(bigint, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_process_approvers(bigint, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_process_requesters(bigint, uuid[]) TO authenticated;

-- -----------------------------------------------------------------------------
-- 4) RPCs: flujo de validación de cierre de ticket
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_ticket_approval(
  p_ticket_id bigint,
  p_evidence jsonb DEFAULT '[]'::jsonb,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_process_id bigint;
  v_require_evidence boolean;
  v_evidence_count int := COALESCE(jsonb_array_length(p_evidence), 0);
  v_request_id uuid;
  v_title text;
  v_recipients uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  -- "Técnico asignado" = el usuario tiene un assignee vinculado (assignees.user_id)
  -- que está activo en work_order_assignees O es el responsable de tickets.assignee_id.
  IF NOT EXISTS (
    SELECT 1
    FROM public.assignees a
    WHERE a.user_id = v_uid
      AND (
        EXISTS (
          SELECT 1 FROM public.work_order_assignees wa
          WHERE wa.work_order_id = p_ticket_id
            AND wa.assignee_id = a.id
            AND wa.is_active = true
        )
        OR EXISTS (
          SELECT 1 FROM public.tickets t
          WHERE t.id = p_ticket_id
            AND t.assignee_id = a.id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Solo el técnico asignado puede solicitar validación de este ticket.';
  END IF;

  v_process_id := public.get_active_process_for_requester(v_uid);
  IF v_process_id IS NULL THEN
    RAISE EXCEPTION 'No tienes un proceso de aprobación asignado.';
  END IF;

  SELECT require_evidence INTO v_require_evidence
  FROM public.approval_processes WHERE id = v_process_id;

  IF COALESCE(v_require_evidence, true) AND v_evidence_count = 0 THEN
    RAISE EXCEPTION 'Debes adjuntar al menos una imagen del trabajo terminado.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.approval_requests
    WHERE ticket_id = p_ticket_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Ya existe una solicitud de validación pendiente para este ticket.';
  END IF;

  INSERT INTO public.approval_requests(
    process_id, ticket_id, requester_user_id, evidence_image, note, status
  )
  VALUES (
    v_process_id, p_ticket_id, v_uid, COALESCE(p_evidence, '[]'::jsonb)::text,
    NULLIF(trim(COALESCE(p_note, '')), ''), 'pending'
  )
  RETURNING id INTO v_request_id;

  UPDATE public.tickets SET status = 'En Validación' WHERE id = p_ticket_id;

  SELECT title INTO v_title FROM public.tickets WHERE id = p_ticket_id;

  PERFORM public.write_activity_log(
    'approval.requested', 'tickets', p_ticket_id::text,
    COALESCE(v_title, 'Ticket #' || p_ticket_id),
    format('Solicitud de validación enviada para ticket #%s', p_ticket_id),
    jsonb_build_object('request_id', v_request_id, 'process_id', v_process_id, 'evidence_count', v_evidence_count),
    v_uid
  );

  v_recipients := public.get_process_approver_user_ids(v_process_id);
  PERFORM public.create_notification_event(
    'ticket.approval_requested', v_uid, 'ticket', p_ticket_id::text,
    jsonb_build_object(
      'ticket_id', p_ticket_id, 'title', v_title, 'request_id', v_request_id,
      'message', format('Ticket #%s (%s) espera tu validación.', p_ticket_id, COALESCE(v_title, 'sin título')),
      'url', format('/tickets/%s', p_ticket_id),
      -- notify_actor=true: si el técnico también es aprobador, igual recibe el aviso.
      'notify_actor', true
    ),
    v_recipients, 3
  );

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_ticket_approval(
  p_request_id uuid,
  p_approve boolean,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.approval_requests%ROWTYPE;
  v_title text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  SELECT * INTO v_req FROM public.approval_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de validación no encontrada.';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'La solicitud ya fue procesada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.approval_process_approvers ap
    WHERE ap.process_id = v_req.process_id AND ap.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'No autorizado: no eres aprobador de este proceso.';
  END IF;

  -- Al rechazar, el comentario es obligatorio (el técnico debe saber el motivo).
  IF NOT p_approve AND NULLIF(trim(COALESCE(p_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Debes indicar un comentario para rechazar la solicitud.';
  END IF;

  UPDATE public.approval_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      approver_user_id = v_uid,
      decision_note = NULLIF(trim(COALESCE(p_note, '')), ''),
      decided_at = now()
  WHERE id = p_request_id;

  SELECT title INTO v_title FROM public.tickets WHERE id = v_req.ticket_id;

  IF p_approve THEN
    PERFORM set_config('app.approval_finalize', '1', true);
    UPDATE public.tickets SET status = 'Finalizadas' WHERE id = v_req.ticket_id;
  ELSE
    UPDATE public.tickets SET status = 'En Ejecución' WHERE id = v_req.ticket_id;
  END IF;

  PERFORM public.write_activity_log(
    CASE WHEN p_approve THEN 'approval.approved' ELSE 'approval.rejected' END,
    'tickets', v_req.ticket_id::text, COALESCE(v_title, 'Ticket #' || v_req.ticket_id),
    CASE WHEN p_approve
      THEN format('Validación aprobada para ticket #%s', v_req.ticket_id)
      ELSE format('Validación rechazada para ticket #%s', v_req.ticket_id) END,
    jsonb_build_object('request_id', p_request_id, 'process_id', v_req.process_id),
    v_uid
  );

  PERFORM public.create_notification_event(
    CASE WHEN p_approve THEN 'ticket.approval_approved' ELSE 'ticket.approval_rejected' END,
    v_uid, 'ticket', v_req.ticket_id::text,
    jsonb_build_object(
      'ticket_id', v_req.ticket_id, 'title', v_title, 'request_id', p_request_id,
      'decision', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      'comment', NULLIF(trim(COALESCE(p_note, '')), ''),
      'message', CASE WHEN p_approve
        THEN format('Tu trabajo en ticket #%s fue APROBADO.%s', v_req.ticket_id,
             CASE WHEN NULLIF(trim(COALESCE(p_note, '')), '') IS NOT NULL
                  THEN ' Comentario del aprobador: ' || trim(p_note) ELSE '' END)
        ELSE format('Tu trabajo en ticket #%s fue RECHAZADO.%s', v_req.ticket_id,
             CASE WHEN NULLIF(trim(COALESCE(p_note, '')), '') IS NOT NULL
                  THEN ' Comentario del aprobador: ' || trim(p_note) ELSE '' END) END,
      'url', format('/tickets/%s', v_req.ticket_id),
      -- notify_actor=true: si el aprobador también es el solicitante, igual recibe el aviso.
      'notify_actor', true
    ),
    ARRAY[v_req.requester_user_id], 3
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_ticket_approval(bigint, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decide_ticket_approval(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_ticket_approval(bigint, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_ticket_approval(uuid, boolean, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5) Guard de transición a 'Finalizadas'
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_ticket_approval_transition()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Finalizadas' AND OLD.status IS DISTINCT FROM 'Finalizadas' THEN
    -- Permitido si la finalización viene del RPC de aprobación.
    IF current_setting('app.approval_finalize', true) = '1' THEN
      RETURN NEW;
    END IF;
    -- Permitido para acceso total.
    IF public.me_has_permission('work_orders:full_access') THEN
      RETURN NEW;
    END IF;
    -- Si el usuario es solicitante en un proceso activo, DEBE pasar por validación.
    IF public.is_approval_requester(auth.uid()) THEN
      RAISE EXCEPTION 'Debes enviar el ticket a validación; un aprobador debe finalizarlo.';
    END IF;
    -- Otros (técnicos sin proceso, creadores) finalizan normalmente.
  END IF;

  -- Una orden ya finalizada solo puede cambiar de estado un aprobador del ticket
  -- o un admin de aprobaciones. Un técnico/solicitante no puede reabrirla.
  IF OLD.status = 'Finalizadas' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('app.approval_finalize', true) <> '1'
       AND public.is_approval_requester(auth.uid())
       AND NOT public.is_ticket_approver(auth.uid(), NEW.id)
       AND NOT public.me_has_permission('approvals:full_access') THEN
      RAISE EXCEPTION 'Una orden finalizada solo puede reabrirla un aprobador.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ticket_approval_transition ON public.tickets;
CREATE TRIGGER trg_guard_ticket_approval_transition
BEFORE UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.guard_ticket_approval_transition();

-- -----------------------------------------------------------------------------
-- 6) RLS + grants
-- -----------------------------------------------------------------------------

ALTER TABLE public.approval_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_process_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_process_requesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- approval_processes: lectura para gestores o miembros; escritura para full_access.
DROP POLICY IF EXISTS approval_processes_select ON public.approval_processes;
CREATE POLICY approval_processes_select ON public.approval_processes
FOR SELECT TO authenticated
USING (
  public.me_has_permission('approvals:read')
  OR public.me_has_permission('approvals:full_access')
  OR EXISTS (SELECT 1 FROM public.approval_process_approvers ap WHERE ap.process_id = approval_processes.id AND ap.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.approval_process_requesters rq WHERE rq.process_id = approval_processes.id AND rq.user_id = auth.uid())
);

DROP POLICY IF EXISTS approval_processes_insert ON public.approval_processes;
CREATE POLICY approval_processes_insert ON public.approval_processes
FOR INSERT TO authenticated
WITH CHECK (public.me_has_permission('approvals:full_access'));

DROP POLICY IF EXISTS approval_processes_update ON public.approval_processes;
CREATE POLICY approval_processes_update ON public.approval_processes
FOR UPDATE TO authenticated
USING (public.me_has_permission('approvals:full_access'))
WITH CHECK (public.me_has_permission('approvals:full_access'));

DROP POLICY IF EXISTS approval_processes_delete ON public.approval_processes;
CREATE POLICY approval_processes_delete ON public.approval_processes
FOR DELETE TO authenticated
USING (public.me_has_permission('approvals:full_access'));

-- Membresías: lectura para gestores o el propio usuario; escritura solo vía RPC.
DROP POLICY IF EXISTS approval_approvers_select ON public.approval_process_approvers;
CREATE POLICY approval_approvers_select ON public.approval_process_approvers
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.me_has_permission('approvals:read')
  OR public.me_has_permission('approvals:full_access')
);

DROP POLICY IF EXISTS approval_requesters_select ON public.approval_process_requesters;
CREATE POLICY approval_requesters_select ON public.approval_process_requesters
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.me_has_permission('approvals:read')
  OR public.me_has_permission('approvals:full_access')
);

-- Solicitudes: el solicitante, los aprobadores del proceso y gestores.
DROP POLICY IF EXISTS approval_requests_select ON public.approval_requests;
CREATE POLICY approval_requests_select ON public.approval_requests
FOR SELECT TO authenticated
USING (
  requester_user_id = auth.uid()
  OR public.me_has_permission('approvals:read')
  OR public.me_has_permission('approvals:full_access')
  OR public.me_has_permission('work_orders:full_access')
  OR EXISTS (
    SELECT 1 FROM public.approval_process_approvers ap
    WHERE ap.process_id = approval_requests.process_id AND ap.user_id = auth.uid()
  )
);

-- Escrituras de membresías y solicitudes solo a través de funciones SECURITY DEFINER.
GRANT SELECT ON public.approval_processes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.approval_processes TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.approval_processes_id_seq TO authenticated;
GRANT SELECT ON public.approval_process_approvers TO authenticated;
GRANT SELECT ON public.approval_process_requesters TO authenticated;
GRANT SELECT ON public.approval_requests TO authenticated;

-- -----------------------------------------------------------------------------
-- 7) Bitácora: trigger genérico sobre la configuración de procesos
-- -----------------------------------------------------------------------------
-- (approval_requests NO se engancha al genérico: sus eventos se registran de
--  forma semántica dentro de los RPCs para evitar ruido.)
SELECT public.attach_activity_logging('approval_processes');
