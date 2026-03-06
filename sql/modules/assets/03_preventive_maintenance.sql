-- ============================================================================
-- assets/03_preventive_maintenance.sql
-- Mantenimiento preventivo recurrente por activo:
-- - Configuración de plan preventivo por activo.
-- - Generación automática de OT preventivas (scheduler).
-- - Registro automático en bitácora al cerrar OT preventiva.
-- ============================================================================

-- 1) ENUM de frecuencia preventiva (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'asset_pm_interval_unit_enum'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.asset_pm_interval_unit_enum AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');
  END IF;
END $$;

-- 2) Plan preventivo por activo
CREATE TABLE IF NOT EXISTS public.asset_preventive_maintenance_plans (
  id bigserial PRIMARY KEY,
  asset_id bigint NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,

  is_active boolean NOT NULL DEFAULT false,
  frequency_value integer NOT NULL DEFAULT 1 CHECK (frequency_value > 0),
  frequency_unit public.asset_pm_interval_unit_enum NOT NULL DEFAULT 'MONTH',
  start_on date NOT NULL,
  next_due_on date NOT NULL,
  lead_days integer NOT NULL DEFAULT 0 CHECK (lead_days >= 0 AND lead_days <= 3650),

  default_priority public.priority_enum NOT NULL DEFAULT 'Media',
  title_template text,
  instructions text,
  allow_open_work_orders boolean NOT NULL DEFAULT false,
  auto_assign_assignee_id bigint NULL REFERENCES public.assignees(id),

  last_generated_at timestamptz,
  last_generated_ticket_id bigint NULL REFERENCES public.tickets(id) ON DELETE SET NULL,
  last_completed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by uuid NULL REFERENCES public.users(id),
  updated_by uuid NULL REFERENCES public.users(id),

  CONSTRAINT asset_preventive_maintenance_plans_asset_uk UNIQUE (asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_pm_plans_active_due
  ON public.asset_preventive_maintenance_plans(is_active, next_due_on)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_asset_pm_plans_asset
  ON public.asset_preventive_maintenance_plans(asset_id);

-- 3) Bitácora de ejecuciones del scheduler preventivo
CREATE TABLE IF NOT EXISTS public.asset_preventive_maintenance_runs (
  id bigserial PRIMARY KEY,
  plan_id bigint NOT NULL REFERENCES public.asset_preventive_maintenance_plans(id) ON DELETE CASCADE,
  asset_id bigint NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  due_on date NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  ticket_id bigint NULL REFERENCES public.tickets(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (
    status IN ('GENERATED', 'SKIPPED_OPEN_WORK_ORDER', 'SKIPPED_DUPLICATE')
  ),
  note text,
  created_by uuid NULL REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_asset_pm_runs_plan_due
  ON public.asset_preventive_maintenance_runs(plan_id, due_on DESC);

CREATE INDEX IF NOT EXISTS idx_asset_pm_runs_ticket
  ON public.asset_preventive_maintenance_runs(ticket_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_asset_pm_runs_generated_due
  ON public.asset_preventive_maintenance_runs(plan_id, due_on)
  WHERE status = 'GENERATED';

-- 4) Metadata preventiva en tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS maintenance_source text NOT NULL DEFAULT 'MANUAL';

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS preventive_plan_id bigint NULL;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS preventive_due_date date NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_maintenance_source_ck'
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_maintenance_source_ck
      CHECK (maintenance_source IN ('MANUAL', 'ASSET_PREVENTIVE'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_preventive_plan_id_fkey'
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_preventive_plan_id_fkey
      FOREIGN KEY (preventive_plan_id)
      REFERENCES public.asset_preventive_maintenance_plans(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tickets_preventive_plan
  ON public.tickets(preventive_plan_id);

CREATE INDEX IF NOT EXISTS idx_tickets_preventive_due
  ON public.tickets(preventive_due_date);

CREATE INDEX IF NOT EXISTS idx_tickets_maintenance_source
  ON public.tickets(maintenance_source);

-- 5) Helpers de frecuencia
CREATE OR REPLACE FUNCTION public.asset_pm_frequency_label(
  p_value integer,
  p_unit public.asset_pm_interval_unit_enum
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_unit
    WHEN 'DAY' THEN
      RETURN p_value::text || ' día' || CASE WHEN p_value = 1 THEN '' ELSE 's' END;
    WHEN 'WEEK' THEN
      RETURN p_value::text || ' semana' || CASE WHEN p_value = 1 THEN '' ELSE 's' END;
    WHEN 'MONTH' THEN
      RETURN p_value::text || ' mes' || CASE WHEN p_value = 1 THEN '' ELSE 'es' END;
    WHEN 'YEAR' THEN
      RETURN p_value::text || ' año' || CASE WHEN p_value = 1 THEN '' ELSE 's' END;
    ELSE
      RETURN p_value::text;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.asset_pm_next_due_date(
  p_from date,
  p_every integer,
  p_unit public.asset_pm_interval_unit_enum
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_every IS NULL OR p_every <= 0 THEN
    RAISE EXCEPTION 'La frecuencia debe ser mayor que 0';
  END IF;

  IF p_from IS NULL THEN
    RAISE EXCEPTION 'La fecha base no puede ser NULL';
  END IF;

  CASE p_unit
    WHEN 'DAY' THEN
      RETURN (p_from + make_interval(days => p_every))::date;
    WHEN 'WEEK' THEN
      RETURN (p_from + make_interval(days => p_every * 7))::date;
    WHEN 'MONTH' THEN
      RETURN (p_from + make_interval(months => p_every))::date;
    WHEN 'YEAR' THEN
      RETURN (p_from + make_interval(years => p_every))::date;
    ELSE
      RAISE EXCEPTION 'Unidad de frecuencia inválida: %', p_unit;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.asset_pm_advance_due_to_future(
  p_due date,
  p_every integer,
  p_unit public.asset_pm_interval_unit_enum,
  p_reference date DEFAULT CURRENT_DATE
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_next date;
BEGIN
  IF p_due IS NULL THEN
    RETURN NULL;
  END IF;

  v_next := p_due;
  WHILE v_next <= p_reference LOOP
    v_next := public.asset_pm_next_due_date(v_next, p_every, p_unit);
  END LOOP;

  RETURN v_next;
END;
$$;

-- 6) Upsert de plan preventivo (RPC para frontend)
CREATE OR REPLACE FUNCTION public.upsert_asset_preventive_plan(
  p_asset_id bigint,
  p_is_active boolean,
  p_frequency_value integer,
  p_frequency_unit public.asset_pm_interval_unit_enum,
  p_start_on date,
  p_lead_days integer DEFAULT 0,
  p_default_priority public.priority_enum DEFAULT 'Media',
  p_title_template text DEFAULT NULL,
  p_instructions text DEFAULT NULL,
  p_allow_open_work_orders boolean DEFAULT false,
  p_auto_assign_assignee_id bigint DEFAULT NULL
)
RETURNS public.asset_preventive_maintenance_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.asset_preventive_maintenance_plans%ROWTYPE;
  v_start date;
  v_next_due date;
  v_now timestamptz := (now() AT TIME ZONE 'America/Santo_Domingo');
BEGIN
  IF NOT (
    public.me_has_permission('assets:create')
    OR public.me_has_permission('assets:update')
    OR public.me_has_permission('assets:full_access')
  ) THEN
    RAISE EXCEPTION 'forbidden: requiere assets:create, assets:update o assets:full_access';
  END IF;

  IF p_asset_id IS NULL THEN
    RAISE EXCEPTION 'asset_id es obligatorio';
  END IF;

  IF p_frequency_value IS NULL OR p_frequency_value <= 0 THEN
    RAISE EXCEPTION 'frequency_value debe ser mayor que 0';
  END IF;

  IF p_lead_days IS NULL OR p_lead_days < 0 THEN
    RAISE EXCEPTION 'lead_days debe ser >= 0';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.assets a WHERE a.id = p_asset_id) THEN
    RAISE EXCEPTION 'Activo no existe: %', p_asset_id;
  END IF;

  IF p_auto_assign_assignee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.assignees s
    WHERE s.id = p_auto_assign_assignee_id
      AND s.is_active = true
  ) THEN
    RAISE EXCEPTION 'El técnico asignado no existe o está inactivo: %', p_auto_assign_assignee_id;
  END IF;

  v_start := COALESCE(p_start_on, CURRENT_DATE);

  SELECT *
  INTO v_plan
  FROM public.asset_preventive_maintenance_plans
  WHERE asset_id = p_asset_id
  FOR UPDATE;

  IF FOUND THEN
    v_next_due := v_plan.next_due_on;

    IF v_next_due IS NULL
      OR v_next_due < v_start
      OR v_plan.frequency_value IS DISTINCT FROM p_frequency_value
      OR v_plan.frequency_unit IS DISTINCT FROM p_frequency_unit
      OR v_plan.start_on IS DISTINCT FROM v_start
    THEN
      v_next_due := v_start;
      WHILE v_next_due < CURRENT_DATE LOOP
        v_next_due := public.asset_pm_next_due_date(v_next_due, p_frequency_value, p_frequency_unit);
      END LOOP;
    END IF;

    UPDATE public.asset_preventive_maintenance_plans
       SET is_active = COALESCE(p_is_active, false),
           frequency_value = p_frequency_value,
           frequency_unit = p_frequency_unit,
           start_on = v_start,
           next_due_on = v_next_due,
           lead_days = p_lead_days,
           default_priority = COALESCE(p_default_priority, 'Media'),
           title_template = NULLIF(trim(COALESCE(p_title_template, '')), ''),
           instructions = NULLIF(trim(COALESCE(p_instructions, '')), ''),
           allow_open_work_orders = COALESCE(p_allow_open_work_orders, false),
           auto_assign_assignee_id = p_auto_assign_assignee_id,
           updated_at = v_now,
           updated_by = auth.uid()
     WHERE id = v_plan.id
     RETURNING * INTO v_plan;
  ELSE
    v_next_due := v_start;
    WHILE v_next_due < CURRENT_DATE LOOP
      v_next_due := public.asset_pm_next_due_date(v_next_due, p_frequency_value, p_frequency_unit);
    END LOOP;

    INSERT INTO public.asset_preventive_maintenance_plans (
      asset_id,
      is_active,
      frequency_value,
      frequency_unit,
      start_on,
      next_due_on,
      lead_days,
      default_priority,
      title_template,
      instructions,
      allow_open_work_orders,
      auto_assign_assignee_id,
      created_at,
      updated_at,
      created_by,
      updated_by
    )
    VALUES (
      p_asset_id,
      COALESCE(p_is_active, false),
      p_frequency_value,
      p_frequency_unit,
      v_start,
      v_next_due,
      p_lead_days,
      COALESCE(p_default_priority, 'Media'),
      NULLIF(trim(COALESCE(p_title_template, '')), ''),
      NULLIF(trim(COALESCE(p_instructions, '')), ''),
      COALESCE(p_allow_open_work_orders, false),
      p_auto_assign_assignee_id,
      v_now,
      v_now,
      auth.uid(),
      auth.uid()
    )
    RETURNING * INTO v_plan;
  END IF;

  RETURN v_plan;
END;
$$;

-- 7) Scheduler: genera OT preventivas automáticamente
CREATE OR REPLACE FUNCTION public.run_asset_preventive_scheduler(
  p_run_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_ticket_id bigint;
  v_assignee_id bigint;
  v_assignee_name text;
  v_title text;
  v_description text;

  v_now timestamptz := COALESCE(p_run_at, now());
  v_run_date date := (COALESCE(p_run_at, now()) AT TIME ZONE 'America/Santo_Domingo')::date;

  v_generated integer := 0;
  v_skipped_open integer := 0;
  v_skipped_duplicate integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (
       public.me_has_permission('assets:update')
       OR public.me_has_permission('assets:full_access')
     )
  THEN
    RAISE EXCEPTION 'forbidden: requiere assets:update o assets:full_access';
  END IF;

  IF NOT pg_try_advisory_xact_lock(90310, 1) THEN
    RETURN jsonb_build_object(
      'status', 'skipped_lock',
      'run_at', v_now
    );
  END IF;

  FOR v_plan IN
    SELECT
      p.*,
      a.code AS asset_code,
      a.name AS asset_name,
      a.location_id AS asset_location_id
    FROM public.asset_preventive_maintenance_plans p
    JOIN public.assets a ON a.id = p.asset_id
    WHERE p.is_active = true
      AND a.is_active = true
      AND a.status <> 'RETIRADO'
      AND (p.next_due_on - p.lead_days) <= v_run_date
    ORDER BY p.next_due_on ASC, p.id ASC
  LOOP
    IF NOT v_plan.allow_open_work_orders AND EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.preventive_plan_id = v_plan.id
        AND COALESCE(t.is_archived, false) = false
        AND lower(trim(COALESCE(t.status, ''))) IN (
          'pendiente',
          'en ejecución',
          'en ejecucion'
        )
    ) THEN
      v_skipped_open := v_skipped_open + 1;

      INSERT INTO public.asset_preventive_maintenance_runs (
        plan_id,
        asset_id,
        due_on,
        generated_at,
        status,
        note,
        created_by
      )
      VALUES (
        v_plan.id,
        v_plan.asset_id,
        v_plan.next_due_on,
        v_now,
        'SKIPPED_OPEN_WORK_ORDER',
        'Se omitió generación automática porque existe una OT preventiva abierta para el plan.',
        NULL
      );

      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.preventive_plan_id = v_plan.id
        AND t.preventive_due_date = v_plan.next_due_on
    ) THEN
      v_skipped_duplicate := v_skipped_duplicate + 1;

      INSERT INTO public.asset_preventive_maintenance_runs (
        plan_id,
        asset_id,
        due_on,
        generated_at,
        status,
        note,
        created_by
      )
      VALUES (
        v_plan.id,
        v_plan.asset_id,
        v_plan.next_due_on,
        v_now,
        'SKIPPED_DUPLICATE',
        'Se omitió generación porque ya existe OT para ese vencimiento.',
        NULL
      );

      UPDATE public.asset_preventive_maintenance_plans
         SET next_due_on = public.asset_pm_advance_due_to_future(
                           v_plan.next_due_on,
                           v_plan.frequency_value,
                           v_plan.frequency_unit,
                           v_run_date
                         ),
             updated_at = v_now,
             updated_by = NULL
       WHERE id = v_plan.id;

      CONTINUE;
    END IF;

    v_assignee_id := NULL;
    v_assignee_name := 'Sin asignar';

    IF v_plan.auto_assign_assignee_id IS NOT NULL THEN
      SELECT
        s.id,
        NULLIF(trim(concat_ws(' ', s.name, s.last_name)), '')
      INTO
        v_assignee_id,
        v_assignee_name
      FROM public.assignees s
      WHERE s.id = v_plan.auto_assign_assignee_id
        AND s.is_active = true
      LIMIT 1;

      IF v_assignee_name IS NULL THEN
        v_assignee_name := 'Sin asignar';
        v_assignee_id := NULL;
      END IF;
    END IF;

    v_title := COALESCE(
      NULLIF(trim(v_plan.title_template), ''),
      format('Mantenimiento preventivo - %s (%s)', v_plan.asset_name, v_plan.asset_code)
    );

    v_description :=
      'OT generada automáticamente por plan de mantenimiento preventivo.'
      || E'\nActivo: ' || v_plan.asset_code || ' - ' || v_plan.asset_name
      || E'\nFrecuencia: cada ' || public.asset_pm_frequency_label(v_plan.frequency_value, v_plan.frequency_unit)
      || E'\nFecha objetivo: ' || to_char(v_plan.next_due_on, 'YYYY-MM-DD')
      || CASE
           WHEN NULLIF(trim(COALESCE(v_plan.instructions, '')), '') IS NULL THEN ''
           ELSE E'\n\nInstrucciones:\n' || v_plan.instructions
         END;

    INSERT INTO public.tickets (
      title,
      description,
      is_accepted,
      is_urgent,
      priority,
      requester,
      location_id,
      assignee,
      incident_date,
      deadline_date,
      image,
      status,
      is_archived,
      finalized_at,
      assignee_id,
      maintenance_source,
      preventive_plan_id,
      preventive_due_date
    )
    VALUES (
      v_title,
      v_description,
      true,
      false,
      v_plan.default_priority,
      'Plan preventivo automático',
      v_plan.asset_location_id,
      v_assignee_name,
      v_run_date,
      v_plan.next_due_on,
      '',
      'Pendiente',
      false,
      NULL,
      v_assignee_id,
      'ASSET_PREVENTIVE',
      v_plan.id,
      v_plan.next_due_on
    )
    RETURNING id INTO v_ticket_id;

    INSERT INTO public.ticket_assets (
      ticket_id,
      asset_id,
      is_primary,
      created_by
    )
    VALUES (
      v_ticket_id,
      v_plan.asset_id,
      true,
      NULL
    )
    ON CONFLICT (ticket_id, asset_id)
    DO UPDATE SET is_primary = EXCLUDED.is_primary;

    IF v_assignee_id IS NOT NULL THEN
      INSERT INTO public.work_order_assignees (
        work_order_id,
        assignee_id,
        role,
        is_active,
        assigned_at,
        created_at,
        updated_at,
        created_by,
        updated_by
      )
      VALUES (
        v_ticket_id,
        v_assignee_id,
        'PRIMARY',
        true,
        v_now,
        v_now,
        v_now,
        NULL,
        NULL
      )
      ON CONFLICT (work_order_id, assignee_id)
      DO UPDATE SET
        role = 'PRIMARY',
        is_active = true,
        unassigned_at = NULL,
        updated_at = v_now,
        updated_by = NULL;
    END IF;

    INSERT INTO public.asset_preventive_maintenance_runs (
      plan_id,
      asset_id,
      due_on,
      generated_at,
      ticket_id,
      status,
      note,
      created_by
    )
    VALUES (
      v_plan.id,
      v_plan.asset_id,
      v_plan.next_due_on,
      v_now,
      v_ticket_id,
      'GENERATED',
      'OT preventiva generada automáticamente.',
      NULL
    );

    UPDATE public.asset_preventive_maintenance_plans
       SET last_generated_at = v_now,
           last_generated_ticket_id = v_ticket_id,
           next_due_on = public.asset_pm_advance_due_to_future(
             v_plan.next_due_on,
             v_plan.frequency_value,
             v_plan.frequency_unit,
             v_run_date
           ),
           updated_at = v_now,
           updated_by = NULL
     WHERE id = v_plan.id;

    v_generated := v_generated + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'ok',
    'run_at', v_now,
    'run_date', v_run_date,
    'generated', v_generated,
    'skipped_open_work_order', v_skipped_open,
    'skipped_duplicate', v_skipped_duplicate
  );
END;
$$;

-- 8) Trigger: al cerrar OT preventiva, registrar bitácora de mantenimiento
CREATE OR REPLACE FUNCTION public.asset_pm_on_ticket_finalized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset_id bigint;
  v_performed_by text;
  v_when timestamptz := COALESCE(NEW.finalized_at, now());
BEGIN
  IF NEW.status = 'Finalizadas'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.maintenance_source = 'ASSET_PREVENTIVE'
     AND NEW.preventive_plan_id IS NOT NULL
  THEN
    SELECT ta.asset_id
      INTO v_asset_id
      FROM public.ticket_assets ta
     WHERE ta.ticket_id = NEW.id
     ORDER BY ta.is_primary DESC, ta.asset_id ASC
     LIMIT 1;

    IF v_asset_id IS NULL THEN
      SELECT p.asset_id
        INTO v_asset_id
        FROM public.asset_preventive_maintenance_plans p
       WHERE p.id = NEW.preventive_plan_id
       LIMIT 1;
    END IF;

    IF NEW.assignee_id IS NOT NULL THEN
      SELECT NULLIF(trim(concat_ws(' ', s.name, s.last_name)), '')
        INTO v_performed_by
        FROM public.assignees s
       WHERE s.id = NEW.assignee_id
       LIMIT 1;
    END IF;

    IF v_asset_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.asset_maintenance_log aml
         WHERE aml.ticket_id = NEW.id
           AND upper(COALESCE(aml.maintenance_type, '')) = 'PREVENTIVO'
       )
    THEN
      INSERT INTO public.asset_maintenance_log (
        asset_id,
        ticket_id,
        maintenance_type,
        summary,
        details,
        performed_at,
        performed_by,
        labor_cost,
        parts_cost,
        other_cost,
        downtime_minutes,
        created_by
      )
      VALUES (
        v_asset_id,
        NEW.id,
        'PREVENTIVO',
        COALESCE(NEW.title, 'Mantenimiento preventivo'),
        format(
          'Registro automático al cerrar OT preventiva #%s (plan #%s, vencimiento %s).',
          NEW.id,
          NEW.preventive_plan_id,
          to_char(COALESCE(NEW.preventive_due_date, NEW.incident_date), 'YYYY-MM-DD')
        ),
        v_when,
        v_performed_by,
        0,
        0,
        0,
        0,
        NEW.updated_by
      );
    END IF;

    UPDATE public.asset_preventive_maintenance_plans
       SET last_completed_at = v_when,
           updated_at = (now() AT TIME ZONE 'America/Santo_Domingo'),
           updated_by = NEW.updated_by
     WHERE id = NEW.preventive_plan_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_asset_pm_on_ticket_finalized ON public.tickets;
