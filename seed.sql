-- ============================================================
-- CMMS - Tenant bootstrap (idempotente)
-- Ejecutar en el esquema PUBLIC de Supabase
-- ============================================================

-- =========[ 0) EXTENSIONES ]=========
create extension if not exists pg_trgm;
create extension if not exists unaccent;
create extension if not exists pgcrypto;

-- =========[ 1) ENUMS ]=========
-- location_enum
do $$
begin
  if not exists(select 1 from pg_type where typname='location_enum') then
    create type location_enum as enum (
      'Operadora de Servicios Alimenticios',
      'Adrian Tropical 27',
      'Adrian Tropical Malecón',
      'Adrian Tropical Lincoln',
      'Adrian Tropical San Vicente',
      'Atracciones el Lago',
      'M7',
      'E. Arturo Trading',
      'Edificio Comunitario'
    );
  end if;
end$$;

-- priority_enum (usado en reports y UI)
do $$
begin
  if not exists(select 1 from pg_type where typname='priority_enum') then
    create type priority_enum as enum ('Baja','Media','Alta');
  end if;
end$$;

-- permission_action (catálogo de acciones)
do $$
begin
  if not exists(select 1 from pg_type where typname='permission_action') then
    create type permission_action as enum (
      'create','read','read_own','update','delete',
      'work','import','export','approve','assign','disable',
      'manage_roles','manage_permissions','full_access','cancel'
    );
  else
    -- asegura valores faltantes sin romper si ya existen
    perform 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
      where t.typname='permission_action' and e.enumlabel='full_access';
    if not found then alter type permission_action add value 'full_access'; end if;

    perform 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
      where t.typname='permission_action' and e.enumlabel='cancel';
    if not found then alter type permission_action add value 'cancel'; end if;

    perform 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
      where t.typname='permission_action' and e.enumlabel='delete';
    if not found then alter type permission_action add value 'delete'; end if;
  end if;
end$$;

-- =========[ 2) TABLAS BASE RBAC ]=========
-- roles
create table if not exists public.roles (
  id serial primary key,
  name text not null,
  created_at timestamptz default now(),
  description varchar null,
  is_system boolean not null default false,
  constraint roles_nombre_key unique (name)
);

-- users (perfil público; FK a auth.users se añade al final del archivo)
create table if not exists public.users (
  id uuid primary key,
  rol_id bigint null references public.roles(id),
  name text not null,
  last_name text not null,
  location location_enum not null default 'Operadora de Servicios Alimenticios',
  email text,
  phone text,
  created_at timestamp default now() not null,
  is_active boolean not null default true,
  created_by uuid null default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

-- catálogo de permisos
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  resource text not null,
  action permission_action not null,
  code text not null unique,
  label text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- join rol-permiso
create table if not exists public.role_permissions (
  role_id int not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- join usuario-rol (usa auth.users)
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id int not null references public.roles(id) on delete cascade,
  primary key (user_id, role_id)
);

-- =========[ 3) TABLAS DE NEGOCIO ]=========
-- assignees (técnicos)
do $$
begin
  if not exists (select 1 from pg_type where typname='assignee_section_enum') then
    create type assignee_section_enum as enum ('SIN ASIGNAR','Internos','TERCEROS','OTROS');
  end if;
end$$;

create table if not exists public.assignees (
  id bigserial primary key,
  name text not null,
  last_name text not null,
  section assignee_section_enum not null default 'SIN ASIGNAR',
  user_id uuid references public.users(id),
  email text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.users(id),
  updated_by uuid references public.users(id),
  constraint assignees_name_section_uk unique (name, section)
);

create index if not exists assignees_is_active_idx on public.assignees(is_active);
create index if not exists assignees_section_idx    on public.assignees(section);
create index if not exists assignees_user_id_idx    on public.assignees(user_id);

-- tickets
create table if not exists public.tickets (
  id bigserial primary key,
  title text not null,
  description text not null,
  is_accepted boolean not null default false,
  is_urgent boolean not null,
  priority priority_enum not null,
  requester text not null,
  location location_enum not null,
  assignee text not null, -- legado visible
  incident_date date not null,
  deadline_date date,
  image text not null,
  email text,
  phone text,
  comments text,
  created_at timestamp default now() not null,
  updated_at timestamptz,
  status text default 'Pendiente',
  created_by uuid,
  updated_by uuid,
  assignee_id bigint
);

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

-- índices tickets
create index if not exists idx_tickets_status        on public.tickets(status);
create index if not exists idx_tickets_isaccepted    on public.tickets(is_accepted);
create index if not exists idx_tickets_location      on public.tickets(location);
create index if not exists idx_tickets_created_by    on public.tickets(created_by);
create index if not exists idx_tickets_title_trgm     on public.tickets using gin (title gin_trgm_ops);
create index if not exists idx_tickets_requester_trgm on public.tickets using gin (requester gin_trgm_ops);
create index if not exists idx_tickets_pend_accepted_loc on public.tickets(status, location)
  where status='Pendiente' and is_accepted=true;
create index if not exists idx_tickets_not_pend_loc on public.tickets(status, location)
  where status <> 'Pendiente';

-- =========[ 4) TRIGGERS / AUDITORÍA ]=========
-- users updated_at / updated_by
create or replace function public.set_users_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end$$;
drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row execute function public.set_users_updated_at();

-- bloqueo created_by (users y assignees)
create or replace function public.prevent_created_by_update()
returns trigger language plpgsql as $$
begin
  if tg_op='UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'No está permitido modificar created_by';
  end if;
  return new;
end$$;
drop trigger if exists trg_users_lock_created_by on public.users;
create trigger trg_users_lock_created_by
before update on public.users
for each row execute function public.prevent_created_by_update();

drop trigger if exists trg_assignees_lock_created_by on public.assignees;
create trigger trg_assignees_lock_created_by
before update on public.assignees
for each row execute function public.prevent_created_by_update();

-- assignees updated_at / updated_by
create or replace function public.set_assignees_updated_fields()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end$$;
drop trigger if exists trg_assignees_set_updated on public.assignees;
create trigger trg_assignees_set_updated
before update on public.assignees
for each row execute function public.set_assignees_updated_fields();

-- tickets: set created_by y updated_at
create or replace function public.tickets_set_created_by()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end$$;
drop trigger if exists trg_tickets_set_created_by on public.tickets;
create trigger trg_tickets_set_created_by
before insert on public.tickets
for each row execute function public.tickets_set_created_by();

create or replace function public.tickets_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;
drop trigger if exists trg_tickets_set_updated_at on public.tickets;
create trigger trg_tickets_set_updated_at
before update on public.tickets
for each row execute function public.tickets_set_updated_at();

-- Guardias de negocio
create or replace function public.guard_tickets_cancel()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by no es editable';
  end if;

  if new.status is distinct from old.status then
    if lower(new.status) in ('cancelada','cancelado','canceled','cancelled') then
      if not public.me_has_permission('work_orders:cancel') then
        raise exception 'No autorizado a cancelar (requiere work_orders:cancel)';
      end if;
    end if;
  end if;
  return new;
end$$;
drop trigger if exists trg_guard_tickets_cancel on public.tickets;
create trigger trg_guard_tickets_cancel
before update on public.tickets
for each row execute function public.guard_tickets_cancel();

create or replace function public.guard_accept_requires_assignee()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.is_accepted=false and new.is_accepted=true then
    if not public.me_has_permission('work_requests:full_access') then
      raise exception 'No autorizado a aceptar solicitudes (requiere work_requests:full_access)';
    end if;
    if new.assignee_id is null then
      raise exception 'No se puede aceptar sin responsable (assignee_id).';
    end if;
    if not exists (select 1 from public.assignees a where a.id=new.assignee_id and a.is_active=true) then
      raise exception 'El responsable indicado no existe o está inactivo.';
    end if;
  end if;
  return new;
end$$;
drop trigger if exists trg_guard_accept_requires_assignee on public.tickets;
create trigger trg_guard_accept_requires_assignee
before update on public.tickets
for each row execute function public.guard_accept_requires_assignee();

create or replace function public.assignees_guard_cancel()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and new.is_active is distinct from old.is_active then
    if not public.me_has_permission('assignees:cancel') then
      raise exception 'No autorizado: requiere assignees:cancel';
    end if;
  end if;
  return new;
end$$;
drop trigger if exists trg_assignees_guard_cancel on public.assignees;
create trigger trg_assignees_guard_cancel
before update on public.assignees
for each row execute function public.assignees_guard_cancel();

create or replace function public.users_guard_cancel()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and new.is_active is distinct from old.is_active then
    if not public.me_has_permission('users:cancel') then
      raise exception 'No autorizado: requiere users:cancel';
    end if;
  end if;
  return new;
end$$;
drop trigger if exists trg_users_guard_cancel on public.users;
create trigger trg_users_guard_cancel
before update on public.users
for each row execute function public.users_guard_cancel();

create or replace function public.users_guard_role_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and new.rol_id is distinct from old.rol_id then
    if not public.me_has_permission('rbac:manage_roles') then
      raise exception 'No autorizado: requiere rbac:manage_roles para cambiar rol';
    end if;
  end if;
  return new;
end$$;
drop trigger if exists trg_users_guard_role_change on public.users;
create trigger trg_users_guard_role_change
before update on public.users
for each row execute function public.users_guard_role_change();

-- =========[ 5) FUNCIONES RBAC / RPCs ]=========
create or replace function public.has_permission(u uuid, perm_code text)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    where ur.user_id = u and p.code = perm_code and p.is_active
  );
$$;

