-- Libera automáticamente herramientas cuando una OT entra a validación o finaliza.
-- Aplica para reservas abiertas:
-- - RESERVED -> CANCELLED
-- - CHECKED_OUT -> RETURNED (condición GOOD por defecto)
-- y deja la herramienta nuevamente AVAILABLE.

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

GRANT EXECUTE ON FUNCTION public.release_ticket_tool_reservations_for_ticket(bigint, text) TO authenticated;