CREATE TRIGGER trg_asset_pm_on_ticket_finalized
AFTER UPDATE ON public.tickets
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.asset_pm_on_ticket_finalized();

-- 9) Extender vista de activos con datos preventivos
CREATE OR REPLACE VIEW public.v_assets AS
SELECT
  a.*,
  l.name AS location_name,
  l.code AS location_code,
  c.name AS category_name,

  p.id AS preventive_plan_id,
  p.is_active AS preventive_is_active,
  p.frequency_value AS preventive_frequency_value,
  p.frequency_unit AS preventive_frequency_unit,
  p.start_on AS preventive_start_on,
  p.next_due_on AS preventive_next_due_on,
  p.lead_days AS preventive_lead_days,
  p.default_priority AS preventive_priority,
  p.title_template AS preventive_title_template,
  p.instructions AS preventive_instructions,
  p.allow_open_work_orders AS preventive_allow_open_work_orders,
  p.auto_assign_assignee_id AS preventive_auto_assign_assignee_id,
  p.last_generated_at AS preventive_last_generated_at,
  p.last_generated_ticket_id AS preventive_last_generated_ticket_id,
  p.last_completed_at AS preventive_last_completed_at
FROM public.assets a
JOIN public.locations l ON l.id = a.location_id
JOIN public.asset_categories c ON c.id = a.category_id
LEFT JOIN public.asset_preventive_maintenance_plans p ON p.asset_id = a.id;

