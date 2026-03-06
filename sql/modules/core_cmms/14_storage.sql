-- =========[ STORAGE / BRANDING (idempotente) ]=========
DO $$
BEGIN
  -- Bucket branding (public)
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'branding') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('branding', 'branding', true);
  ELSE
    UPDATE storage.buckets
       SET public = true
     WHERE id = 'branding';
  END IF;
END$$;

DO $$
BEGIN
  -- READ público
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='branding_read_public'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY branding_read_public
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'branding')
    $sql$;
  END IF;

  -- INSERT (para subir archivo nuevo)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='branding_insert_full_access'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY branding_insert_full_access
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'branding'
        AND public.me_has_permission('society:full_access')
      )
    $sql$;
  END IF;

  -- UPDATE (necesario si usas upsert:true)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='branding_update_full_access'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY branding_update_full_access
      ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = 'branding'
        AND public.me_has_permission('society:full_access')
      )
      WITH CHECK (
        bucket_id = 'branding'
        AND public.me_has_permission('society:full_access')
      )
    $sql$;
  END IF;

  -- DELETE (opcional)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='branding_delete_full_access'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY branding_delete_full_access
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'branding'
        AND public.me_has_permission('society:full_access')
      )
    $sql$;
  END IF;
END$$;

-- Policies en storage.objects (requiere owner)
DO $$
BEGIN
  -- READ público
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='attachments_read_public'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY attachments_read_public
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'attachments')
    $sql$;
  END IF;

  -- INSERT (subir archivo nuevo)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='attachments_insert_work_orders_create'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY attachments_insert_work_orders_create
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'attachments'
        AND public.me_has_permission('work_orders:create')
      )
    $sql$;
  END IF;

  -- UPDATE (si usas upsert:true o sobreescritura)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='attachments_update_work_orders_create'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY attachments_update_work_orders_create
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'attachments'
        AND public.me_has_permission('work_orders:create')
      )
      WITH CHECK (
        bucket_id = 'attachments'
        AND public.me_has_permission('work_orders:create')
      )
    $sql$;
  END IF;

  -- DELETE (opcional)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='attachments_delete_work_orders_create'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY attachments_delete_work_orders_create
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'attachments'
        AND public.me_has_permission('work_orders:create')
      )
    $sql$;
  END IF;
END$$;
-- =========[ STORAGE / ATTACHMENTS (idempotente) ]=========
DO $$
BEGIN
  -- Bucket attachments (public)
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'attachments') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('attachments', 'attachments', true);
  ELSE
    UPDATE storage.buckets
       SET public = true
     WHERE id = 'attachments';
  END IF;
END$$;
