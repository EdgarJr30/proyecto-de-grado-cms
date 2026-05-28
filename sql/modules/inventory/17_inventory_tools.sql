-- inventory/17_inventory_tools.sql
-- Herramientas de trabajo: catálogo, reserva, entrega y devolución por OT.

CREATE TABLE IF NOT EXISTS public.tool_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid NULL REFERENCES public.tool_categories(id),

  created_at timestamptz NOT NULL DEFAULT public.now_santo_domingo(),
  updated_at timestamptz NOT NULL DEFAULT public.now_santo_domingo(),
  created_by uuid NULL REFERENCES public.users(id),
  updated_by uuid NULL REFERENCES public.users(id),

  UNIQUE (name, parent_id)
);

DROP TRIGGER IF EXISTS trg_audit_tool_categories ON public.tool_categories;
CREATE TRIGGER trg_audit_tool_categories
BEFORE INSERT OR UPDATE ON public.tool_categories
FOR EACH ROW EXECUTE FUNCTION public.audit_set_defaults();

CREATE SEQUENCE IF NOT EXISTS public.tool_code_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

CREATE TABLE IF NOT EXISTS public.tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('HT-' || lpad(nextval('public.tool_code_seq'::regclass)::text, 6, '0')),
  name text NOT NULL,
  description text NULL,
  category_id uuid NULL REFERENCES public.tool_categories(id),
  manufacturer text NULL,
  model text NULL,
  serial_number text NULL,
  asset_tag text NULL,
  home_warehouse_id uuid NULL REFERENCES public.warehouses(id),
  home_bin_id uuid NULL REFERENCES public.warehouse_bins(id),
  current_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  current_bin_id uuid NULL REFERENCES public.warehouse_bins(id),
  status text NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'RESERVED', 'CHECKED_OUT', 'MAINTENANCE', 'DAMAGED', 'RETIRED')),
  requires_calibration boolean NOT NULL DEFAULT false,
  calibration_due_on date NULL,
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT public.now_santo_domingo(),
  updated_at timestamptz NOT NULL DEFAULT public.now_santo_domingo(),
  created_by uuid NULL REFERENCES public.users(id),
  updated_by uuid NULL REFERENCES public.users(id),

  CONSTRAINT tools_home_bin_requires_warehouse
    CHECK (home_bin_id IS NULL OR home_warehouse_id IS NOT NULL)
);

ALTER TABLE public.tools
  ALTER COLUMN code SET DEFAULT ('HT-' || lpad(nextval('public.tool_code_seq'::regclass)::text, 6, '0'));

DO $$
DECLARE
  v_max bigint;
BEGIN
  SELECT COALESCE(MAX(substring(code FROM '^HT-([0-9]+)$')::bigint), 0)
    INTO v_max
  FROM public.tools
  WHERE code ~ '^HT-[0-9]+$';

  PERFORM setval('public.tool_code_seq', GREATEST(v_max, 1), v_max > 0);
END $$;

CREATE INDEX IF NOT EXISTS idx_tools_status
  ON public.tools(status, is_active);