GRANT SELECT ON public.v_assets TO authenticated;

-- 10) RLS para tablas preventivas
ALTER TABLE public.asset_preventive_maintenance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_preventive_maintenance_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asset_pm_plans_select ON public.asset_preventive_maintenance_plans;
DROP POLICY IF EXISTS asset_pm_plans_insert ON public.asset_preventive_maintenance_plans;
DROP POLICY IF EXISTS asset_pm_plans_update ON public.asset_preventive_maintenance_plans;
DROP POLICY IF EXISTS asset_pm_plans_delete ON public.asset_preventive_maintenance_plans;

CREATE POLICY asset_pm_plans_select
ON public.asset_preventive_maintenance_plans
FOR SELECT
TO authenticated
USING (
  public.me_has_permission('assets:read')
  OR public.me_has_permission('assets:full_access')
);

CREATE POLICY asset_pm_plans_insert
ON public.asset_preventive_maintenance_plans
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.me_has_permission('assets:create')
    OR public.me_has_permission('assets:update')
    OR public.me_has_permission('assets:full_access')
  )
  AND (created_by IS NULL OR created_by = auth.uid())
);

CREATE POLICY asset_pm_plans_update
ON public.asset_preventive_maintenance_plans
FOR UPDATE
TO authenticated
USING (
  public.me_has_permission('assets:update')
  OR public.me_has_permission('assets:full_access')
)
WITH CHECK (
  public.me_has_permission('assets:update')
  OR public.me_has_permission('assets:full_access')
);