create or replace function public.me_has_permission(perm_code text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.has_permission(auth.uid(), perm_code);
$$;

create or replace function public.my_permissions()
returns table(code text) language sql stable security definer set search_path=public as $$
  select distinct p.code
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  where ur.user_id = auth.uid() and p.is_active;
$$;

grant execute on function public.me_has_permission(text) to anon, authenticated;
grant execute on function public.my_permissions() to anon, authenticated;

-- is_admin helper
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    public.me_has_permission('rbac:manage_roles')
    or public.me_has_permission('rbac:manage_permissions')
  , false);
$$;
grant execute on function public.is_admin() to authenticated;

-- sync_permissions (desde FE)
create or replace function public.sync_permissions(perms jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission(auth.uid(), 'rbac:manage_permissions') then
    raise exception 'forbidden';
  end if;

  insert into public.permissions(resource, action, code, label, description, is_active)
  select lower(p->>'resource'),
         (p->>'action')::permission_action,
         lower((p->>'resource')||':'||(p->>'action')),
         coalesce(p->>'label', initcap(p->>'resource')||' '||(p->>'action')),
         p->>'description',
         coalesce((p->>'is_active')::boolean, true)
  from jsonb_array_elements(perms) p
  on conflict (code) do update
    set label = excluded.label,
        description = excluded.description,
        is_active = excluded.is_active;

  update public.permissions set is_active=false
  where code not in (
    select lower((p->>'resource')||':'||(p->>'action'))
    from jsonb_array_elements(perms) p
  );
end;
$$;

-- set_role_permissions
create or replace function public.set_role_permissions(p_role_id integer, p_perm_codes text[])
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.has_permission(auth.uid(), 'rbac:manage_roles') then
    raise exception 'forbidden';
  end if;

  insert into public.role_permissions(role_id, permission_id)
  select p_role_id, id
  from public.permissions
  where code = any(p_perm_codes)
  on conflict do nothing;

  delete from public.role_permissions rp
  where rp.role_id = p_role_id
    and rp.permission_id not in (select id from public.permissions where code = any(p_perm_codes));
end;
$$;

-- create_user_in_public (opcional desde FE)
create or replace function public.create_user_in_public (
  p_id uuid,
  p_email text,
  p_name text,
  p_last_name text,
  p_location location_enum,
  p_rol_id integer default null
) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.me_has_permission('users:create') then
    raise exception 'forbidden: users:create required';
  end if;

  insert into public.users(id, email, name, last_name, location)
  values (p_id, p_email, p_name, p_last_name, p_location)
  on conflict (id) do update
    set email     = excluded.email,
        name      = excluded.name,
        last_name = excluded.last_name,
        location  = excluded.location;

  if p_rol_id is not null then
    if not public.me_has_permission('rbac:manage_roles') then
      raise exception 'forbidden: rbac:manage_roles required to assign roles';
    end if;

    update public.users set rol_id = p_rol_id where id = p_id;

    insert into public.user_roles(user_id, role_id)
    values (p_id, p_rol_id)
    on conflict do nothing;
  end if;
end;
$$;
grant execute on function public.create_user_in_public(uuid, text, text, text, location_enum, integer) to authenticated;

-- RPC: conteos
create or replace function public.ticket_counts(
  p_location text default null,
  p_term     text default null
)
returns table(status text, total bigint)
language sql stable security invoker set search_path=public
as $$
  select t.status, count(*)::bigint as total
  from public.tickets t
  where
    (t.status <> 'Pendiente' or t.is_accepted = true)
    and (p_location is null or t.location = p_location::location_enum)
    and (
      p_term is null
      or t.title ilike '%'||p_term||'%'
      or t.requester ilike '%'||p_term||'%'
      or (p_term ~ '^[0-9]+$' and t.id = p_term::bigint)
    )
  group by t.status
  order by t.status;
$$;
grant execute on function public.ticket_counts(text, text) to authenticated;

-- =========[ 6) RLS ]=========
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='roles' and policyname='roles readable') then
    create policy "roles readable" on public.roles for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='role_permissions' and policyname='rbac role_permissions rw') then
    create policy "rbac role_permissions rw"
    on public.role_permissions for all
    using (public.me_has_permission('rbac:manage_roles'))
    with check (public.me_has_permission('rbac:manage_roles'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_roles' and policyname='rbac user_roles rw') then
    create policy "rbac user_roles rw"
    on public.user_roles for all
    using (public.me_has_permission('rbac:manage_roles'))
    with check (public.me_has_permission('rbac:manage_roles'));
  end if;
end $$;

-- user_roles self read
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_roles' and policyname='user_roles self read') then
    create policy "user_roles self read" on public.user_roles for select using (user_id = auth.uid());
  end if;
end $$;

-- users
alter table public.users enable row level security;

drop policy if exists users_select_rbac       on public.users;
drop policy if exists users_insert_rbac       on public.users;
drop policy if exists users_update_rbac       on public.users;
drop policy if exists users_update_self_profile on public.users;
drop policy if exists users_delete_rbac       on public.users;

create policy users_select_rbac
on public.users for select to authenticated
using ( public.me_has_permission('users:read') or public.me_has_permission('users:full_access') );

create policy users_insert_rbac
on public.users for insert to authenticated
with check ( public.me_has_permission('users:full_access') );

create policy users_update_rbac
on public.users for update to authenticated
using ( public.me_has_permission('users:full_access') )
with check ( public.me_has_permission('users:full_access') );

create policy users_update_self_profile
on public.users for update to authenticated
using ( id = auth.uid() )
with check ( id = auth.uid() );

create policy users_delete_rbac
on public.users for delete to authenticated
using ( public.me_has_permission('users:delete') );

-- assignees
alter table public.assignees enable row level security;
drop policy if exists assignees_select_rbac on public.assignees;
drop policy if exists assignees_insert_rbac on public.assignees;
drop policy if exists assignees_update_rbac on public.assignees;
drop policy if exists assignees_delete_rbac on public.assignees;

create policy assignees_select_rbac
on public.assignees for select to authenticated
using ( public.me_has_permission('assignees:read') or public.me_has_permission('assignees:full_access') );

create policy assignees_insert_rbac
on public.assignees for insert to authenticated
with check ( public.me_has_permission('assignees:full_access') );

create policy assignees_update_rbac
on public.assignees for update to authenticated
using ( public.me_has_permission('assignees:full_access') )
with check ( public.me_has_permission('assignees:full_access') );

create policy assignees_delete_rbac
on public.assignees for delete to authenticated
using ( public.me_has_permission('assignees:delete') );

-- tickets (separando solicitudes vs OT)
alter table public.tickets enable row level security;

drop policy if exists tickets_insert_rbac         on public.tickets;
drop policy if exists tickets_select_requests     on public.tickets;
drop policy if exists tickets_select_work_orders  on public.tickets;
drop policy if exists tickets_update_requests     on public.tickets;
drop policy if exists tickets_update_work_orders  on public.tickets;
drop policy if exists tickets_delete_requests     on public.tickets;
drop policy if exists tickets_delete_work_orders  on public.tickets;

create policy tickets_insert_rbac
on public.tickets for insert to authenticated
with check ( public.me_has_permission('work_orders:create') and created_by = auth.uid() );

create policy tickets_select_requests
on public.tickets for select to authenticated
using (
  is_accepted=false and (
    public.me_has_permission('work_requests:read')
    or public.me_has_permission('work_requests:full_access')
    or created_by = auth.uid()
  )
);

create policy tickets_select_work_orders
on public.tickets for select to authenticated
using (
  is_accepted=true and (
    public.me_has_permission('work_orders:read')
    or public.me_has_permission('work_orders:full_access')
    or (public.me_has_permission('work_orders:read_own') and created_by = auth.uid())
  )
);

create policy tickets_update_requests
on public.tickets for update to authenticated
using (
  is_accepted=false and (
    public.me_has_permission('work_requests:full_access')
    or (public.me_has_permission('work_orders:create') and created_by = auth.uid())
  )
)
with check (
  is_accepted=false and (
    public.me_has_permission('work_requests:full_access')
    or (public.me_has_permission('work_orders:create') and created_by = auth.uid())
  )
);

create policy tickets_update_work_orders
on public.tickets for update to authenticated
using (
  is_accepted=true and (
    public.me_has_permission('work_orders:full_access')
    or (public.me_has_permission('work_orders:create') and created_by = auth.uid())
  )
)
with check (
  is_accepted=true and (
    public.me_has_permission('work_orders:full_access')
    or (public.me_has_permission('work_orders:create') and created_by = auth.uid())
  )
);

create policy tickets_delete_requests
on public.tickets for delete to authenticated
using ( is_accepted=false and public.me_has_permission('work_requests:delete') );

create policy tickets_delete_work_orders
on public.tickets for delete to authenticated
using ( is_accepted=true  and public.me_has_permission('work_orders:delete') );

-- =========[ 7) PERMISOS SEED / ROL ADMIN ]=========
DO $$
DECLARE
  v_admin_role_id int;
BEGIN
  INSERT INTO public.roles(name, description, is_system)
  SELECT 'Administrator','Acceso total', true
  WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name='Administrator');

  SELECT id INTO v_admin_role_id FROM public.roles WHERE name='Administrator' LIMIT 1;

  WITH perms_src(resource, action, code, label, description) AS (
    VALUES
      ('rbac','manage_permissions','rbac:manage_permissions','Sincronizar permisos','Puede sincronizar y administrar permisos'),
      ('rbac','manage_roles','rbac:manage_roles','Gestionar roles','Puede crear/editar roles y asignar permisos'),
      ('work_orders','read','work_orders:read','Ver OT',NULL),
      ('work_orders','read_own','work_orders:read_own','Ver mis OT',NULL),
      ('work_orders','create','work_orders:create','Crear OT',NULL),
      ('work_orders','update','work_orders:update','Editar OT',NULL),
      ('work_orders','delete','work_orders:delete','Eliminar OT',NULL),
      ('work_orders','work','work_orders:work','Trabajar OT',NULL),
      ('work_orders','approve','work_orders:approve','Aprobar/Rechazar OT',NULL),
      ('work_orders','full_access','work_orders:full_access','Acceso total OT',NULL),
      ('work_orders','cancel','work_orders:cancel','Cancelar OT',NULL),
      ('work_requests','read','work_requests:read','Ver solicitudes',NULL),
      ('work_requests','create','work_requests:create','Crear solicitudes',NULL),
      ('work_requests','update','work_requests:update','Editar solicitudes',NULL),
      ('work_requests','delete','work_requests:delete','Eliminar solicitudes',NULL),
      ('work_requests','work','work_requests:work','Trabajar solicitudes',NULL),
      ('work_requests','approve','work_requests:approve','Aprobar/Rechazar solicitudes',NULL),
      ('work_requests','full_access','work_requests:full_access','Acceso total solicitudes',NULL),
      ('work_requests','cancel','work_requests:cancel','Cancelar solicitudes',NULL),
      ('reports','read','reports:read','Ver reportes',NULL),
      ('users','read','users:read','Ver usuarios',NULL),
      ('users','create','users:create','Crear usuarios',NULL),
      ('users','update','users:update','Editar usuarios',NULL),
      ('users','delete','users:delete','Eliminar usuarios',NULL),
      ('users','full_access','users:full_access','Acceso total usuarios',NULL),
      ('users','cancel','users:cancel','Activar/Desactivar usuarios',NULL),
      ('assignees','read','assignees:read','Ver técnicos',NULL),
      ('assignees','create','assignees:create','Crear técnicos',NULL),
      ('assignees','update','assignees:update','Editar técnicos',NULL),
      ('assignees','delete','assignees:delete','Eliminar técnicos',NULL),
      ('assignees','full_access','assignees:full_access','Acceso total técnicos',NULL),
      ('assignees','cancel','assignees:cancel','Activar/Desactivar técnicos',NULL),
      ('home','read','home:read','Dashboard/Home',NULL)
  )
  INSERT INTO public.permissions(id, resource, action, code, label, description, is_active, created_at)
  SELECT gen_random_uuid(), s.resource, s.action::permission_action, s.code, s.label, s.description, TRUE, NOW()
  FROM perms_src s
  ON CONFLICT (code) DO UPDATE SET
    resource=EXCLUDED.resource, action=EXCLUDED.action, label=EXCLUDED.label,
    description=EXCLUDED.description, is_active=TRUE;

  INSERT INTO public.role_permissions(role_id, permission_id)
  SELECT v_admin_role_id, p.id FROM public.permissions p
  ON CONFLICT DO NOTHING;
