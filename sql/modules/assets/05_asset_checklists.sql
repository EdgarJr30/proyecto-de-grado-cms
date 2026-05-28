-- =============================================================================
-- Checklist de cierre por activo fijo (obligatorio para finalizar OT)
-- =============================================================================
-- Cada activo puede tener un checklist de verificaciones (preguntas de marcación
-- rápida). Si el activo está marcado como `closure_checklist_required` y está
-- vinculado a un ticket, el técnico NO puede enviar el ticket a validación hasta
-- marcar TODAS las verificaciones activas. El supervisor ve el checklist llenado.
--
-- Reglas:
--  - Para enviar a validación: todas las preguntas activas marcadas (checked=true).
--  - Al guardar: si una pregunta queda sin cumplir (checked=false) exige nota.
--
-- Depende de: assets, tickets, work_order_assignees, assignees, approval_*,
-- helpers me_has_permission/write_activity_log/set_created_by/set_updated_by,
-- is_ticket_approver (18_approvals / approvals_finalized_lock).
-- Idempotente. Debe ejecutarse DESPUÉS de core_cmms (override de request_ticket_approval).

-- -----------------------------------------------------------------------------
-- 1) Flag en assets
-- -----------------------------------------------------------------------------

ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS closure_checklist_required boolean NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- 2) Plantilla de preguntas por activo
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.asset_checklist_items (
  id          bigserial PRIMARY KEY,
  asset_id    bigint NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  label       text   NOT NULL,
  position    int    NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at  timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by  uuid NULL REFERENCES public.users(id),
  updated_by  uuid NULL REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_asset_checklist_items_asset
  ON public.asset_checklist_items (asset_id, position);

DROP TRIGGER IF EXISTS trg_asset_checklist_items_created ON public.asset_checklist_items;
CREATE TRIGGER trg_asset_checklist_items_created
BEFORE INSERT ON public.asset_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_asset_checklist_items_updated ON public.asset_checklist_items;
CREATE TRIGGER trg_asset_checklist_items_updated
BEFORE UPDATE ON public.asset_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_by();

-- -----------------------------------------------------------------------------
-- 3) Respuestas del técnico por ticket + activo
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ticket_asset_checklist_responses (
  id          bigserial PRIMARY KEY,
  ticket_id   bigint NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  asset_id    bigint NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  item_id     bigint NOT NULL REFERENCES public.asset_checklist_items(id) ON DELETE CASCADE,
  item_label  text   NOT NULL,
  checked     boolean NOT NULL DEFAULT false,
  note        text,
  answered_by uuid NULL REFERENCES public.users(id),
  answered_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  CONSTRAINT uq_ticket_asset_checklist_response UNIQUE (ticket_id, asset_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_asset_checklist_resp_ticket
  ON public.ticket_asset_checklist_responses (ticket_id, asset_id);

-- -----------------------------------------------------------------------------
-- 4) Helpers
-- -----------------------------------------------------------------------------

-- ¿El usuario es el técnico asignado del ticket? (principal/secundario activo o legacy)
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

-- ¿Está completo el checklist de cierre para todos los activos requeridos del ticket?
CREATE OR REPLACE FUNCTION public.is_ticket_asset_checklist_complete(p_ticket_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.ticket_assets ta
    JOIN public.assets a
      ON a.id = ta.asset_id AND a.closure_checklist_required = true
    JOIN public.asset_checklist_items ci
      ON ci.asset_id = a.id AND ci.is_active = true
    LEFT JOIN public.ticket_asset_checklist_responses r
      ON r.ticket_id = p_ticket_id AND r.asset_id = a.id AND r.item_id = ci.id
    WHERE ta.ticket_id = p_ticket_id
      AND COALESCE(r.checked, false) = false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_ticket_assigned_technician(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ticket_asset_checklist_complete(bigint) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5) RPCs
-- -----------------------------------------------------------------------------

-- Guardar respuestas del checklist para un ticket + activo.
-- p_responses: jsonb array [{ "item_id": bigint, "checked": bool, "note": text }]
CREATE OR REPLACE FUNCTION public.save_ticket_asset_checklist(
  p_ticket_id bigint,
  p_asset_id  bigint,
  p_responses jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_elem    jsonb;
  v_item_id bigint;
  v_checked boolean;
  v_note    text;
  v_label   text;
  v_title   text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No hay sesión activa.';
  END IF;

  IF NOT (
    public.is_ticket_assigned_technician(v_uid, p_ticket_id)
    OR public.me_has_permission('work_orders:full_access')
  ) THEN
    RAISE EXCEPTION 'Solo el técnico asignado puede llenar el checklist de este ticket.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_assets
    WHERE ticket_id = p_ticket_id AND asset_id = p_asset_id
  ) THEN
    RAISE EXCEPTION 'El activo no está vinculado a este ticket.';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_responses, '[]'::jsonb))
  LOOP
    v_item_id := NULLIF(v_elem->>'item_id', '')::bigint;
    v_checked := COALESCE((v_elem->>'checked')::boolean, false);
    v_note    := NULLIF(trim(COALESCE(v_elem->>'note', '')), '');

    -- Solo aceptamos items activos que pertenezcan al activo (snapshot del label).
    SELECT label INTO v_label
    FROM public.asset_checklist_items
    WHERE id = v_item_id AND asset_id = p_asset_id AND is_active = true;

    IF v_label IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT v_checked AND v_note IS NULL THEN
      RAISE EXCEPTION 'Debes justificar con una nota las verificaciones no cumplidas: "%".', v_label;
    END IF;

    INSERT INTO public.ticket_asset_checklist_responses(
      ticket_id, asset_id, item_id, item_label, checked, note, answered_by, answered_at
    )
    VALUES (
      p_ticket_id, p_asset_id, v_item_id, v_label, v_checked, v_note, v_uid,
      (now() AT TIME ZONE 'America/Santo_Domingo')
    )
    ON CONFLICT (ticket_id, asset_id, item_id)
    DO UPDATE SET
      checked     = EXCLUDED.checked,
      note        = EXCLUDED.note,
      item_label  = EXCLUDED.item_label,
      answered_by = EXCLUDED.answered_by,
      answered_at = EXCLUDED.answered_at;
  END LOOP;

  SELECT title INTO v_title FROM public.tickets WHERE id = p_ticket_id;

  PERFORM public.write_activity_log(
    'asset.checklist_saved', 'tickets', p_ticket_id::text,
    COALESCE(v_title, 'Ticket #' || p_ticket_id),
    format('Checklist de cierre actualizado (activo #%s) en ticket #%s', p_asset_id, p_ticket_id),
    jsonb_build_object('ticket_id', p_ticket_id, 'asset_id', p_asset_id),
    v_uid
  );