CREATE POLICY asset_pm_plans_delete
ON public.asset_preventive_maintenance_plans
FOR DELETE
TO authenticated
USING (
  public.me_has_permission('assets:full_access')
);

DROP POLICY IF EXISTS asset_pm_runs_select ON public.asset_preventive_maintenance_runs;

CREATE POLICY asset_pm_runs_select
ON public.asset_preventive_maintenance_runs
FOR SELECT
TO authenticated
USING (
  public.me_has_permission('assets:read')
  OR public.me_has_permission('assets:full_access')
);

-- 11) Grants de funciones
GRANT EXECUTE ON FUNCTION public.asset_pm_frequency_label(integer, public.asset_pm_interval_unit_enum) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_pm_next_due_date(date, integer, public.asset_pm_interval_unit_enum) TO authenticated;
GRANT EXECUTE ON FUNCTION public.asset_pm_advance_due_to_future(date, integer, public.asset_pm_interval_unit_enum, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_asset_preventive_plan(
  bigint,
  boolean,
  integer,
  public.asset_pm_interval_unit_enum,
  date,
  integer,
  public.priority_enum,
  text,
  text,
  boolean,
  bigint
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_asset_preventive_scheduler(timestamptz) TO authenticated;

-- 12) Job de cron para generación automática (cada 30 minutos)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'asset_preventive_scheduler') THEN
      PERFORM cron.schedule(
        'asset_preventive_scheduler',
        '*/30 * * * *',
        $cron$SELECT public.run_asset_preventive_scheduler();$cron$
      );
    END IF;
  END IF;
END $$;