END$$;

-- =========[ 8) PLACEHOLDERS Y LIMPIEZA DE LEGADO ]=========
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.assignees
    WHERE name='SIN ASIGNAR' AND section='SIN ASIGNAR'
  ) THEN
    INSERT INTO public.assignees(name, last_name, section, is_active)
    VALUES ('SIN ASIGNAR', '', 'SIN ASIGNAR', true);
  END IF;
END$$;

update public.tickets t
set assignee_id = a.id
from public.assignees a
where t.assignee_id is null
  and nullif(trim(t.assignee),'') is not null
  and upper(trim(t.assignee)) = upper(trim(a.name||' '||a.last_name));

-- =========[ 9) REALTIME + STORAGE ]=========
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

-- =========[ 10-bis) GRANTS PARA SERVICIO DE AUTH ]=========
-- En algunos proyectos nuevos, el rol interno de GoTrue puede no tener todo
-- lo necesario para "queryear el schema". Estos GRANTs son seguros.
do $$
begin
  -- schema
  execute 'grant usage on schema auth to supabase_auth_admin, supabase_authenticator';
  -- tablas existentes
  execute 'grant select, insert, update, delete on all tables in schema auth to supabase_auth_admin';
  execute 'grant select on all tables in schema auth to supabase_authenticator';
  -- secuencias (por si las usa)
  execute 'grant usage, select, update on all sequences in schema auth to supabase_auth_admin';
  -- default privileges futuros
  execute 'alter default privileges in schema auth grant select, insert, update, delete on tables to supabase_auth_admin';
  execute 'alter default privileges in schema auth grant select on tables to supabase_authenticator';
exception when others then
  -- En supabase cloud casi siempre funciona; si no, continuamos sin romper la semilla.
  raise notice 'No se pudieron aplicar todos los GRANTs de auth: %', sqlerrm;
end$$;



-- (opcional pero útil) Permisos generales de esquema
grant usage on schema public  to anon, authenticated;
grant usage on schema storage to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- =========[ LISTO ]=========
-- Fin de semilla



-- TODO: Actualizar semilla
-- 1.1) Nueva columna para archivo y fecha de finalización
alter table public.tickets
  add column if not exists is_archived boolean not null default false,
  add column if not exists finalized_at timestamp null;

-- 1.2) Trigger: setea finalized_at cuando pasa a "Finalizadas"
create or replace function public.set_finalized_at() 
returns trigger
language plpgsql
as $$
begin
  -- si pasa a Finalizadas y no tenía timestamp, lo marcamos
  if new.status = 'Finalizadas' and (old.status is distinct from new.status) then
    if new.finalized_at is null then
      new.finalized_at := now();
    end if;
  end if;

  -- si sale de Finalizadas, limpiamos finalized_at y forzamos unarchived
  if old.status = 'Finalizadas' and new.status <> 'Finalizadas' then
    new.finalized_at := null;
    new.is_archived := false;
  end if;

  return new;
end
$$;

drop trigger if exists trg_set_finalized_at on public.tickets;
create trigger trg_set_finalized_at
before update on public.tickets
for each row
when (old.status is distinct from new.status)
execute function public.set_finalized_at();

-- 1.3) JOB nocturno para archivar automáticamente a los 14 días
-- Requiere pg_cron (disponible en Supabase). Si no está:
create extension if not exists pg_cron;

-- Corre todos los días a las 03:00 AM GMT (ajusta si quieres)
select
  cron.schedule(
    'archive_finalized_tickets',
    '0 3 * * *',
    $sql$
      update public.tickets
         set is_archived = true
       where is_archived = false
         and status = 'Finalizadas'
         and coalesce(finalized_at, created_at) < now() - interval '14 days';
    $sql$
  );

-- 1.4) Índices que ayudan a tus listas y conteos
create index if not exists ix_tickets_status_archived_created
  on public.tickets (status, is_archived, created_at desc);

create index if not exists ix_tickets_accepted_archived_status_loc_assignee_created
  on public.tickets (is_accepted, is_archived, status, location, assignee_id, created_at desc);

ALTER TABLE public.users
  ALTER COLUMN created_at
  SET DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo');


  SELECT
  id,
  created_at AS old_created_at,
  (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo' AS fixed_created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 50;

UPDATE public.users
SET created_at = (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo';

-- =========================================================
-- MLM – Work Order Assignees (PRIMARY/SECONDARY) Full Setup
-- Ejecuta TODO este bloque una sola vez en tu BD.
-- Idempotente: usa IF NOT EXISTS / DROP IF EXISTS donde aplica.
-- =========================================================

-- 1) Tipo ENUM para rol de asignación
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignee_role_enum') THEN
    CREATE TYPE assignee_role_enum AS ENUM ('PRIMARY', 'SECONDARY');
  END IF;
END$$;

-- 2) Tabla base
CREATE TABLE IF NOT EXISTS public.work_order_assignees (
  work_order_id     bigint NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  assignee_id       bigint NOT NULL REFERENCES public.assignees(id),
  role              assignee_role_enum NOT NULL,
  is_active         boolean NOT NULL DEFAULT true,
  assigned_at       timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  unassigned_at     timestamp,

  created_at        timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at        timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by        uuid DEFAULT auth.uid() REFERENCES public.users(id),
  updated_by        uuid REFERENCES public.users(id)
);

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS i_work_order_assignees_work_order
  ON public.work_order_assignees(work_order_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS i_work_order_assignees_assignee
  ON public.work_order_assignees(assignee_id) WHERE is_active;

CREATE INDEX IF NOT EXISTS i_work_order_assignees_role
  ON public.work_order_assignees(role) WHERE is_active;

-- 3) Función de mantenimiento de updated_* y unassigned_at
CREATE OR REPLACE FUNCTION public.set_work_order_assignees_updated_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();

  IF (TG_OP = 'UPDATE' AND NEW.is_active = false AND OLD.is_active = true AND NEW.unassigned_at IS NULL) THEN
    NEW.unassigned_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE UPDATE
DROP TRIGGER IF EXISTS trg_work_order_assignees_updated ON public.work_order_assignees;
CREATE TRIGGER trg_work_order_assignees_updated
  BEFORE UPDATE ON public.work_order_assignees
  FOR EACH ROW EXECUTE FUNCTION public.set_work_order_assignees_updated_fields();

-- 4) Vista de activos
CREATE OR REPLACE VIEW public.v_work_order_assignees_current AS
SELECT *
FROM public.work_order_assignees
WHERE is_active = true;

-- 5) Vista agregada por OT (PRIMARY + array de SECONDARY)
CREATE OR REPLACE VIEW public.v_work_order_assignees_agg AS
SELECT
  t.id AS work_order_id,
  (
    SELECT wa.assignee_id
    FROM public.work_order_assignees wa
    WHERE wa.work_order_id = t.id AND wa.is_active AND wa.role = 'PRIMARY'
    LIMIT 1
  ) AS primary_assignee_id,
  (
    SELECT array_agg(wa.assignee_id ORDER BY wa.assignee_id)
    FROM public.work_order_assignees wa
    WHERE wa.work_order_id = t.id AND wa.is_active AND wa.role = 'SECONDARY'
  ) AS secondary_assignee_ids
FROM public.tickets t;

