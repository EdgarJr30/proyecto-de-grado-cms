-- =========[ 10) FK ENTRE AUTH.USERS Y PUBLIC.USERS ]=========
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema='public' and table_name='users' and constraint_name='users_id_fkey'
  ) then
    alter table public.users
      add constraint users_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end$$;

-- FK creador (si existe users)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='tickets' and constraint_name='tickets_created_by_fkey'
  ) then
    alter table public.tickets
      add constraint tickets_created_by_fkey
      foreign key (created_by) references public.users(id);
  end if;
end$$;

-- 2) Crear FK (si no existe) hacia public.users(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema='public'
      AND table_name='tickets'
      AND constraint_name='tickets_updated_by_fkey'
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_updated_by_fkey
      FOREIGN KEY (updated_by) REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- FK de auditoría de reseteo de contraseña
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema='public'
      AND table_name='users'
      AND constraint_name='users_password_reset_by_fkey'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_password_reset_by_fkey
      FOREIGN KEY (password_reset_by) REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- FK assignee_id (NOT VALID + validate)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema='public' and table_name='tickets' and constraint_name='tickets_assignee_id_fkey'
  ) then
    alter table public.tickets
      add constraint tickets_assignee_id_fkey
      foreign key (assignee_id) references public.assignees(id)
      on delete set null
      not valid;
    alter table public.tickets validate constraint tickets_assignee_id_fkey;
  end if;
end$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'tickets_special_incident_id_fkey'
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_special_incident_id_fkey
      FOREIGN KEY (special_incident_id)
      REFERENCES public.special_incidents(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END$$;