END;
$$;

-- Devuelve la estructura de checklists (plantilla + respuestas) para la UI del ticket.
CREATE OR REPLACE FUNCTION public.get_ticket_asset_checklists(p_ticket_id bigint)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_can_fill boolean;
  v_can_view boolean;
  v_assets   jsonb;
BEGIN
  v_can_fill :=
    public.is_ticket_assigned_technician(v_uid, p_ticket_id)
    OR public.me_has_permission('work_orders:full_access');

  v_can_view :=
    v_can_fill
    OR public.me_has_permission('work_orders:read')
    OR public.is_ticket_approver(v_uid, p_ticket_id)
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = p_ticket_id AND t.created_by = v_uid)
    OR EXISTS (
      SELECT 1 FROM public.approval_requests r
      WHERE r.ticket_id = p_ticket_id AND r.requester_user_id = v_uid
    );

  IF NOT v_can_view THEN
    RETURN jsonb_build_object('can_fill', false, 'complete', true, 'assets', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(asset_obj ORDER BY asset_code), '[]'::jsonb)
  INTO v_assets
  FROM (
    SELECT
      a.code AS asset_code,
      jsonb_build_object(
        'asset_id', a.id,
        'code', a.code,
        'name', a.name,
        'items', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'item_id', ci.id,
              'label', ci.label,
              'position', ci.position,
              'checked', COALESCE(r.checked, false),
              'note', r.note
            )
            ORDER BY ci.position, ci.id
          )
          FROM public.asset_checklist_items ci
          LEFT JOIN public.ticket_asset_checklist_responses r
            ON r.ticket_id = p_ticket_id AND r.asset_id = a.id AND r.item_id = ci.id
          WHERE ci.asset_id = a.id AND ci.is_active = true
        ), '[]'::jsonb)
      ) AS asset_obj
    FROM public.ticket_assets ta
    JOIN public.assets a
      ON a.id = ta.asset_id AND a.closure_checklist_required = true
    WHERE ta.ticket_id = p_ticket_id
  ) sub;

  RETURN jsonb_build_object(
    'can_fill', v_can_fill,
    'complete', public.is_ticket_asset_checklist_complete(p_ticket_id),
    'assets', v_assets
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_ticket_asset_checklist(bigint, bigint, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_ticket_asset_checklist(bigint, bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket_asset_checklists(bigint) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6) RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.asset_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_asset_checklist_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asset_checklist_items_select ON public.asset_checklist_items;
DROP POLICY IF EXISTS asset_checklist_items_insert ON public.asset_checklist_items;
DROP POLICY IF EXISTS asset_checklist_items_update ON public.asset_checklist_items;
DROP POLICY IF EXISTS asset_checklist_items_delete ON public.asset_checklist_items;

CREATE POLICY asset_checklist_items_select
ON public.asset_checklist_items
FOR SELECT TO authenticated
USING (
  public.me_has_permission('assets:read')
  OR public.me_has_permission('assets:full_access')
  OR public.me_has_permission('work_orders:read')
  OR public.me_has_permission('work_orders:full_access')
);

CREATE POLICY asset_checklist_items_insert
ON public.asset_checklist_items
FOR INSERT TO authenticated
WITH CHECK (
  public.me_has_permission('assets:update')
  OR public.me_has_permission('assets:full_access')
);

CREATE POLICY asset_checklist_items_update
ON public.asset_checklist_items
FOR UPDATE TO authenticated
USING (
  public.me_has_permission('assets:update')
  OR public.me_has_permission('assets:full_access')
)
WITH CHECK (
  public.me_has_permission('assets:update')
  OR public.me_has_permission('assets:full_access')
);

CREATE POLICY asset_checklist_items_delete
ON public.asset_checklist_items
FOR DELETE TO authenticated
USING (
  public.me_has_permission('assets:update')
  OR public.me_has_permission('assets:full_access')
);

-- Respuestas: solo lectura a cliente; escrituras vía RPC (save_ticket_asset_checklist).
DROP POLICY IF EXISTS ticket_asset_checklist_responses_select ON public.ticket_asset_checklist_responses;
CREATE POLICY ticket_asset_checklist_responses_select
ON public.ticket_asset_checklist_responses
FOR SELECT TO authenticated
USING (
  answered_by = auth.uid()
  OR public.me_has_permission('work_orders:read')
  OR public.me_has_permission('work_orders:full_access')
  OR public.me_has_permission('assets:read')
  OR public.me_has_permission('assets:full_access')
  OR public.is_ticket_assigned_technician(auth.uid(), ticket_id)
  OR public.is_ticket_approver(auth.uid(), ticket_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_checklist_items TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.asset_checklist_items_id_seq TO authenticated;
GRANT SELECT ON public.ticket_asset_checklist_responses TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ticket_asset_checklist_responses_id_seq TO authenticated;

-- -----------------------------------------------------------------------------
-- 7) Override: request_ticket_approval con guard de checklist de cierre
--    (copia de 18_approvals.sql + bloqueo si el checklist no está completo)
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

  -- Guard: checklist de cierre del activo obligatorio y completo.
  IF NOT public.is_ticket_asset_checklist_complete(p_ticket_id) THEN
    RAISE EXCEPTION 'Debes completar el checklist de cierre del activo (todas las verificaciones marcadas) antes de enviar a validación.';
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
      'notify_actor', true
    ),
    v_recipients, 3
  );

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_ticket_approval(bigint, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_ticket_approval(bigint, jsonb, text) TO authenticated;