-- 6) Compatibilidad: tickets + agregados + effective_assignee_id
CREATE OR REPLACE VIEW public.v_tickets_compat AS
SELECT
  t.*,
  a.primary_assignee_id,
  a.secondary_assignee_ids,
  COALESCE(a.primary_assignee_id, t.assignee_id) AS effective_assignee_id
FROM public.tickets t
LEFT JOIN public.v_work_order_assignees_agg a
  ON a.work_order_id = t.id;

-- 7) RLS y Policies
ALTER TABLE public.work_order_assignees ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='work_order_assignees' AND policyname='read_work_order_assignees') THEN
    EXECUTE 'DROP POLICY "read_work_order_assignees" ON public.work_order_assignees';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='work_order_assignees' AND policyname='write_work_order_assignees') THEN
    EXECUTE 'DROP POLICY "write_work_order_assignees" ON public.work_order_assignees';
  END IF;
END$$;

CREATE POLICY "read_work_order_assignees"
ON public.work_order_assignees
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tickets tk WHERE tk.id = work_order_id AND tk.created_by = auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.work_order_assignees me
    JOIN public.assignees a ON a.id = me.assignee_id
    WHERE me.work_order_id = work_order_id AND me.is_active AND a.user_id = auth.uid()
  )
  OR public.me_has_permission('work_orders:read')
);

CREATE POLICY "write_work_order_assignees"
ON public.work_order_assignees
FOR ALL TO authenticated
USING ( public.me_has_permission('work_orders:full_access') )
WITH CHECK ( public.me_has_permission('work_orders:full_access') );

-- 8) app_settings + helpers
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_by  uuid REFERENCES public.users(id)
);

CREATE OR REPLACE FUNCTION public.set_app_setting(p_key text, p_value jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.app_settings(key, value, updated_by)
  VALUES (p_key, p_value, auth.uid())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = now(),
        updated_by = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_app_setting_int(p_key text, p_default int)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT COALESCE((value->>'v')::int, p_default)
  FROM public.app_settings
  WHERE key = p_key
  LIMIT 1
$$;

-- Semilla: max 2 secundarios
SELECT public.set_app_setting('max_secondary_assignees', '{"v": 2}'::jsonb);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='read_app_settings') THEN
    EXECUTE 'DROP POLICY "read_app_settings" ON public.app_settings';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' AND policyname='write_app_settings') THEN
    EXECUTE 'DROP POLICY "write_app_settings" ON public.app_settings';
  END IF;
END$$;

CREATE POLICY "read_app_settings"
ON public.app_settings
FOR SELECT TO authenticated
USING ( public.me_has_permission('rbac:manage_permissions') OR public.is_admin() );

CREATE POLICY "write_app_settings"
ON public.app_settings
FOR ALL TO authenticated
USING ( public.me_has_permission('rbac:manage_permissions') OR public.is_admin() )
WITH CHECK ( public.me_has_permission('rbac:manage_permissions') OR public.is_admin() );

-- 9) Límite de activos (trigger)
CREATE OR REPLACE FUNCTION public.enforce_active_assignees_limits()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  max_secondary int := public.get_app_setting_int('max_secondary_assignees', 2);
  sec_count int;
  total_active int;
  becoming_active boolean;
  role_changed boolean;
BEGIN
  -- ¿La fila entra al conjunto activo?
  becoming_active :=
    (TG_OP = 'INSERT' AND NEW.is_active)
    OR (TG_OP = 'UPDATE' AND NEW.is_active AND (OLD.is_active IS DISTINCT FROM NEW.is_active));

  -- ¿Cambia el rol?
  role_changed := (TG_OP = 'UPDATE' AND (OLD.role IS DISTINCT FROM NEW.role));

  -- 1) Límite de secundarios activos
  IF (NEW.role = 'SECONDARY') AND (becoming_active OR (TG_OP='UPDATE' AND NEW.is_active AND role_changed)) THEN
    SELECT COUNT(*) INTO sec_count
    FROM public.work_order_assignees
    WHERE work_order_id = NEW.work_order_id
      AND is_active = true
      AND role = 'SECONDARY';

    IF sec_count >= max_secondary THEN
      RAISE EXCEPTION 'Máximo % técnicos secundarios activos por work_order.', max_secondary;
    END IF;
  END IF;

  -- 2) Límite total activos: 1 PRIMARY + max_secondary
  IF becoming_active OR (TG_OP = 'UPDATE' AND NEW.is_active AND role_changed) THEN
    SELECT COUNT(*) INTO total_active
    FROM public.work_order_assignees
    WHERE work_order_id = NEW.work_order_id
      AND is_active = true;

    IF total_active >= (1 + max_secondary) THEN
      RAISE EXCEPTION 'No puedes superar % técnicos activos (1 principal + % secundarios).',
        1 + max_secondary, max_secondary;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_active_limits ON public.work_order_assignees;
CREATE TRIGGER trg_enforce_active_limits
  BEFORE INSERT OR UPDATE ON public.work_order_assignees
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_assignees_limits();

-- 10) Helpers de configuración rápida
CREATE OR REPLACE FUNCTION public.set_max_secondary_assignees(p_value int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_value < 0 THEN
    RAISE EXCEPTION 'El límite no puede ser negativo.';
  END IF;
  PERFORM public.set_app_setting('max_secondary_assignees', jsonb_build_object('v', p_value));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_max_secondary_assignees()
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT public.get_app_setting_int('max_secondary_assignees', 2);
$$;

-- 11) Migración inicial: llevar assignee_id de tickets como PRIMARY activo (solo si no existe ya)
INSERT INTO public.work_order_assignees(work_order_id, assignee_id, role, is_active)
SELECT id, assignee_id, 'PRIMARY'::assignee_role_enum, true
FROM public.tickets
WHERE assignee_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.work_order_assignees wa
    WHERE wa.work_order_id = tickets.id
      AND wa.assignee_id   = tickets.assignee_id
  );

-- 12) Unicidad base (sin filtro)
DROP INDEX IF EXISTS ux_work_order_assignees_unique;
CREATE UNIQUE INDEX IF NOT EXISTS ux_work_order_assignees_unique
  ON public.work_order_assignees(work_order_id, assignee_id);

-- 13) Un principal activo por OT (índice único parcial)
DROP INDEX IF EXISTS ux_one_primary_per_work_order;
CREATE UNIQUE INDEX IF NOT EXISTS ux_one_primary_per_work_order
  ON public.work_order_assignees(work_order_id)
  WHERE role = 'PRIMARY' AND is_active = true;

-- 14) Un secundario ACTIVO por persona/OT (parcial)
DROP INDEX IF EXISTS ux_woa_one_active_secondary_per_person;
CREATE UNIQUE INDEX IF NOT EXISTS ux_woa_one_active_secondary_per_person
  ON public.work_order_assignees (work_order_id, assignee_id)
  WHERE role = 'SECONDARY' AND is_active = true;

-- 15) Desactivar duplicados de secundarios dejando el más antiguo activo
UPDATE public.work_order_assignees w
   SET is_active     = false,
       unassigned_at = now(),
       updated_at    = now(),
       updated_by    = auth.uid()
 WHERE w.role = 'SECONDARY'
   AND w.is_active = true
   AND EXISTS (
     SELECT 1
     FROM public.work_order_assignees w2
     WHERE w2.work_order_id = w.work_order_id
       AND w2.assignee_id   = w.assignee_id
       AND w2.role          = w.role
       AND w2.is_active     = true
       AND (
            w2.assigned_at < w.assigned_at
         OR (w2.assigned_at = w.assigned_at AND w2.created_at < w.created_at)
       )
   );

