-- Bloqueo de órdenes finalizadas — rollout incremental.
-- Baseline canónico: sql/modules/core_cmms/18_approvals.sql
-- Una orden en 'Finalizadas' solo puede cambiar de estado un aprobador (o un
-- gestor que no sea solicitante). Un técnico/solicitante ya no puede reabrirla
-- ni cambiarle el estado. Idempotente.

-- -----------------------------------------------------------------------------
-- 1) Helpers: ¿el usuario es aprobador de algún proceso de este ticket?
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 2) Guard de transición: añade el bloqueo de salida de 'Finalizadas'
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_ticket_approval_transition()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Finalizadas' AND OLD.status IS DISTINCT FROM 'Finalizadas' THEN
    IF current_setting('app.approval_finalize', true) = '1' THEN
      RETURN NEW;
    END IF;
    IF public.me_has_permission('work_orders:full_access') THEN
      RETURN NEW;
    END IF;
    IF public.is_approval_requester(auth.uid()) THEN
      RAISE EXCEPTION 'Debes enviar el ticket a validación; un aprobador debe finalizarlo.';
    END IF;
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
