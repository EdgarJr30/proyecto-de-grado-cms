-- Restringe la actualizacion del limite de tecnicos secundarios por OT
-- a usuarios con permiso work_orders:full_access.

CREATE OR REPLACE FUNCTION public.set_max_secondary_assignees(p_value int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.me_has_permission('work_orders:full_access') THEN
    RAISE EXCEPTION 'No autorizado para actualizar esta configuración.';
  END IF;

  IF p_value < 0 THEN
    RAISE EXCEPTION 'El límite no puede ser negativo.';
  END IF;

  PERFORM public.set_app_setting(
    'max_secondary_assignees',
    jsonb_build_object('v', p_value)
  );
END;
$$;