-- 16) Aceptar work order (corrige variables p_* incoherentes)
CREATE OR REPLACE FUNCTION public.accept_work_order(p_work_order_id bigint, p_primary_assignee_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_creator uuid;
BEGIN
  IF p_primary_assignee_id IS NULL THEN
    RAISE EXCEPTION 'Debes indicar el responsable principal para aceptar.';
  END IF;

  -- Permiso: full_access o creador del ticket
  SELECT created_by INTO v_creator FROM public.tickets WHERE id = p_work_order_id;
  IF NOT (public.me_has_permission('work_orders:full_access') OR v_creator = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden: necesitas permiso para aceptar o ser el creador del work_order';
  END IF;

  -- Upsert del PRIMARY activo
  INSERT INTO public.work_order_assignees(work_order_id, assignee_id, role, is_active)
  VALUES (p_work_order_id, p_primary_assignee_id, 'PRIMARY', true)
  ON CONFLICT (work_order_id, assignee_id) DO UPDATE
     SET role='PRIMARY', is_active=true, unassigned_at=NULL;

  -- Marca aceptación en tickets
  UPDATE public.tickets
     SET is_accepted = true
   WHERE id = p_work_order_id AND COALESCE(is_accepted,false) = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'work_order inexistente o ya aceptado.';
  END IF;
END;
$$;

-- 17) set_secondary_assignees (versión final con lock y validaciones)
CREATE OR REPLACE FUNCTION public.set_secondary_assignees(
  p_work_order_id bigint,
  p_secondary_ids bigint[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamptz := (now() at time zone 'America/Santo_Domingo');
  max_secondary int := public.get_app_setting_int('max_secondary_assignees', 2);
  v_ids bigint[];
  v_primary bigint;
  v_id bigint;
BEGIN
  -- Normaliza array
  v_ids := COALESCE(p_secondary_ids, ARRAY[]::bigint[]);

  -- Chequea límite por parámetro
  IF array_length(v_ids, 1) IS NOT NULL AND array_length(v_ids, 1) > max_secondary THEN
    RAISE EXCEPTION 'Máximo % técnicos secundarios activos por work_order.', max_secondary;
  END IF;

  -- Lock por OT para evitar race conditions
  PERFORM pg_advisory_xact_lock(p_work_order_id);

  -- No permitir que el PRIMARY esté también como SECONDARY
  SELECT assignee_id INTO v_primary
    FROM public.work_order_assignees
   WHERE work_order_id = p_work_order_id AND role = 'PRIMARY' AND is_active = true
   LIMIT 1;

  IF v_primary IS NOT NULL AND v_primary = ANY(v_ids) THEN
    RAISE EXCEPTION 'El responsable principal no puede ser secundario a la vez (assignee_id=%).', v_primary;
  END IF;

  -- Desactivar los que ya no están
  UPDATE public.work_order_assignees
     SET is_active     = false,
         unassigned_at = v_now,
         updated_at    = v_now,
         updated_by    = auth.uid()
   WHERE work_order_id = p_work_order_id
     AND role = 'SECONDARY'
     AND is_active = true
     AND assignee_id <> ALL (v_ids);

  -- Insertar/Reactivar los que sí están
  FOREACH v_id IN ARRAY v_ids LOOP
    UPDATE public.work_order_assignees
       SET is_active    = true,
           assigned_at  = COALESCE(assigned_at, v_now),
           unassigned_at= NULL,
           updated_at   = v_now,
           updated_by   = auth.uid()
     WHERE work_order_id = p_work_order_id
       AND role = 'SECONDARY'
       AND assignee_id   = v_id;

    IF NOT FOUND THEN
      INSERT INTO public.work_order_assignees
        (work_order_id, assignee_id, role, is_active, assigned_at, created_by, updated_by, created_at, updated_at)
      VALUES
        (p_work_order_id, v_id, 'SECONDARY', true, v_now, auth.uid(), auth.uid(), v_now, v_now);
    END IF;
  END LOOP;

  -- Chequeo final contra el límite
  IF (SELECT COUNT(*) FROM public.work_order_assignees
        WHERE work_order_id = p_work_order_id AND role = 'SECONDARY' AND is_active = true) > max_secondary THEN
    RAISE EXCEPTION 'Máximo % técnicos secundarios activos por work_order.', max_secondary;
  END IF;
END;
$$;

-- 18) Re-crear vistas (por si algo cambió)
CREATE OR REPLACE VIEW public.v_work_order_assignees_agg AS
SELECT
  t.id AS work_order_id,
  (
    SELECT wa.assignee_id
    FROM public.work_order_assignees wa
    WHERE wa.work_order_id = t.id AND wa.is_active AND wa.role = 'PRIMARY'
    LIMIT 1
  ) AS primary_assignee_id,
  (
    SELECT array_agg(wa.assignee_id ORDER BY wa.assignee_id)
    FROM public.work_order_assignees wa
    WHERE wa.work_order_id = t.id AND wa.is_active AND wa.role = 'SECONDARY'
  ) AS secondary_assignee_ids
FROM public.tickets t;

CREATE OR REPLACE VIEW public.v_tickets_compat AS
SELECT
  t.*,
  a.primary_assignee_id,
  a.secondary_assignee_ids,
  COALESCE(a.primary_assignee_id, t.assignee_id) AS effective_assignee_id
FROM public.tickets t
LEFT JOIN public.v_work_order_assignees_agg a
  ON a.work_order_id = t.id;


-- 1️⃣ Crear tabla con campos de trazabilidad
CREATE TABLE public.special_incidents (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,               -- Ej: “Huracán”, “Tormenta eléctrica”
  code TEXT UNIQUE NOT NULL,               -- Ej: “huracan”, “tormenta_electrica”
  description TEXT,                        -- Texto opcional que explica el tipo
  is_active BOOLEAN DEFAULT TRUE,          -- Para activar/desactivar en la UI
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo') NOT NULL,
  updated_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo') NOT NULL,
  created_by UUID REFERENCES public.users(id) NOT NULL,
  updated_by UUID REFERENCES public.users(id)
);

CREATE OR REPLACE FUNCTION public.set_updated_by()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := (now() AT TIME ZONE 'America/Santo_Domingo');
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_special_incidents_updated
BEFORE UPDATE ON public.special_incidents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

CREATE TRIGGER trg_special_incidents_created
BEFORE INSERT ON public.special_incidents
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS special_incident_id INTEGER;

-- 2) Llave foránea con políticas recomendadas
--    - ON UPDATE CASCADE: si cambia el id (raro), se propaga
--    - ON DELETE SET NULL: si borran la incidencia, el ticket no se rompe
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

ALTER TABLE public.special_incidents ENABLE ROW LEVEL SECURITY;

-- SELECT (lectura para combos en la UI): solo activas
CREATE POLICY special_incidents_select_active
ON public.special_incidents
FOR SELECT
TO authenticated
USING (
  is_active = TRUE
  AND (
    me_has_permission('special_incidents:read'::text)
    OR me_has_permission('special_incidents:full_access'::text)
  )
);

-- SELECT (admin/gestor: ver TODAS, activas e inactivas)
CREATE POLICY special_incidents_select_full
ON public.special_incidents
FOR SELECT
TO authenticated
USING (
  me_has_permission('special_incidents:full_access'::text)
);

-- INSERT (crear)
CREATE POLICY special_incidents_insert_rbac
ON public.special_incidents
FOR INSERT
TO authenticated
WITH CHECK (
  me_has_permission('special_incidents:full_access'::text)
);

-- UPDATE (editar general)
CREATE POLICY special_incidents_update_rbac
ON public.special_incidents
FOR UPDATE
TO authenticated
USING (
  me_has_permission('special_incidents:full_access'::text)
)
WITH CHECK (
  me_has_permission('special_incidents:full_access'::text)
);

-- UPDATE (solo activar/desactivar) — opcional, si quieres delegar el toggle
-- Nota: sin trigger extra, este permiso permitiría editar cualquier columna.
-- Si deseas que SOLO cambie is_active, añade el trigger de control (abajo).
CREATE POLICY special_incidents_disable_rbac
ON public.special_incidents
FOR UPDATE
TO authenticated
USING (
  me_has_permission('special_incidents:disable'::text)
)
WITH CHECK (
  me_has_permission('special_incidents:disable'::text)
);

-- DELETE
CREATE POLICY special_incidents_delete_rbac
ON public.special_incidents
FOR DELETE
TO authenticated
USING (
  me_has_permission('special_incidents:delete'::text)
  OR me_has_permission('special_incidents:full_access'::text)
);

CREATE OR REPLACE VIEW public.v_tickets_compat (
  id,
  title,
  description,
  is_urgent,
  priority,
  requester,
  location,
  assignee,
  incident_date,
  deadline_date,
  image,
  email,
  phone,
  comments,
  created_at,
  status,
  is_accepted,
  created_by,
  assignee_id,
  updated_at,
  is_archived,
  finalized_at,
  primary_assignee_id,
  secondary_assignee_ids,
  effective_assignee_id,
  updated_by,
  created_by_name,
  updated_by_name,
  primary_assignee_name,
  secondary_assignees_names,
  special_incident_id,
  special_incident_name,
  special_incident_code
) AS
SELECT
  t.id,
  t.title,
  t.description,
  t.is_urgent,
  t.priority,
  t.requester,
  t.location,
  t.assignee,
  t.incident_date,
  t.deadline_date,
  t.image,
  t.email,
  t.phone,
  t.comments,
  t.created_at,
  t.status,
  t.is_accepted,
  t.created_by,
  t.assignee_id,
  t.updated_at,
  t.is_archived,
  t.finalized_at,
  a.primary_assignee_id,
  COALESCE(a.secondary_assignee_ids, ARRAY[]::bigint[]) AS secondary_assignee_ids,
  COALESCE(a.primary_assignee_id, t.assignee_id) AS effective_assignee_id,

  t.updated_by,
  concat_ws(' ', u_created.name, u_created.last_name) AS created_by_name,
  concat_ws(' ', u_updated.name, u_updated.last_name) AS updated_by_name,
  concat_ws(' ', ap.name, ap.last_name)               AS primary_assignee_name,

  (
    SELECT STRING_AGG(concat_ws(' ', asg.name, asg.last_name), ', ')
    FROM public.work_order_assignees wa
    JOIN public.assignees asg ON asg.id = wa.assignee_id
    WHERE wa.work_order_id = t.id
      AND wa.is_active = TRUE
      AND wa.role = 'SECONDARY'::assignee_role_enum
  ) AS secondary_assignees_names,

  t.special_incident_id,
  si.name AS special_incident_name,
  si.code AS special_incident_code
FROM public.tickets t
LEFT JOIN public.v_work_order_assignees_agg a
  ON a.work_order_id = t.id
LEFT JOIN public.users u_created
  ON u_created.id = t.created_by
LEFT JOIN public.users u_updated
  ON u_updated.id = t.updated_by
LEFT JOIN public.assignees ap
  ON ap.id = a.primary_assignee_id
LEFT JOIN public.special_incidents si
  ON si.id = t.special_incident_id;

  BEGIN;

-- ===========================================
-- TABLAS BASE
-- ===========================================

DROP TABLE IF EXISTS public.inventory_adjustments CASCADE;
DROP TABLE IF EXISTS public.inventory_count_operations CASCADE;
DROP TABLE IF EXISTS public.inventory_count_lines CASCADE;
DROP TABLE IF EXISTS public.inventory_counts CASCADE;
DROP TABLE IF EXISTS public.baskets CASCADE;
DROP TABLE IF EXISTS public.item_uoms CASCADE;
DROP TABLE IF EXISTS public.uom_conversion_templates CASCADE;
DROP TABLE IF EXISTS public.warehouse_items CASCADE;
DROP TABLE IF EXISTS public.warehouse_areas CASCADE;
DROP TABLE IF EXISTS public.warehouse_area_items CASCADE;
DROP TABLE IF EXISTS public.items CASCADE;
DROP TABLE IF EXISTS public.uoms CASCADE;
DROP TABLE IF EXISTS public.warehouses CASCADE;

-- WAREHOUSES
CREATE TABLE public.warehouses (
  id          bigint generated always as identity primary key,
  code        text not null unique,
  name        text not null,
  is_active   boolean not null default true,

  -- Auditoría
  created_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id)
);

