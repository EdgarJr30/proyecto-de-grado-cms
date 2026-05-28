-- Manuales técnicos de activos — rollout incremental.
-- Baseline canónico: sql/modules/assets/04_asset_manuals.sql
-- =============================================================================
-- Manuales técnicos de activos
-- =============================================================================
-- Cada activo (equipo) puede tener varios manuales técnicos (PDF/Office/imagen).
-- Los archivos viven en el bucket de Storage `asset-manuals`; en la tabla solo
-- guardamos el PATH + metadatos. Gestión (subir/borrar) gated por permisos
-- assets:update / assets:full_access. Lectura para assets:read.
-- Idempotente.

-- -----------------------------------------------------------------------------
-- 1) Tabla
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.asset_manuals (
  id          bigserial PRIMARY KEY,
  asset_id    bigint NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  title       text   NOT NULL,
  file_path   text   NOT NULL,
  file_name   text,
  mime_type   text,
  size_bytes  bigint,
  created_at  timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by  uuid NULL REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_asset_manuals_asset_id
  ON public.asset_manuals (asset_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 2) RLS (lectura para assets:read; escrituras para assets:update/full_access)
-- -----------------------------------------------------------------------------

ALTER TABLE public.asset_manuals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asset_manuals_select ON public.asset_manuals;
DROP POLICY IF EXISTS asset_manuals_insert ON public.asset_manuals;
DROP POLICY IF EXISTS asset_manuals_update ON public.asset_manuals;
DROP POLICY IF EXISTS asset_manuals_delete ON public.asset_manuals;

CREATE POLICY asset_manuals_select
ON public.asset_manuals
FOR SELECT
TO authenticated
USING (
  public.me_has_permission('assets:read')
  OR public.me_has_permission('assets:full_access')
);

CREATE POLICY asset_manuals_insert
ON public.asset_manuals
FOR INSERT
TO authenticated
WITH CHECK (
  (
    public.me_has_permission('assets:update')
    OR public.me_has_permission('assets:full_access')
  )
  AND (created_by IS NULL OR created_by = auth.uid())
);

CREATE POLICY asset_manuals_update
ON public.asset_manuals
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

CREATE POLICY asset_manuals_delete
ON public.asset_manuals
FOR DELETE
TO authenticated
USING (
  public.me_has_permission('assets:update')
  OR public.me_has_permission('assets:full_access')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_manuals TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.asset_manuals_id_seq TO authenticated;

-- -----------------------------------------------------------------------------
-- 3) Storage: bucket `asset-manuals` (público) + policies
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'asset-manuals') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('asset-manuals', 'asset-manuals', true);
  ELSE
    UPDATE storage.buckets
       SET public = true
     WHERE id = 'asset-manuals';
  END IF;
END$$;

DO $$
BEGIN
  -- READ público
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='asset_manuals_read_public'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY asset_manuals_read_public
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'asset-manuals')
    $sql$;
  END IF;

  -- INSERT (subir manual nuevo)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='asset_manuals_insert_assets_update'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY asset_manuals_insert_assets_update
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'asset-manuals'
        AND (
          public.me_has_permission('assets:update')
          OR public.me_has_permission('assets:full_access')
        )
      )
    $sql$;
  END IF;

  -- UPDATE (necesario para upsert:true)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='asset_manuals_update_assets_update'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY asset_manuals_update_assets_update
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'asset-manuals'
        AND (
          public.me_has_permission('assets:update')
          OR public.me_has_permission('assets:full_access')
        )
      )
      WITH CHECK (
        bucket_id = 'asset-manuals'
        AND (
          public.me_has_permission('assets:update')
          OR public.me_has_permission('assets:full_access')
        )
      )
    $sql$;
  END IF;

  -- DELETE (quitar manual)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='asset_manuals_delete_assets_update'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY asset_manuals_delete_assets_update
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'asset-manuals'
        AND (
          public.me_has_permission('assets:update')
          OR public.me_has_permission('assets:full_access')
        )
      )
    $sql$;
  END IF;
END$$;
