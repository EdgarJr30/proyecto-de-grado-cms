-- =========================================
-- DROPS (orden seguro)
-- =========================================

DROP VIEW IF EXISTS public.v_asset_tickets;
DROP VIEW IF EXISTS public.v_assets;

DROP TABLE IF EXISTS public.ticket_assets CASCADE;
DROP TABLE IF EXISTS public.asset_maintenance_log CASCADE;
DROP TABLE IF EXISTS public.asset_status_history CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.asset_categories CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_status_enum') THEN
    DROP TYPE public.asset_status_enum;
  END IF;
END $$;

-- =========================================
-- CREACIÓN (orden correcto)
-- =========================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_status_enum') THEN
    CREATE TYPE public.asset_status_enum AS ENUM (
      'OPERATIVO',
      'EN_MANTENIMIENTO',
      'FUERA_DE_SERVICIO',
      'RETIRADO'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.asset_categories (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by uuid NULL REFERENCES public.users(id),
  updated_by uuid NULL REFERENCES public.users(id),
  CONSTRAINT asset_categories_name_uniq UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_asset_categories_active ON public.asset_categories(is_active);

CREATE TABLE IF NOT EXISTS public.assets (
  id bigserial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  location_id bigint NOT NULL REFERENCES public.locations(id),
  category_id bigint NOT NULL REFERENCES public.asset_categories(id),
  asset_type text,
  criticality smallint NOT NULL DEFAULT 3 CHECK (criticality BETWEEN 1 AND 5),
  status public.asset_status_enum NOT NULL DEFAULT 'OPERATIVO',
  is_active boolean NOT NULL DEFAULT true,
  manufacturer text,
  model text,
  serial_number text,
  asset_tag text,
  purchase_date date,
  install_date date,
  warranty_end_date date,
  purchase_cost numeric(14,2),
  salvage_value numeric(14,2),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by uuid NULL REFERENCES public.users(id),
  updated_by uuid NULL REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_assets_location_id ON public.assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_category_id ON public.assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_active ON public.assets(is_active);

CREATE TABLE IF NOT EXISTS public.asset_status_history (
  id bigserial PRIMARY KEY,
  asset_id bigint NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  from_status public.asset_status_enum,
  to_status public.asset_status_enum NOT NULL,
  note text,
  changed_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  changed_by uuid NULL REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_asset_status_history_asset_id
  ON public.asset_status_history(asset_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS public.asset_maintenance_log (
  id bigserial PRIMARY KEY,
  asset_id bigint NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  ticket_id bigint NULL REFERENCES public.tickets(id) ON DELETE SET NULL,
  maintenance_type text NOT NULL,
  summary text NOT NULL,
  details text,
  performed_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  performed_by text,
  labor_cost numeric(14,2) DEFAULT 0,
  parts_cost numeric(14,2) DEFAULT 0,
  other_cost numeric(14,2) DEFAULT 0,
  downtime_minutes integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by uuid NULL REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_asset_maint_log_asset_id
  ON public.asset_maintenance_log(asset_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_asset_maint_log_ticket_id
  ON public.asset_maintenance_log(ticket_id);

-- 5) Relación tickets <> assets
CREATE TABLE IF NOT EXISTS public.ticket_assets (
  ticket_id bigint NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  asset_id  bigint NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by uuid NULL REFERENCES public.users(id),
  PRIMARY KEY (ticket_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_assets_asset_id ON public.ticket_assets(asset_id);

-- 6) Vistas
CREATE OR REPLACE VIEW public.v_assets AS
SELECT
  a.*,
  l.name AS location_name,
  l.code AS location_code,
  c.name AS category_name
FROM public.assets a
JOIN public.locations l ON l.id = a.location_id
JOIN public.asset_categories c ON c.id = a.category_id;

CREATE OR REPLACE VIEW public.v_asset_tickets AS
SELECT
  ta.asset_id,
  t.*,
  l.name AS location_name
FROM public.ticket_assets ta
JOIN public.tickets t ON t.id = ta.ticket_id
LEFT JOIN public.locations l ON l.id = t.location_id;


-- ================================
-- ASSETS: Habilitar RLS
-- ================================
ALTER TABLE public.asset_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_status_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_maintenance_log  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_assets          ENABLE ROW LEVEL SECURITY;

-- ================================
-- DROPS (idempotente)
-- ================================
DROP POLICY IF EXISTS asset_categories_select_active ON public.asset_categories;
DROP POLICY IF EXISTS asset_categories_select_full   ON public.asset_categories;
DROP POLICY IF EXISTS asset_categories_insert_rbac   ON public.asset_categories;
DROP POLICY IF EXISTS asset_categories_update_rbac   ON public.asset_categories;
DROP POLICY IF EXISTS asset_categories_delete_rbac   ON public.asset_categories;

DROP POLICY IF EXISTS assets_select   ON public.assets;
DROP POLICY IF EXISTS assets_insert   ON public.assets;
DROP POLICY IF EXISTS assets_update   ON public.assets;
DROP POLICY IF EXISTS assets_disable  ON public.assets;
DROP POLICY IF EXISTS assets_delete   ON public.assets;

DROP POLICY IF EXISTS asset_status_history_select ON public.asset_status_history;
DROP POLICY IF EXISTS asset_status_history_insert ON public.asset_status_history;
DROP POLICY IF EXISTS asset_status_history_delete ON public.asset_status_history;

DROP POLICY IF EXISTS asset_maintenance_log_select ON public.asset_maintenance_log;
DROP POLICY IF EXISTS asset_maintenance_log_insert ON public.asset_maintenance_log;
DROP POLICY IF EXISTS asset_maintenance_log_update ON public.asset_maintenance_log;
DROP POLICY IF EXISTS asset_maintenance_log_delete ON public.asset_maintenance_log;

DROP POLICY IF EXISTS ticket_assets_select ON public.ticket_assets;
DROP POLICY IF EXISTS ticket_assets_insert ON public.ticket_assets;
DROP POLICY IF EXISTS ticket_assets_update ON public.ticket_assets;
DROP POLICY IF EXISTS ticket_assets_delete ON public.ticket_assets;

-- ================================
-- 1) asset_categories
-- ================================

-- Lectura para combos (solo activas)
CREATE POLICY asset_categories_select_active
ON public.asset_categories
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    public.me_has_permission('assets:read')
    OR public.me_has_permission('assets:full_access')
  )
);

-- Lectura full (admin/gestor ve TODAS)
CREATE POLICY asset_categories_select_full
ON public.asset_categories
FOR SELECT
TO authenticated
USING (
  public.me_has_permission('assets:full_access')
  OR public.me_has_permission('inventory:full_access')
);

-- Insert (solo admin/gestor)
CREATE POLICY asset_categories_insert_rbac
ON public.asset_categories
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.me_has_permission('assets:full_access')
    OR public.me_has_permission('inventory:full_access')
  )
  AND (created_by IS NULL OR created_by = auth.uid())
);

-- Update (solo admin/gestor)
CREATE POLICY asset_categories_update_rbac
ON public.asset_categories
FOR UPDATE
TO authenticated
USING (
  public.me_has_permission('assets:full_access')
  OR public.me_has_permission('inventory:full_access')
)
WITH CHECK (
  public.me_has_permission('assets:full_access')
  OR public.me_has_permission('inventory:full_access')
);

-- Delete (solo admin/gestor)
CREATE POLICY asset_categories_delete_rbac
ON public.asset_categories
FOR DELETE
TO authenticated
USING (
  public.me_has_permission('assets:full_access')
  OR public.me_has_permission('inventory:full_access')
);

-- ================================
-- 2) assets
-- ================================

-- Select
CREATE POLICY assets_select
ON public.assets
FOR SELECT
TO authenticated
USING (
  public.me_has_permission('assets:read')
  OR public.me_has_permission('assets:full_access')
);

-- Insert
CREATE POLICY assets_insert
ON public.assets
FOR INSERT
TO authenticated
WITH CHECK (
  (public.me_has_permission('assets:create') OR public.me_has_permission('assets:full_access'))
  AND (created_by IS NULL OR created_by = auth.uid())
);

-- Update (editar general)
CREATE POLICY assets_update
ON public.assets
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

-- Update (activar/desactivar) - OJO: sin trigger esto permite editar cualquier columna
CREATE POLICY assets_disable
ON public.assets
FOR UPDATE
TO authenticated
USING (
  public.me_has_permission('assets:disable')
  OR public.me_has_permission('assets:full_access')
)
WITH CHECK (
  public.me_has_permission('assets:disable')
  OR public.me_has_permission('assets:full_access')
);

-- Delete
CREATE POLICY assets_delete
ON public.assets
FOR DELETE
TO authenticated
USING (
  public.me_has_permission('assets:delete')
  OR public.me_has_permission('assets:full_access')
);

-- ================================
-- 3) asset_status_history
-- ================================