-- UOMS
CREATE TABLE public.uoms (
  id          bigint generated always as identity primary key,
  code        text not null unique,     -- "LB", "KG", "UND", etc.
  name        text not null,            -- "Libras", "Kilogramos", etc.
  is_active   boolean not null default true,

  -- Auditoría
  created_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id)
);

-- ITEMS (CON UNIDAD DE MEDIDA BASE)
CREATE TABLE public.items (
  id            bigint generated always as identity primary key,
  sku           text not null unique,        -- código de artículo
  name          text not null,
  is_weightable boolean not null default false,      -- suele pesarse

  -- UoM base del ítem (ej: ML, GRAMO, UND, etc.)
  -- Todas las conversiones en item_uoms se expresan respecto a esta UoM base.
  base_uom_id   bigint not null references public.uoms(id),

  -- otros campos: categoría, marca, etc.
  is_active     boolean not null default true,

  -- Auditoría
  created_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id)
);

-- STOCK POR ALMACÉN
CREATE TABLE public.warehouse_items (
  id            bigint generated always as identity primary key,
  warehouse_id  bigint not null references public.warehouses(id),
  item_id       bigint not null references public.items(id),
  uom_id        bigint not null references public.uoms(id),

  -- Cantidad en la UoM de este registro (uom_id)
  quantity      numeric(18,4) not null default 0,

  -- Cantidad en UoM base del ítem (items.base_uom_id)
  base_quantity numeric(18,4),

  is_active     boolean not null default true,

  -- Evita duplicados del mismo item en la misma UoM y almacén
  unique (warehouse_id, item_id, uom_id),

  -- Auditoría
  created_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id)
);

-- AREAS FÍSICAS DENTRO DE UN ALMACÉN
CREATE TABLE public.warehouse_areas (
  id           bigint generated always as identity primary key,
  warehouse_id bigint not null references public.warehouses(id) ON DELETE CASCADE,
  code         text not null,      -- CF-01, CF-VEG, QUIM, etc.
  name         text not null,      -- "Cuarto Frío 1", "Cuarto Frío Vegetales"
  is_active    boolean not null default true,

  UNIQUE (warehouse_id, code),

  -- Auditoría
  created_at   timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at   timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by   uuid REFERENCES public.users(id),
  updated_by   uuid REFERENCES public.users(id)
);

-- ASIGNACIÓN DE ÍTEMS A ÁREAS FÍSICAS (DENTRO DE UN ALMACÉN)
CREATE TABLE public.warehouse_area_items (
  id        bigint generated always as identity primary key,
  area_id   bigint not null references public.warehouse_areas(id) ON DELETE CASCADE,
  item_id   bigint not null references public.items(id),
  is_active boolean not null default true,

  UNIQUE (area_id, item_id),

  -- Auditoría
  created_at   timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at   timestamptz NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by   uuid REFERENCES public.users(id),
  updated_by   uuid REFERENCES public.users(id)
);

-- RELACIÓN ITEM ↔ UOMS (CONVERSIONES ENTRE UOMS)
CREATE TABLE public.item_uoms (
  id                bigint generated always as identity primary key,
  item_id           bigint not null references public.items(id) on delete cascade,
  uom_id            bigint not null references public.uoms(id),

  -- Regla: conversion_factor = cuántas unidades de la UoM base del ítem
  -- (items.base_uom_id) hay en 1 unidad de esta UoM.
  -- Ej: base = ML; UoM = "ENV. 50 LT." → conversion_factor = 50000.
  conversion_factor numeric(18,6) not null,

  is_active         boolean not null default true,

  unique (item_id, uom_id),

  CONSTRAINT item_uoms_factor_chk
    CHECK (conversion_factor > 0),

  -- Auditoría
  created_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id)
);

-- Tabla de factor de conversion
CREATE TABLE public.uom_conversion_templates (
  base_uom_code   text NOT NULL,
  uom_code        text NOT NULL,
  factor          numeric(18,6) NOT NULL,
  PRIMARY KEY (base_uom_code, uom_code)
);

-- CANASTOS
CREATE TABLE public.baskets (
  id          bigint generated always as identity primary key,
  name        text not null,              -- "Canasto verde"
  color       text not null,              -- "verde", "rojo"
  weight      numeric(18,4) not null,     -- peso del canasto
  uom_id      bigint not null references public.uoms(id),  -- unidad del peso (ej: LB)
  is_active   boolean not null default true,

  -- Auditoría
  created_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id)
);

-- CABECERA DE CONTEO
CREATE TABLE public.inventory_counts (
  id            bigint generated always as identity primary key,
  warehouse_id  bigint not null REFERENCES public.warehouses(id),
  area_id       bigint REFERENCES public.warehouse_areas(id),
  name          text not null,               -- "Conteo Nov-2025 Almacén Central"
  description   text,
  status        text not null default 'open',  -- open | closed | cancelled
  planned_at    timestamptz,
  started_at    timestamptz,
  closed_at     timestamptz,
  closed_by     uuid references public.users(id),

  -- Auditoría
  created_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id),

  CONSTRAINT inventory_counts_status_chk
    CHECK (status IN ('open', 'closed', 'cancelled'))
);

-- LÍNEAS DE CONTEO
CREATE TABLE public.inventory_count_lines (
  id                 bigint generated always as identity primary key,
  inventory_count_id bigint not null references public.inventory_counts(id) on delete cascade,
  item_id            bigint not null references public.items(id),
  uom_id             bigint not null references public.uoms(id),  -- UoM final del conteo

  -- cantidad física contada (en uom_id)
  counted_qty        numeric(18,4),

  -- cantidad contada en UoM base del ítem (items.base_uom_id)
  base_counted_qty   numeric(18,4),

  last_counted_at    timestamptz,

  -- Nuevo: estado final de este artículo en este conteo
  status             text not null default 'counted', -- 'counted' | 'pending' | 'ignored'
  status_comment     text,                            -- explicación/resumen final
  pending_reason_code text,

  -- unique (inventory_count_id, item_id, uom_id),

  -- Auditoría
  created_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id),

  -- Validación del estado
  CONSTRAINT inventory_count_lines_status_chk
    CHECK (status IN ('counted', 'pending', 'ignored')),

  -- Validación del código de motivo
  CONSTRAINT inventory_count_lines_reason_chk
    CHECK (
      pending_reason_code IS NULL
      OR pending_reason_code IN ('UOM_DIFFERENT', 'REVIEW')
    )
);

-- OPERACIONES DE CONTEO (DISPAROS)
CREATE TABLE public.inventory_count_operations (
  id                 bigint generated always as identity primary key,
  client_op_id       uuid not null,              -- generado en el móvil
  inventory_count_id bigint not null references public.inventory_counts(id),
  item_id            bigint not null references public.items(id),
  uom_id             bigint not null references public.uoms(id),  -- UoM en la que se contó

  user_id            uuid references public.users(id),       -- quién contó
  device_id          text,                                   -- identificador del dispositivo

  -- Lógica de pesado
  is_weighted        boolean not null default false,       -- usuario marcó "es pesado"
  basket_id          bigint references public.baskets(id),        -- canasto usado (si aplica)
  gross_qty          numeric(18,4),  -- lectura bruta de la balanza (producto + canasto)
  base_gross_qty          numeric(18,4),
  net_qty            numeric(18,4),  -- cantidad neta después de restar el canasto (si aplica)

  -- Cantidad neta expresada en UoM base del ítem
  base_net_qty       numeric(18,4),

  -- Estado de la operación
  is_pending         boolean not null default false,       -- caso raro (uom inexistente, etc.)
  pending_comment    text,                                 -- descripción del problema
  pending_reason_code text, 

  unique (client_op_id),

  -- Auditoría
  created_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id),

   -- Validación del motivo
  CONSTRAINT inventory_count_ops_reason_chk
    CHECK (
      pending_reason_code IS NULL
      OR pending_reason_code IN ('UOM_DIFFERENT', 'REVIEW')
    )
);

-- AJUSTES
CREATE TABLE public.inventory_adjustments (
  id                  bigint generated always as identity primary key,
  inventory_count_id  bigint not null references public.inventory_counts(id),
  item_id             bigint not null references public.items(id),
  uom_id              bigint not null references public.uoms(id),

  -- cuánto se va a ajustar (en uom_id)
  difference_qty      numeric(18,4) not null,

  -- cuánto se va a ajustar en UoM base del ítem
  base_difference_qty numeric(18,4),

  adjustment_reason   text,                    -- "Toma física Nov 2025"

  posted_to_erp       boolean not null default false,
  posted_at           timestamptz,
  erp_document_ref    text,                    -- número de ajuste en el ERP

  -- Auditoría
  created_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id)
);

-- ================================
-- 1. Triggers de trazabilidad
-- ================================

-- ITEMS
DROP TRIGGER IF EXISTS trg_items_created ON public.items;
CREATE TRIGGER trg_items_created
BEFORE INSERT ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_items_updated ON public.items;
CREATE TRIGGER trg_items_updated
BEFORE UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

-- WAREHOUSES
DROP TRIGGER IF EXISTS trg_warehouses_created ON public.warehouses;
CREATE TRIGGER trg_warehouses_created
BEFORE INSERT ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_warehouses_updated ON public.warehouses;
CREATE TRIGGER trg_warehouses_updated
BEFORE UPDATE ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