CREATE INDEX IF NOT EXISTS idx_tools_current_location
  ON public.tools(current_warehouse_id, current_bin_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tools_serial_number
  ON public.tools(serial_number)
  WHERE serial_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_tools_asset_tag
  ON public.tools(asset_tag)
  WHERE asset_tag IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_tool_code_default()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NULLIF(trim(COALESCE(NEW.code, '')), '') IS NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.code := 'HT-' || lpad(nextval('public.tool_code_seq'::regclass)::text, 6, '0');
    ELSE
      RAISE EXCEPTION 'El código de la herramienta no puede quedar vacío.';
    END IF;
  ELSE
    NEW.code := upper(trim(NEW.code));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tools_code_defaults ON public.tools;
CREATE TRIGGER trg_tools_code_defaults
BEFORE INSERT OR UPDATE ON public.tools
FOR EACH ROW EXECUTE FUNCTION public.set_tool_code_default();

DROP TRIGGER IF EXISTS trg_audit_tools ON public.tools;
CREATE TRIGGER trg_audit_tools
BEFORE INSERT OR UPDATE ON public.tools
FOR EACH ROW EXECUTE FUNCTION public.audit_set_defaults();

CREATE TABLE IF NOT EXISTS public.ticket_tool_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id bigint NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES public.tools(id),
  reserved_at timestamptz NOT NULL DEFAULT public.now_santo_domingo(),
  checked_out_at timestamptz NULL,
  expected_return_at timestamptz NULL,
  returned_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  status text NOT NULL DEFAULT 'RESERVED'
    CHECK (status IN ('RESERVED', 'CHECKED_OUT', 'RETURNED', 'CANCELLED')),
  checkout_notes text NULL,
  return_notes text NULL,
  condition_on_return text NULL
    CHECK (condition_on_return IS NULL OR condition_on_return IN ('GOOD', 'DAMAGED', 'MAINTENANCE')),

  created_at timestamptz NOT NULL DEFAULT public.now_santo_domingo(),
  updated_at timestamptz NOT NULL DEFAULT public.now_santo_domingo(),
  created_by uuid NULL REFERENCES public.users(id),
  updated_by uuid NULL REFERENCES public.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ticket_tool_requests_open_tool
  ON public.ticket_tool_requests(tool_id)
  WHERE status IN ('RESERVED', 'CHECKED_OUT');

CREATE INDEX IF NOT EXISTS idx_ticket_tool_requests_ticket
  ON public.ticket_tool_requests(ticket_id, status);

DROP TRIGGER IF EXISTS trg_audit_ticket_tool_requests ON public.ticket_tool_requests;
CREATE TRIGGER trg_audit_ticket_tool_requests
BEFORE INSERT OR UPDATE ON public.ticket_tool_requests
FOR EACH ROW EXECUTE FUNCTION public.audit_set_defaults();

CREATE OR REPLACE VIEW public.v_available_tools
WITH (security_invoker = on)
AS
SELECT
  t.id AS tool_id,
  t.code AS tool_code,
  t.name AS tool_name,
  t.description,
  t.category_id,
  c.name AS category_name,
  t.manufacturer,
  t.model,
  t.serial_number,
  t.asset_tag,
  t.current_warehouse_id AS warehouse_id,
  w.code AS warehouse_code,
  w.name AS warehouse_name,
  t.current_bin_id AS bin_id,
  b.code AS bin_code,
  b.name AS bin_name,
  t.status,
  t.requires_calibration,
  t.calibration_due_on,
  (t.is_active = true
    AND t.status = 'AVAILABLE'
    AND (
      t.requires_calibration = false
      OR t.calibration_due_on IS NULL
      OR t.calibration_due_on >= CURRENT_DATE
    )
  ) AS is_available,
  open_req.ticket_id AS reserved_ticket_id,
  open_req.expected_return_at
FROM public.tools t
LEFT JOIN public.tool_categories c ON c.id = t.category_id
JOIN public.warehouses w ON w.id = t.current_warehouse_id
LEFT JOIN public.warehouse_bins b ON b.id = t.current_bin_id
LEFT JOIN LATERAL (
  SELECT r.ticket_id, r.expected_return_at
  FROM public.ticket_tool_requests r
  WHERE r.tool_id = t.id
    AND r.status IN ('RESERVED', 'CHECKED_OUT')
  ORDER BY r.created_at DESC
  LIMIT 1
) open_req ON true
WHERE t.is_active = true;

CREATE OR REPLACE FUNCTION public.reserve_ticket_tool(
  p_ticket_id bigint,
  p_tool_id uuid,
  p_expected_return_at timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := public.now_santo_domingo();
  v_tool public.tools%ROWTYPE;
  v_is_accepted boolean := false;
  v_request_id uuid;
BEGIN
  IF NOT (
    COALESCE(public.me_has_permission('inventory:work'), false)
    OR COALESCE(public.me_has_permission('inventory:create'), false)
    OR COALESCE(public.me_has_permission('inventory:full_access'), false)
  ) THEN
    RAISE EXCEPTION 'No autorizado para reservar herramientas de OT.';
  END IF;

  SELECT t.is_accepted
    INTO v_is_accepted
  FROM public.tickets t
  WHERE t.id = p_ticket_id;

  IF COALESCE(v_is_accepted, false) = false THEN
    RAISE EXCEPTION
      'Ticket % no está aceptado (no es OT). No se permite reservar herramientas.',
      p_ticket_id;
  END IF;

  SELECT *
    INTO v_tool
  FROM public.tools
  WHERE id = p_tool_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Herramienta % no existe.', p_tool_id;
  END IF;

  IF NOT v_tool.is_active OR v_tool.status <> 'AVAILABLE' THEN
    RAISE EXCEPTION 'La herramienta % no está disponible. Estado=%', v_tool.code, v_tool.status;
  END IF;

  IF v_tool.requires_calibration
     AND v_tool.calibration_due_on IS NOT NULL
     AND v_tool.calibration_due_on < CURRENT_DATE THEN
    RAISE EXCEPTION 'La herramienta % tiene calibración vencida (%).',
      v_tool.code, v_tool.calibration_due_on;
  END IF;

  INSERT INTO public.ticket_tool_requests(
    ticket_id, tool_id, expected_return_at, status, checkout_notes,
    created_at, updated_at
  )
  VALUES (
    p_ticket_id, p_tool_id, p_expected_return_at, 'RESERVED', p_notes,
    v_now, v_now
  )
  RETURNING id INTO v_request_id;

  UPDATE public.tools
  SET status = 'RESERVED',
      updated_at = v_now
  WHERE id = p_tool_id;

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_ticket_tool(
  p_ticket_id bigint,
  p_tool_id uuid,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := public.now_santo_domingo();
  v_request_id uuid;
BEGIN
  IF NOT (
    COALESCE(public.me_has_permission('inventory:work'), false)
    OR COALESCE(public.me_has_permission('inventory:create'), false)
    OR COALESCE(public.me_has_permission('inventory:full_access'), false)
  ) THEN
    RAISE EXCEPTION 'No autorizado para entregar herramientas de OT.';
  END IF;

  SELECT r.id
    INTO v_request_id
  FROM public.ticket_tool_requests r
  WHERE r.ticket_id = p_ticket_id
    AND r.tool_id = p_tool_id
    AND r.status = 'RESERVED'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe reserva abierta para esta herramienta en la OT.';
  END IF;

  UPDATE public.ticket_tool_requests
  SET status = 'CHECKED_OUT',
      checked_out_at = v_now,
      checkout_notes = COALESCE(NULLIF(p_notes, ''), checkout_notes),
      updated_at = v_now
  WHERE id = v_request_id;

  UPDATE public.tools
  SET status = 'CHECKED_OUT',
      updated_at = v_now
  WHERE id = p_tool_id
    AND status = 'RESERVED';

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.return_ticket_tool(
  p_ticket_id bigint,
  p_tool_id uuid,
  p_warehouse_id uuid,
  p_bin_id uuid DEFAULT NULL,
  p_condition text DEFAULT 'GOOD',
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := public.now_santo_domingo();
  v_request_id uuid;
  v_condition text := COALESCE(NULLIF(p_condition, ''), 'GOOD');
  v_next_status text;
BEGIN
  IF NOT (
    COALESCE(public.me_has_permission('inventory:work'), false)
    OR COALESCE(public.me_has_permission('inventory:create'), false)
    OR COALESCE(public.me_has_permission('inventory:full_access'), false)
  ) THEN
    RAISE EXCEPTION 'No autorizado para devolver herramientas de OT.';
  END IF;

  IF v_condition NOT IN ('GOOD', 'DAMAGED', 'MAINTENANCE') THEN
    RAISE EXCEPTION 'Condición de devolución inválida: %', v_condition;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.warehouses w
    WHERE w.id = p_warehouse_id AND w.is_active = true
  ) THEN
    RAISE EXCEPTION 'Almacén de devolución inválido.';
  END IF;

  IF p_bin_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.warehouse_bins b
    WHERE b.id = p_bin_id
      AND b.warehouse_id = p_warehouse_id
      AND b.is_active = true
  ) THEN
    RAISE EXCEPTION 'Ubicación de devolución inválida para el almacén seleccionado.';
  END IF;

  SELECT r.id
    INTO v_request_id
  FROM public.ticket_tool_requests r
  WHERE r.ticket_id = p_ticket_id
    AND r.tool_id = p_tool_id
    AND r.status = 'CHECKED_OUT'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe entrega abierta para esta herramienta en la OT.';
  END IF;

  v_next_status := CASE v_condition
    WHEN 'GOOD' THEN 'AVAILABLE'
    WHEN 'DAMAGED' THEN 'DAMAGED'
    ELSE 'MAINTENANCE'
  END;

  UPDATE public.ticket_tool_requests
  SET status = 'RETURNED',
      returned_at = v_now,
      condition_on_return = v_condition,
      return_notes = p_notes,
      updated_at = v_now
  WHERE id = v_request_id;

  UPDATE public.tools
  SET status = v_next_status,
      current_warehouse_id = p_warehouse_id,
      current_bin_id = p_bin_id,
      updated_at = v_now
  WHERE id = p_tool_id;

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_ticket_tool_reservation(
  p_ticket_id bigint,
  p_tool_id uuid,
  p_notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_now timestamptz := public.now_santo_domingo();
  v_request_id uuid;
BEGIN
  IF NOT (
    COALESCE(public.me_has_permission('inventory:work'), false)
    OR COALESCE(public.me_has_permission('inventory:create'), false)
    OR COALESCE(public.me_has_permission('inventory:full_access'), false)
  ) THEN
    RAISE EXCEPTION 'No autorizado para liberar reservas de herramientas de OT.';
  END IF;

  SELECT r.id
    INTO v_request_id
  FROM public.ticket_tool_requests r
  WHERE r.ticket_id = p_ticket_id
    AND r.tool_id = p_tool_id
    AND r.status = 'RESERVED'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe reserva abierta para esta herramienta en la OT.';
  END IF;

  UPDATE public.ticket_tool_requests
  SET status = 'CANCELLED',
      cancelled_at = v_now,
      return_notes = p_notes,
      updated_at = v_now
  WHERE id = v_request_id;

  UPDATE public.tools
  SET status = 'AVAILABLE',
      updated_at = v_now
  WHERE id = p_tool_id
    AND status = 'RESERVED';

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_ticket_tool_reservations_for_ticket(
  p_ticket_id bigint,
  p_reason text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := public.now_santo_domingo();
  v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'ticket_transition');
  v_count integer := 0;
BEGIN
  WITH open_rows AS (
    SELECT r.id, r.tool_id, r.status
    FROM public.ticket_tool_requests r
    WHERE r.ticket_id = p_ticket_id
      AND r.status IN ('RESERVED', 'CHECKED_OUT')
    FOR UPDATE
  ),
  updated_requests AS (
    UPDATE public.ticket_tool_requests r
    SET status = CASE
          WHEN open_rows.status = 'CHECKED_OUT' THEN 'RETURNED'
          ELSE 'CANCELLED'
        END,
        cancelled_at = CASE
          WHEN open_rows.status = 'RESERVED' THEN v_now
          ELSE r.cancelled_at
        END,
        returned_at = CASE
          WHEN open_rows.status = 'CHECKED_OUT' THEN v_now
          ELSE r.returned_at
        END,
        condition_on_return = CASE
          WHEN open_rows.status = 'CHECKED_OUT' THEN COALESCE(r.condition_on_return, 'GOOD')
          ELSE r.condition_on_return
        END,
        return_notes = COALESCE(
          NULLIF(trim(r.return_notes), ''),
          CASE
            WHEN v_reason = 'ticket_en_validacion'
              THEN 'Liberación automática: ticket enviado a validación.'
            WHEN v_reason = 'ticket_finalizado'
              THEN 'Liberación automática: ticket finalizado.'
            ELSE 'Liberación automática por cambio de estado del ticket.'
          END
        ),
        updated_at = v_now
    FROM open_rows
    WHERE r.id = open_rows.id
    RETURNING open_rows.tool_id
  ),
  updated_tools AS (
    UPDATE public.tools t
    SET status = 'AVAILABLE',
        updated_at = v_now
    WHERE t.id IN (SELECT tool_id FROM updated_requests)
      AND t.status IN ('RESERVED', 'CHECKED_OUT')
    RETURNING t.id
  )
  SELECT count(*) INTO v_count FROM updated_requests;

  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_ticket_tools_on_ticket_terminal_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NOT (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.finalized_at IS DISTINCT FROM NEW.finalized_at
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'En Validación' THEN
    v_reason := 'ticket_en_validacion';
  ELSIF NEW.status = 'Finalizadas'
     OR (OLD.finalized_at IS NULL AND NEW.finalized_at IS NOT NULL) THEN
    v_reason := 'ticket_finalizado';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM public.release_ticket_tool_reservations_for_ticket(NEW.id, v_reason);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_ticket_tools_on_ticket_terminal_state ON public.tickets;
CREATE TRIGGER trg_release_ticket_tools_on_ticket_terminal_state
AFTER UPDATE OF status, finalized_at ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.release_ticket_tools_on_ticket_terminal_state();

ALTER TABLE public.tool_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_tool_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_tool_categories_read ON public.tool_categories;
CREATE POLICY p_tool_categories_read ON public.tool_categories FOR SELECT
USING (public.me_has_permission('inventory:read'));

DROP POLICY IF EXISTS p_tool_categories_write ON public.tool_categories;
CREATE POLICY p_tool_categories_write ON public.tool_categories FOR ALL
USING (public.me_has_permission('inventory:full_access'))
WITH CHECK (public.me_has_permission('inventory:full_access'));

DROP POLICY IF EXISTS p_tools_read ON public.tools;
CREATE POLICY p_tools_read ON public.tools FOR SELECT
USING (public.me_has_permission('inventory:read'));

DROP POLICY IF EXISTS p_tools_write ON public.tools;
CREATE POLICY p_tools_write ON public.tools FOR ALL
USING (public.me_has_permission('inventory:full_access'))
WITH CHECK (public.me_has_permission('inventory:full_access'));

DROP POLICY IF EXISTS p_ticket_tools_read ON public.ticket_tool_requests;
CREATE POLICY p_ticket_tools_read ON public.ticket_tool_requests FOR SELECT
USING (public.me_has_permission('inventory:read'));

DROP POLICY IF EXISTS p_ticket_tools_write ON public.ticket_tool_requests;
CREATE POLICY p_ticket_tools_write ON public.ticket_tool_requests FOR ALL
USING (false)
WITH CHECK (false);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tool_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tools TO authenticated;
GRANT SELECT ON public.ticket_tool_requests TO authenticated;
GRANT SELECT ON public.v_available_tools TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tool_code_seq TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.ticket_tool_requests FROM anon, authenticated;

ALTER FUNCTION public.reserve_ticket_tool(bigint, uuid, timestamptz, text) SECURITY DEFINER;
ALTER FUNCTION public.issue_ticket_tool(bigint, uuid, text) SECURITY DEFINER;
ALTER FUNCTION public.return_ticket_tool(bigint, uuid, uuid, uuid, text, text) SECURITY DEFINER;
ALTER FUNCTION public.release_ticket_tool_reservation(bigint, uuid, text) SECURITY DEFINER;
ALTER FUNCTION public.release_ticket_tool_reservations_for_ticket(bigint, text) SECURITY DEFINER;
ALTER FUNCTION public.release_ticket_tools_on_ticket_terminal_state() SECURITY DEFINER;

ALTER FUNCTION public.reserve_ticket_tool(bigint, uuid, timestamptz, text) SET search_path = public;
ALTER FUNCTION public.issue_ticket_tool(bigint, uuid, text) SET search_path = public;
ALTER FUNCTION public.return_ticket_tool(bigint, uuid, uuid, uuid, text, text) SET search_path = public;
ALTER FUNCTION public.release_ticket_tool_reservation(bigint, uuid, text) SET search_path = public;
ALTER FUNCTION public.release_ticket_tool_reservations_for_ticket(bigint, text) SET search_path = public;
ALTER FUNCTION public.release_ticket_tools_on_ticket_terminal_state() SET search_path = public;

GRANT EXECUTE ON FUNCTION public.reserve_ticket_tool(bigint, uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_ticket_tool(bigint, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_ticket_tool(bigint, uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_ticket_tool_reservation(bigint, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_ticket_tool_reservations_for_ticket(bigint, text) TO authenticated;

SELECT public.refresh_activity_logging();
