-- =========[ REALTIME + STORAGE ]=========
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tickets'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets';
  END IF;
END$$;

ALTER TABLE public.tickets REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'attachments') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('attachments', 'attachments', true);
  END IF;
END$$;