-- WAREHOUSE_ITEMS
DROP TRIGGER IF EXISTS trg_warehouse_items_created ON public.warehouse_items;
CREATE TRIGGER trg_warehouse_items_created
BEFORE INSERT ON public.warehouse_items
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_warehouse_items_updated ON public.warehouse_items;
CREATE TRIGGER trg_warehouse_items_updated
BEFORE UPDATE ON public.warehouse_items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

-- WAREHOUSE_AREAS
DROP TRIGGER IF EXISTS trg_warehouse_areas_created ON public.warehouse_areas;
CREATE TRIGGER trg_warehouse_areas_created
BEFORE INSERT ON public.warehouse_areas
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_warehouse_areas_updated ON public.warehouse_areas;
CREATE TRIGGER trg_warehouse_areas_updated
BEFORE UPDATE ON public.warehouse_areas
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

-- WAREHOUSE_AREA_ITEMS
DROP TRIGGER IF EXISTS trg_warehouse_area_items_created ON public.warehouse_area_items;
CREATE TRIGGER trg_warehouse_area_items_created
BEFORE INSERT ON public.warehouse_area_items
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_warehouse_area_items_updated ON public.warehouse_area_items;
CREATE TRIGGER trg_warehouse_area_items_updated
BEFORE UPDATE ON public.warehouse_area_items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

-- UOMS
DROP TRIGGER IF EXISTS trg_uoms_created ON public.uoms;
CREATE TRIGGER trg_uoms_created
BEFORE INSERT ON public.uoms
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_uoms_updated ON public.uoms;
CREATE TRIGGER trg_uoms_updated
BEFORE UPDATE ON public.uoms
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

-- ITEM_UOMS
DROP TRIGGER IF EXISTS trg_item_uoms_created ON public.item_uoms;
CREATE TRIGGER trg_item_uoms_created
BEFORE INSERT ON public.item_uoms
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_item_uoms_updated ON public.item_uoms;
CREATE TRIGGER trg_item_uoms_updated
BEFORE UPDATE ON public.item_uoms
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

-- BASKETS
DROP TRIGGER IF EXISTS trg_baskets_created ON public.baskets;
CREATE TRIGGER trg_baskets_created
BEFORE INSERT ON public.baskets
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_baskets_updated ON public.baskets;
CREATE TRIGGER trg_baskets_updated
BEFORE UPDATE ON public.baskets
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

-- INVENTORY_COUNTS
DROP TRIGGER IF EXISTS trg_inventory_counts_created ON public.inventory_counts;
CREATE TRIGGER trg_inventory_counts_created
BEFORE INSERT ON public.inventory_counts
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_inventory_counts_updated ON public.inventory_counts;
CREATE TRIGGER trg_inventory_counts_updated
BEFORE UPDATE ON public.inventory_counts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

-- INVENTORY_COUNT_LINES
DROP TRIGGER IF EXISTS trg_inventory_count_lines_created ON public.inventory_count_lines;
CREATE TRIGGER trg_inventory_count_lines_created
BEFORE INSERT ON public.inventory_count_lines
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_inventory_count_lines_updated ON public.inventory_count_lines;
CREATE TRIGGER trg_inventory_count_lines_updated
BEFORE UPDATE ON public.inventory_count_lines
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

-- INVENTORY_COUNT_OPERATIONS
DROP TRIGGER IF EXISTS trg_inventory_count_operations_created ON public.inventory_count_operations;
CREATE TRIGGER trg_inventory_count_operations_created
BEFORE INSERT ON public.inventory_count_operations
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_inventory_count_operations_updated ON public.inventory_count_operations;
CREATE TRIGGER trg_inventory_count_operations_updated
BEFORE UPDATE ON public.inventory_count_operations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

-- INVENTORY_ADJUSTMENTS
DROP TRIGGER IF EXISTS trg_inventory_adjustments_created ON public.inventory_adjustments;
CREATE TRIGGER trg_inventory_adjustments_created
BEFORE INSERT ON public.inventory_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

DROP TRIGGER IF EXISTS trg_inventory_adjustments_updated ON public.inventory_adjustments;
CREATE TRIGGER trg_inventory_adjustments_updated
BEFORE UPDATE ON public.inventory_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

-- ================================
-- 2. Habilitar Row Level Security
-- ================================
ALTER TABLE public.items                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_items            ENABLE ROW LEVEL SECURITY;
--ALTER TABLE public.warehouse_areas            ENABLE ROW LEVEL SECURITY;
--ALTER TABLE public.warehouse_area_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uoms                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_uoms                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baskets                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_counts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments      ENABLE ROW LEVEL SECURITY;

-- ================================
-- 2.x POLICIES (IGUALES A TU SCRIPT ORIGINAL)
-- ================================

-- items → resource: inventory_items
DROP POLICY IF EXISTS items_select ON public.items;
DROP POLICY IF EXISTS items_insert ON public.items;
DROP POLICY IF EXISTS items_update ON public.items;
DROP POLICY IF EXISTS items_delete ON public.items;

CREATE POLICY items_select
ON public.items
FOR SELECT
USING (
  public.me_has_permission('inventory_items:read')
  OR public.me_has_permission('inventory_items:full_access')
);

CREATE POLICY items_insert
ON public.items
FOR INSERT
WITH CHECK (
  public.me_has_permission('inventory_items:create')
  OR public.me_has_permission('inventory_items:full_access')
);

CREATE POLICY items_update
ON public.items
FOR UPDATE
USING (
  public.me_has_permission('inventory_items:update')
  OR public.me_has_permission('inventory_items:full_access')
)
WITH CHECK (
  public.me_has_permission('inventory_items:update')
  OR public.me_has_permission('inventory_items:full_access')
);

CREATE POLICY items_delete
ON public.items
FOR DELETE
USING (
  public.me_has_permission('inventory_items:delete')
  OR public.me_has_permission('inventory_items:full_access')
);

-- warehouses → resource: inventory_warehouses
DROP POLICY IF EXISTS warehouses_select ON public.warehouses;
DROP POLICY IF EXISTS warehouses_insert ON public.warehouses;
DROP POLICY IF EXISTS warehouses_update ON public.warehouses;
DROP POLICY IF EXISTS warehouses_delete ON public.warehouses;

CREATE POLICY warehouses_select
ON public.warehouses
FOR SELECT
USING (
  public.me_has_permission('inventory_warehouses:read')
  OR public.me_has_permission('inventory_warehouses:full_access')
);

CREATE POLICY warehouses_insert
ON public.warehouses
FOR INSERT
WITH CHECK (
  public.me_has_permission('inventory_warehouses:create')
  OR public.me_has_permission('inventory_warehouses:full_access')
);

CREATE POLICY warehouses_update
ON public.warehouses
FOR UPDATE
USING (
  public.me_has_permission('inventory_warehouses:update')
  OR public.me_has_permission('inventory_warehouses:full_access')
)
WITH CHECK (
  public.me_has_permission('inventory_warehouses:update')
  OR public.me_has_permission('inventory_warehouses:full_access')
);

CREATE POLICY warehouses_delete
ON public.warehouses
FOR DELETE
USING (
  public.me_has_permission('inventory_warehouses:delete')
  OR public.me_has_permission('inventory_warehouses:full_access')
);

-- uoms → resource: inventory_uoms
DROP POLICY IF EXISTS uoms_select ON public.uoms;
DROP POLICY IF EXISTS uoms_insert ON public.uoms;
DROP POLICY IF EXISTS uoms_update ON public.uoms;
DROP POLICY IF EXISTS uoms_delete ON public.uoms;

CREATE POLICY uoms_select
ON public.uoms
FOR SELECT
USING (
  public.me_has_permission('inventory_uoms:read')
  OR public.me_has_permission('inventory_uoms:full_access')
);

CREATE POLICY uoms_insert
ON public.uoms
FOR INSERT
WITH CHECK (
  public.me_has_permission('inventory_uoms:create')
  OR public.me_has_permission('inventory_uoms:full_access')
);

CREATE POLICY uoms_update
ON public.uoms
FOR UPDATE
USING (
  public.me_has_permission('inventory_uoms:update')
  OR public.me_has_permission('inventory_uoms:full_access')
)
WITH CHECK (
  public.me_has_permission('inventory_uoms:update')
  OR public.me_has_permission('inventory_uoms:full_access')
);

CREATE POLICY uoms_delete
ON public.uoms
FOR DELETE
USING (
  public.me_has_permission('inventory_uoms:delete')
  OR public.me_has_permission('inventory_uoms:full_access')
);

-- item_uoms → ligado a permisos de inventory_items
DROP POLICY IF EXISTS item_uoms_select ON public.item_uoms;
DROP POLICY IF EXISTS item_uoms_insert ON public.item_uoms;
DROP POLICY IF EXISTS item_uoms_update ON public.item_uoms;
DROP POLICY IF EXISTS item_uoms_delete ON public.item_uoms;

CREATE POLICY item_uoms_select
ON public.item_uoms
FOR SELECT
USING (
  public.me_has_permission('inventory_items:read')
  OR public.me_has_permission('inventory_items:full_access')
);

CREATE POLICY item_uoms_insert
ON public.item_uoms
FOR INSERT
WITH CHECK (
  public.me_has_permission('inventory_items:full_access')
);

CREATE POLICY item_uoms_update
ON public.item_uoms
FOR UPDATE
USING (
  public.me_has_permission('inventory_items:full_access')
)
WITH CHECK (
  public.me_has_permission('inventory_items:full_access')
);

CREATE POLICY item_uoms_delete
ON public.item_uoms
FOR DELETE
USING (
  public.me_has_permission('inventory_items:full_access')
);

-- baskets → resource: inventory_baskets
DROP POLICY IF EXISTS baskets_select ON public.baskets;
DROP POLICY IF EXISTS baskets_insert ON public.baskets;
DROP POLICY IF EXISTS baskets_update ON public.baskets;
DROP POLICY IF EXISTS baskets_delete ON public.baskets;

