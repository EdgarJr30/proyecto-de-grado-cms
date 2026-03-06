-- =========[ 1) ENUMS ]=========
-- priority_enum (usado en reports y UI)
do $$
begin
  if not exists(select 1 from pg_type where typname='priority_enum') then
    create type priority_enum as enum ('Baja','Media','Alta');
  end if;
end$$;

-- assignees (técnicos)
do $$
begin
  if not exists (select 1 from pg_type where typname='assignee_section_enum') then
    create type assignee_section_enum as enum ('SIN ASIGNAR','Internos','TERCEROS','OTROS');
  end if;
end$$;

-- 1) Tipo ENUM para rol de asignación
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignee_role_enum') THEN
    CREATE TYPE assignee_role_enum AS ENUM ('PRIMARY', 'SECONDARY');
  END IF;
END$$;