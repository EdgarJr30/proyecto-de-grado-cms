-- Fix in-app notifications when an OT is accepted/assigned through tickets.assignee_id.
-- The notification trigger lives on work_order_assignees, so legacy direct ticket
-- updates must synchronize the primary assignment row.

CREATE OR REPLACE FUNCTION public.sync_ticket_primary_assignee_to_woa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamp := (now() AT TIME ZONE 'America/Santo_Domingo');
BEGIN
  IF NEW.is_accepted IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF NOT (
    OLD.assignee_id IS DISTINCT FROM NEW.assignee_id
    OR OLD.is_accepted IS DISTINCT FROM NEW.is_accepted
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(NEW.id);

  IF NEW.assignee_id IS NULL THEN
    UPDATE public.work_order_assignees
       SET is_active = false,
           unassigned_at = COALESCE(unassigned_at, v_now),
           updated_at = v_now,
           updated_by = auth.uid()
     WHERE work_order_id = NEW.id
       AND role = 'PRIMARY'
       AND is_active = true;
    RETURN NEW;
  END IF;

  UPDATE public.work_order_assignees
     SET is_active = false,
         unassigned_at = COALESCE(unassigned_at, v_now),
         updated_at = v_now,
         updated_by = auth.uid()
   WHERE work_order_id = NEW.id
     AND role = 'PRIMARY'
     AND is_active = true
     AND assignee_id <> NEW.assignee_id;

  INSERT INTO public.work_order_assignees(
    work_order_id,
    assignee_id,
    role,
    is_active,
    assigned_at,
    unassigned_at,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.assignee_id,
    'PRIMARY',
    true,
    v_now,
    NULL,
    auth.uid(),
    auth.uid(),
    v_now,
    v_now
  )
  ON CONFLICT (work_order_id, assignee_id) DO UPDATE
     SET role = 'PRIMARY',
         is_active = true,
         assigned_at = CASE
           WHEN public.work_order_assignees.is_active = false THEN v_now
           ELSE public.work_order_assignees.assigned_at
         END,
         unassigned_at = NULL,
         updated_at = v_now,
         updated_by = auth.uid()
   WHERE public.work_order_assignees.role IS DISTINCT FROM 'PRIMARY'
      OR public.work_order_assignees.is_active IS DISTINCT FROM true
      OR public.work_order_assignees.unassigned_at IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ticket_primary_assignee_to_woa ON public.tickets;
CREATE TRIGGER trg_sync_ticket_primary_assignee_to_woa
AFTER UPDATE OF assignee_id, is_accepted ON public.tickets
FOR EACH ROW
WHEN (
  OLD.assignee_id IS DISTINCT FROM NEW.assignee_id
  OR OLD.is_accepted IS DISTINCT FROM NEW.is_accepted
)
EXECUTE FUNCTION public.sync_ticket_primary_assignee_to_woa();

CREATE OR REPLACE FUNCTION public.accept_work_order(p_work_order_id bigint, p_primary_assignee_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator uuid;
BEGIN
  IF p_primary_assignee_id IS NULL THEN
    RAISE EXCEPTION 'Debes indicar el responsable principal para aceptar.';
  END IF;

  SELECT created_by INTO v_creator FROM public.tickets WHERE id = p_work_order_id;
  IF NOT (public.me_has_permission('work_orders:full_access') OR v_creator = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: necesitas permiso para aceptar o ser el creador del work_order';
  END IF;

  INSERT INTO public.work_order_assignees(work_order_id, assignee_id, role, is_active)
  VALUES (p_work_order_id, p_primary_assignee_id, 'PRIMARY', true)
  ON CONFLICT (work_order_id, assignee_id) DO UPDATE
     SET role = 'PRIMARY', is_active = true, unassigned_at = NULL;

  UPDATE public.tickets
     SET assignee_id = p_primary_assignee_id,
         is_accepted = true
   WHERE id = p_work_order_id AND COALESCE(is_accepted, false) = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'work_order inexistente o ya aceptado.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_work_order(bigint, bigint) TO authenticated;
