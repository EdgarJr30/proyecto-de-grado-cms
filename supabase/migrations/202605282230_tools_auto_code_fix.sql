-- Corrige ambientes donde tools se creó antes de tener código automático.
-- Si el cliente omite code o lo manda null/vacío, la BD asigna HT-000001...

CREATE SEQUENCE IF NOT EXISTS public.tool_code_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

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

GRANT USAGE, SELECT ON SEQUENCE public.tool_code_seq TO authenticated;