CREATE POLICY asset_status_history_select
ON public.asset_status_history
FOR SELECT
TO authenticated
USING (
  public.me_has_permission('assets:read')
  OR public.me_has_permission('assets:full_access')
);

CREATE POLICY asset_status_history_insert
ON public.asset_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  (public.me_has_permission('assets:update') OR public.me_has_permission('assets:full_access'))
  AND (changed_by IS NULL OR changed_by = auth.uid())
);

CREATE POLICY asset_status_history_delete
ON public.asset_status_history
FOR DELETE
TO authenticated
USING (
  public.me_has_permission('assets:full_access')
);

-- ================================
-- 4) asset_maintenance_log
-- ================================

CREATE POLICY asset_maintenance_log_select
ON public.asset_maintenance_log
FOR SELECT
TO authenticated
USING (
  public.me_has_permission('assets:read')
  OR public.me_has_permission('assets:full_access')
);

CREATE POLICY asset_maintenance_log_insert
ON public.asset_maintenance_log
FOR INSERT
TO authenticated
WITH CHECK (
  (public.me_has_permission('assets:update') OR public.me_has_permission('assets:full_access'))
  AND (created_by IS NULL OR created_by = auth.uid())
);

CREATE POLICY asset_maintenance_log_update
ON public.asset_maintenance_log
FOR UPDATE
TO authenticated
USING (
  public.me_has_permission('assets:full_access')
)
WITH CHECK (
  public.me_has_permission('assets:full_access')
);

CREATE POLICY asset_maintenance_log_delete
ON public.asset_maintenance_log
FOR DELETE
TO authenticated
USING (
  public.me_has_permission('assets:full_access')
);

-- ================================
-- 5) ticket_assets
-- ================================

CREATE POLICY ticket_assets_select
ON public.ticket_assets
FOR SELECT
TO authenticated
USING (
  public.me_has_permission('assets:read')
  OR public.me_has_permission('assets:full_access')
  OR public.me_has_permission('work_orders:read')
  OR public.me_has_permission('work_orders:full_access')
);

CREATE POLICY ticket_assets_insert
ON public.ticket_assets
FOR INSERT
TO authenticated
WITH CHECK (
  (public.me_has_permission('assets:update') OR public.me_has_permission('assets:full_access'))
  AND (created_by IS NULL OR created_by = auth.uid())
);

CREATE POLICY ticket_assets_update
ON public.ticket_assets
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

CREATE POLICY ticket_assets_delete
ON public.ticket_assets
FOR DELETE
TO authenticated
USING (
  public.me_has_permission('assets:update')
  OR public.me_has_permission('assets:full_access')
);

GRANT SELECT ON public.v_assets TO authenticated;
GRANT SELECT ON public.v_asset_tickets TO authenticated;