CREATE POLICY baskets_select
ON public.baskets
FOR SELECT
USING (
  public.me_has_permission('inventory_baskets:read')
  OR public.me_has_permission('inventory_baskets:full_access')
);

CREATE POLICY baskets_insert
ON public.baskets
FOR INSERT
WITH CHECK (
  public.me_has_permission('inventory_baskets:create')
  OR public.me_has_permission('inventory_baskets:full_access')
);

CREATE POLICY baskets_update
ON public.baskets
FOR UPDATE
USING (
  public.me_has_permission('inventory_baskets:update')
  OR public.me_has_permission('inventory_baskets:full_access')
)
WITH CHECK (
  public.me_has_permission('inventory_baskets:update')
  OR public.me_has_permission('inventory_baskets:full_access')
);

CREATE POLICY baskets_delete
ON public.baskets
FOR DELETE
USING (
  public.me_has_permission('inventory_baskets:delete')
  OR public.me_has_permission('inventory_baskets:full_access')
);

-- inventory_counts → resource: inventory_counts
DROP POLICY IF EXISTS inv_counts_select ON public.inventory_counts;
DROP POLICY IF EXISTS inv_counts_insert ON public.inventory_counts;
DROP POLICY IF EXISTS inv_counts_update ON public.inventory_counts;
DROP POLICY IF EXISTS inv_counts_delete ON public.inventory_counts;

CREATE POLICY inv_counts_select
ON public.inventory_counts
FOR SELECT
USING (
  public.me_has_permission('inventory_counts:read')
  OR public.me_has_permission('inventory_counts:full_access')
);

CREATE POLICY inv_counts_insert
ON public.inventory_counts
FOR INSERT
WITH CHECK (
  public.me_has_permission('inventory_counts:create')
  OR public.me_has_permission('inventory_counts:full_access')
);

CREATE POLICY inv_counts_update
ON public.inventory_counts
FOR UPDATE
USING (
  public.me_has_permission('inventory_counts:update')
  OR public.me_has_permission('inventory_counts:cancel')
  OR public.me_has_permission('inventory_counts:full_access')
)
WITH CHECK (
  public.me_has_permission('inventory_counts:update')
  OR public.me_has_permission('inventory_counts:cancel')
  OR public.me_has_permission('inventory_counts:full_access')
);

CREATE POLICY inv_counts_delete
ON public.inventory_counts
FOR DELETE
USING (
  public.me_has_permission('inventory_counts:delete')
  OR public.me_has_permission('inventory_counts:full_access')
);

-- inventory_count_lines → uso permisos de inventory_counts
DROP POLICY IF EXISTS inv_count_lines_select ON public.inventory_count_lines;
DROP POLICY IF EXISTS inv_count_lines_insert ON public.inventory_count_lines;
DROP POLICY IF EXISTS inv_count_lines_update ON public.inventory_count_lines;
DROP POLICY IF EXISTS inv_count_lines_delete ON public.inventory_count_lines;

CREATE POLICY inv_count_lines_select
ON public.inventory_count_lines
FOR SELECT
USING (
  public.me_has_permission('inventory_counts:read')
  OR public.me_has_permission('inventory_counts:full_access')
);

CREATE POLICY inv_count_lines_insert
ON public.inventory_count_lines
FOR INSERT
WITH CHECK (
  public.me_has_permission('inventory_counts:full_access')
);

CREATE POLICY inv_count_lines_update
ON public.inventory_count_lines
FOR UPDATE
USING (
  public.me_has_permission('inventory_counts:full_access')
)
WITH CHECK (
  public.me_has_permission('inventory_counts:full_access')
);

CREATE POLICY inv_count_lines_delete
ON public.inventory_count_lines
FOR DELETE
USING (
  public.me_has_permission('inventory_counts:full_access')
);

-- inventory_count_operations → resource: inventory_operations
DROP POLICY IF EXISTS inv_ops_select ON public.inventory_count_operations;
DROP POLICY IF EXISTS inv_ops_insert ON public.inventory_count_operations;
DROP POLICY IF EXISTS inv_ops_update ON public.inventory_count_operations;
DROP POLICY IF EXISTS inv_ops_delete ON public.inventory_count_operations;

CREATE POLICY inv_ops_select
ON public.inventory_count_operations
FOR SELECT
USING (
  public.me_has_permission('inventory_operations:read')
  OR public.me_has_permission('inventory_operations:full_access')
);

CREATE POLICY inv_ops_insert
ON public.inventory_count_operations
FOR INSERT
WITH CHECK (
  public.me_has_permission('inventory_operations:work')
  OR public.me_has_permission('inventory_operations:full_access')
);

CREATE POLICY inv_ops_update
ON public.inventory_count_operations
FOR UPDATE
USING (
  public.me_has_permission('inventory_operations:full_access')
)
WITH CHECK (
  public.me_has_permission('inventory_operations:full_access')
);

CREATE POLICY inv_ops_delete
ON public.inventory_count_operations
FOR DELETE
USING (
  public.me_has_permission('inventory_operations:delete')
  OR public.me_has_permission('inventory_operations:full_access')
);

-- inventory_adjustments → resource: inventory_adjustments
DROP POLICY IF EXISTS inv_adj_select ON public.inventory_adjustments;
DROP POLICY IF EXISTS inv_adj_insert ON public.inventory_adjustments;
DROP POLICY IF EXISTS inv_adj_update ON public.inventory_adjustments;
DROP POLICY IF EXISTS inv_adj_delete ON public.inventory_adjustments;

CREATE POLICY inv_adj_select
ON public.inventory_adjustments
FOR SELECT
USING (
  public.me_has_permission('inventory_adjustments:read')
  OR public.me_has_permission('inventory_adjustments:export')
  OR public.me_has_permission('inventory_adjustments:approve')
  OR public.me_has_permission('inventory_adjustments:full_access')
);

CREATE POLICY inv_adj_insert
ON public.inventory_adjustments
FOR INSERT
WITH CHECK (
  public.me_has_permission('inventory_adjustments:create')
  OR public.me_has_permission('inventory_adjustments:full_access')
);

CREATE POLICY inv_adj_update
ON public.inventory_adjustments
FOR UPDATE
USING (
  public.me_has_permission('inventory_adjustments:approve')
  OR public.me_has_permission('inventory_adjustments:full_access')
)
WITH CHECK (
  public.me_has_permission('inventory_adjustments:approve')
  OR public.me_has_permission('inventory_adjustments:full_access')
);

CREATE POLICY inv_adj_delete
ON public.inventory_adjustments
FOR DELETE
USING (
  public.me_has_permission('inventory_adjustments:full_access')
);

-- warehouse_items → stock por almacén
DROP POLICY IF EXISTS warehouse_items_select ON public.warehouse_items;
DROP POLICY IF EXISTS warehouse_items_insert ON public.warehouse_items;
DROP POLICY IF EXISTS warehouse_items_update ON public.warehouse_items;
DROP POLICY IF EXISTS warehouse_items_delete ON public.warehouse_items;

CREATE POLICY warehouse_items_select
ON public.warehouse_items
FOR SELECT
USING (
  public.me_has_permission('inventory_warehouses:read')
  OR public.me_has_permission('inventory_warehouses:full_access')
  OR public.me_has_permission('inventory_items:read')
  OR public.me_has_permission('inventory_items:full_access')
  OR public.me_has_permission('inventory_adjustments:read')
  OR public.me_has_permission('inventory_adjustments:full_access')
);

CREATE POLICY warehouse_items_insert
ON public.warehouse_items
FOR INSERT
WITH CHECK (
  public.me_has_permission('inventory_warehouses:full_access')
  OR public.me_has_permission('inventory_adjustments:full_access')
);

CREATE POLICY warehouse_items_update
ON public.warehouse_items
FOR UPDATE
USING (
  public.me_has_permission('inventory_warehouses:full_access')
  OR public.me_has_permission('inventory_adjustments:full_access')
)
WITH CHECK (
  public.me_has_permission('inventory_warehouses:full_access')
  OR public.me_has_permission('inventory_adjustments:full_access')
);

CREATE POLICY warehouse_items_delete
ON public.warehouse_items
FOR DELETE
USING (
  public.me_has_permission('inventory_warehouses:full_access')
  OR public.me_has_permission('inventory_adjustments:full_access')
);

-- ===========================================
-- TABLAS VIEWS
-- ===========================================
DROP VIEW IF EXISTS public.vw_warehouse_stock CASCADE;

CREATE OR REPLACE VIEW public.vw_warehouse_stock AS
SELECT
  wi.id              AS warehouse_item_id,
  wi.quantity        AS quantity,
  wi.base_quantity   AS base_quantity,
  wi.is_active       AS is_active,

  -- Almacén
  w.id               AS warehouse_id,
  w.code             AS warehouse_code,
  w.name             AS warehouse_name,

  -- Artículo
  i.id               AS item_id,
  i.sku              AS item_sku,
  i.name             AS item_name,
  i.is_weightable    AS item_is_weightable,
  i.base_uom_id      AS item_base_uom_id,
  bu.code            AS base_uom_code,
  bu.name            AS base_uom_name,

  -- UoM del ítem en este almacén (stock)
  u.id               AS uom_id,
  u.code             AS uom_code,
  u.name             AS uom_name,

  -- Auditoría (heredada del registro de stock)
  wi.created_at,
  wi.updated_at,
  wi.created_by,
  wi.updated_by
FROM public.warehouse_items wi
JOIN public.warehouses w ON w.id = wi.warehouse_id
JOIN public.items      i ON i.id = wi.item_id
JOIN public.uoms       u ON u.id = wi.uom_id
LEFT JOIN public.uoms  bu ON bu.id = i.base_uom_id;

GRANT SELECT ON public.vw_warehouse_stock TO anon, authenticated;

COMMIT;