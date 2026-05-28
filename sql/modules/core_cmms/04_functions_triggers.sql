DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('users', 'trg_users_set_updated_at'),
        ('users', 'trg_users_lock_created_by'),
        ('assignees', 'trg_assignees_lock_created_by'),
        ('assignees', 'trg_assignees_set_updated'),
        ('tickets', 'trg_tickets_set_created_by'),
        ('tickets', 'trg_tickets_set_updated_at'),
        ('tickets', 'trg_guard_tickets_cancel'),
        ('tickets', 'trg_guard_accept_requires_assignee'),
        ('tickets', 'trg_sync_ticket_primary_assignee_to_woa'),
        ('assignees', 'trg_assignees_guard_cancel'),
        ('users', 'trg_users_guard_cancel'),
        ('users', 'trg_users_guard_role_change'),
        ('users', 'trg_users_sync_identity'),
        ('tickets', 'trg_set_finalized_at'),
        ('work_order_assignees', 'trg_work_order_assignees_updated'),
        ('work_order_assignees', 'trg_enforce_active_limits'),
        ('special_incidents', 'trg_special_incidents_updated'),
        ('special_incidents', 'trg_special_incidents_created'),
        ('announcements', 'trg_announcements_created'),
        ('announcements', 'trg_announcements_updated'),
        ('warehouses', 'trg_warehouses_created'),
        ('warehouses', 'trg_warehouses_updated'),
        ('uoms', 'trg_uoms_created'),
        ('uoms', 'trg_uoms_updated'),
        ('locations', 'trg_locations_created'),
        ('locations', 'trg_locations_updated'),
        ('warehouse_area_items', 'trg_warehouse_area_items_created'),
        ('warehouse_area_items', 'trg_warehouse_area_items_updated'),
        ('societies', 'trg_societies_updated_at')
    ) AS x(table_name, trigger_name)
  LOOP
    IF to_regclass(format('public.%I', r.table_name)) IS NOT NULL THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON public.%I;',
        r.trigger_name,
        r.table_name
      );
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.toggle_announcement_active(p_id BIGINT, p_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT ( public.me_has_permission('announcements:disable')
        OR public.me_has_permission('announcements:full_access') ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  UPDATE public.announcements
     SET is_active  = p_active,
         updated_at = (now() AT TIME ZONE 'America/Santo_Domingo'),
         updated_by = auth.uid()
   WHERE id = p_id;
END;
$$;

-- 1.1) ¿El usuario actual pertenece a la audiencia de este anuncio?
CREATE OR REPLACE FUNCTION public.current_user_in_announcement_audience(
  p_announcement_id BIGINT,
  p_audience_all    BOOLEAN
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    CASE
      WHEN p_audience_all IS TRUE THEN TRUE
      ELSE EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.announcement_audience_roles ar
          ON ar.role_id = ur.role_id
        WHERE ur.user_id = auth.uid()
          AND ar.announcement_id = p_announcement_id
      )
    END;
$$;

-- 1.2) ¿Es visible públicamente? (activo + ventana de tiempo + audiencia)
CREATE OR REPLACE FUNCTION public.is_announcement_publicly_visible(
  p_is_active       BOOLEAN,
  p_starts_at       TIMESTAMPTZ,
  p_ends_at         TIMESTAMPTZ,
  p_announcement_id BIGINT,
  p_audience_all    BOOLEAN
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    (p_is_active IS TRUE)
    AND (COALESCE(p_starts_at, now()) <= now())
    AND (p_ends_at IS NULL OR now() < p_ends_at)
    AND public.current_user_in_announcement_audience(p_announcement_id, p_audience_all);
$$;



-- 16) Aceptar work order (corrige variables p_* incoherentes)
CREATE OR REPLACE FUNCTION public.accept_work_order(p_work_order_id bigint, p_primary_assignee_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
     SET assignee_id = p_primary_assignee_id,
         is_accepted = true
   WHERE id = p_work_order_id AND COALESCE(is_accepted,false) = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'work_order inexistente o ya aceptado.';
  END IF;
END;
$$;

-- 16.1) Mantiene tickets.assignee_id alineado con work_order_assignees.
-- Esto cubre flujos legacy que aceptan/asignan actualizando directamente tickets.
CREATE OR REPLACE FUNCTION public.sync_ticket_primary_assignee_to_woa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamp := (now() AT TIME ZONE 'America/Santo_Domingo');
BEGIN
  IF NEW.is_accepted IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  IF NOT (
    OLD.assignee_id IS DISTINCT FROM NEW.assignee_id
    OR OLD.is_accepted IS DISTINCT FROM NEW.is_accepted
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(NEW.id);

  IF NEW.assignee_id IS NULL THEN
    UPDATE public.work_order_assignees
       SET is_active = false,
           unassigned_at = COALESCE(unassigned_at, v_now),
           updated_at = v_now,
           updated_by = auth.uid()
     WHERE work_order_id = NEW.id
       AND role = 'PRIMARY'
       AND is_active = true;
    RETURN NEW;
  END IF;

  UPDATE public.work_order_assignees
     SET is_active = false,
         unassigned_at = COALESCE(unassigned_at, v_now),
         updated_at = v_now,
         updated_by = auth.uid()
   WHERE work_order_id = NEW.id
     AND role = 'PRIMARY'
     AND is_active = true
     AND assignee_id <> NEW.assignee_id;

  INSERT INTO public.work_order_assignees(
    work_order_id,
    assignee_id,
    role,
    is_active,
    assigned_at,
    unassigned_at,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.assignee_id,
    'PRIMARY',
    true,
    v_now,
    NULL,
    auth.uid(),
    auth.uid(),
    v_now,
    v_now
  )
  ON CONFLICT (work_order_id, assignee_id) DO UPDATE
     SET role = 'PRIMARY',
         is_active = true,
         assigned_at = CASE
           WHEN public.work_order_assignees.is_active = false THEN v_now
           ELSE public.work_order_assignees.assigned_at
         END,
         unassigned_at = NULL,
         updated_at = v_now,
         updated_by = auth.uid()
   WHERE public.work_order_assignees.role IS DISTINCT FROM 'PRIMARY'
      OR public.work_order_assignees.is_active IS DISTINCT FROM true
      OR public.work_order_assignees.unassigned_at IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ticket_primary_assignee_to_woa ON public.tickets;
CREATE TRIGGER trg_sync_ticket_primary_assignee_to_woa
AFTER UPDATE OF assignee_id, is_accepted ON public.tickets
FOR EACH ROW
WHEN (
  OLD.assignee_id IS DISTINCT FROM NEW.assignee_id
  OR OLD.is_accepted IS DISTINCT FROM NEW.is_accepted
)
EXECUTE FUNCTION public.sync_ticket_primary_assignee_to_woa();

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

-- 10) Helpers de configuración rápida
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
  PERFORM public.set_app_setting('max_secondary_assignees', jsonb_build_object('v', p_value));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_max_secondary_assignees()
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT public.get_app_setting_int('max_secondary_assignees', 2);
$$;


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

  perform public.write_activity_log(
    'rbac.permissions_synced', 'rbac', null, null,
    format('Catálogo de permisos sincronizado (%s definiciones)', jsonb_array_length(perms)),
    jsonb_build_object('count', jsonb_array_length(perms))
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

  perform public.write_activity_log(
    'rbac.role_permissions_changed', 'roles', p_role_id::text,
    (select name from public.roles where id = p_role_id),
    format('Permisos del rol actualizados (%s permisos)', coalesce(array_length(p_perm_codes, 1), 0)),
    jsonb_build_object('role_id', p_role_id, 'codes', to_jsonb(p_perm_codes))
  );
end;
$$;

-- Sincroniza metadata esencial en auth.users
create or replace function public.sync_auth_user_identity(
  p_user_id uuid,
  p_email text default null,
  p_name text default null,
  p_last_name text default null,
  p_location bigint default null
) returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_meta_patch jsonb := '{}'::jsonb;
begin
  if p_name is not null and nullif(trim(p_name), '') is not null then
    v_meta_patch := v_meta_patch || jsonb_build_object('name', trim(p_name));
  end if;

  if p_last_name is not null and nullif(trim(p_last_name), '') is not null then
    v_meta_patch := v_meta_patch || jsonb_build_object('last_name', trim(p_last_name));
  end if;

  if p_location is not null then
    v_meta_patch := v_meta_patch || jsonb_build_object('location_id', p_location);
  else
    v_meta_patch := v_meta_patch || jsonb_build_object('location_id', null);
  end if;

  update auth.users au
     set email = coalesce(v_email, au.email),
         raw_user_meta_data = coalesce(au.raw_user_meta_data, '{}'::jsonb) || v_meta_patch,
         updated_at = now()
   where au.id = p_user_id;
end;
$$;

-- Mantiene requester sincronizado con el nombre vigente de public.users
create or replace function public.sync_user_tickets_requester(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.tickets t
     set requester = trim(concat_ws(' ', u.name, u.last_name))
    from public.users u
   where u.id = p_user_id
     and t.created_by = u.id
     and t.requester is distinct from trim(concat_ws(' ', u.name, u.last_name));
end;
$$;

-- create_user_in_public (opcional desde FE)
create or replace function public.create_user_in_public (
  p_id uuid,
  p_email text,
  p_name text,
  p_last_name text,
  p_location bigint,
  p_rol_id integer default null
) returns void language plpgsql security definer set search_path=public,auth as $$
declare
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_last_name text := nullif(trim(coalesce(p_last_name, '')), '');
begin
  if not public.me_has_permission('users:create') then
    raise exception 'forbidden: users:create required';
  end if;

  if v_email is null or v_name is null or v_last_name is null then
    raise exception 'Nombre, apellido y correo son obligatorios';
  end if;

  insert into public.users(id, email, name, last_name, location_id)
  values (p_id, v_email, v_name, v_last_name, p_location)
  on conflict (id) do update
    set email       = excluded.email,
        name        = excluded.name,
        last_name   = excluded.last_name,
        location_id = excluded.location_id;

  perform public.sync_auth_user_identity(
    p_id,
    v_email,
    v_name,
    v_last_name,
    p_location
  );
  perform public.sync_user_tickets_requester(p_id);

  if p_rol_id is not null then
    if not public.me_has_permission('rbac:manage_roles') then
      raise exception 'forbidden: rbac:manage_roles required to assign roles';
    end if;

    update public.users set rol_id = p_rol_id where id = p_id;

    delete from public.user_roles
    where user_id = p_id
      and role_id <> p_rol_id;

    insert into public.user_roles(user_id, role_id)
    values (p_id, p_rol_id)
    on conflict do nothing;
  end if;
end;
$$;
grant execute on function public.create_user_in_public(uuid, text, text, text, bigint, integer) to authenticated;

-- Actualización administrativa consistente entre public y auth
create or replace function public.admin_update_user_profile(
  p_id uuid,
  p_email text,
  p_name text,
  p_last_name text,
  p_location bigint default null,
  p_rol_id integer default null,
  p_update_role boolean default false
) returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_last_name text := nullif(trim(coalesce(p_last_name, '')), '');
begin
  if not (
    public.me_has_permission('users:update')
    or public.me_has_permission('users:full_access')
  ) then
    raise exception 'forbidden: users:update or users:full_access required';
  end if;

  if v_email is null or v_name is null or v_last_name is null then
    raise exception 'Nombre, apellido y correo son obligatorios';
  end if;

  update public.users
     set email = v_email,
         name = v_name,
         last_name = v_last_name,
         location_id = p_location
   where id = p_id;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;

  if p_update_role then
    if not public.me_has_permission('rbac:manage_roles') then
      raise exception 'forbidden: rbac:manage_roles required to assign roles';
    end if;

    update public.users
       set rol_id = p_rol_id
     where id = p_id;

    delete from public.user_roles
    where user_id = p_id;

    if p_rol_id is not null then
      insert into public.user_roles(user_id, role_id)
      values (p_id, p_rol_id)
      on conflict do nothing;
    end if;
  end if;

  perform public.sync_auth_user_identity(
    p_id,
    v_email,
    v_name,
    v_last_name,
    p_location
  );
  perform public.sync_user_tickets_requester(p_id);
end;
$$;
grant execute on function public.admin_update_user_profile(uuid, text, text, text, bigint, integer, boolean) to authenticated;

-- Reseteo administrativo de contraseña en auth.users
create or replace function public.admin_reset_user_password(
  p_id uuid,
  p_new_password text
) returns void
language plpgsql
security definer
set search_path=public,auth,extensions
as $$
declare
  v_password text := coalesce(p_new_password, '');
begin
  if not (
    public.me_has_permission('users:update')
    or public.me_has_permission('users:full_access')
  ) then
    raise exception 'forbidden: users:update or users:full_access required';
  end if;

  if p_id is null then
    raise exception 'Usuario no válido';
  end if;

  if nullif(trim(v_password), '') is null then
    raise exception 'La contraseña es obligatoria';
  end if;

  if char_length(v_password) < 8 then
    raise exception 'La contraseña debe tener al menos 8 caracteres';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(
           v_password,
           extensions.gen_salt('bf', 10)
         ),
         updated_at = now()
   where id = p_id;

  if not found then
    raise exception 'Usuario no encontrado en auth.users';
  end if;

  -- Al actualizar public.users se dispara trg_users_set_updated_at,
  -- guardando updated_at/updated_by automáticamente.
  update public.users
     set password_reset_at = now(),
         password_reset_by = auth.uid()
   where id = p_id;

  if not found then
    raise exception 'Usuario no encontrado en public.users';
  end if;
end;
$$;
grant execute on function public.admin_reset_user_password(uuid, text) to authenticated;

-- RPC: conteos
create or replace function public.ticket_counts(
  p_location bigint default null,
  p_term     text default null
)
returns table(status text, total bigint)
language sql stable security invoker set search_path=public
as $$
  select t.status, count(*)::bigint as total
  from public.tickets t
  left join public.users u
    on u.id = t.created_by
  where
    (t.status <> 'Pendiente' or t.is_accepted = true)
    and (p_location is null or t.location_id = p_location::bigint)
    and (
      p_term is null
      or t.title ilike '%'||p_term||'%'
      or t.requester ilike '%'||p_term||'%'
      or concat_ws(' ', u.name, u.last_name) ilike '%'||p_term||'%'
      or (p_term ~ '^[0-9]+$' and t.id = p_term::bigint)
    )
  group by t.status
  order by t.status;
$$;
grant execute on function public.ticket_counts(bigint, text) to authenticated;



create or replace function public.set_users_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end$$;
create trigger trg_users_set_updated_at
before update on public.users
for each row execute function public.set_users_updated_at();

create or replace function public.users_sync_identity_after_update()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if tg_op = 'UPDATE' and (
    new.name is distinct from old.name
    or new.last_name is distinct from old.last_name
    or new.email is distinct from old.email
    or new.location_id is distinct from old.location_id
  ) then
    perform public.sync_auth_user_identity(
      new.id,
      new.email,
      new.name,
      new.last_name,
      new.location_id
    );
    perform public.sync_user_tickets_requester(new.id);
  end if;
  return new;
end;
$$;
create trigger trg_users_sync_identity
after update on public.users
for each row execute function public.users_sync_identity_after_update();


-- bloqueo created_by (users y assignees)
create or replace function public.prevent_created_by_update()
returns trigger language plpgsql as $$
begin
  if tg_op='UPDATE' and new.created_by is distinct from old.created_by then
    raise exception 'No está permitido modificar created_by';
  end if;
  return new;
end$$;
create trigger trg_users_lock_created_by
before update on public.users
for each row execute function public.prevent_created_by_update();

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
create trigger trg_tickets_set_created_by
before insert on public.tickets
for each row execute function public.tickets_set_created_by();

create or replace function public.tickets_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;
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
create trigger trg_users_guard_role_change
before update on public.users
for each row execute function public.users_guard_role_change();


-- 1.2) Trigger: setea finalized_at cuando pasa a "Finalizadas"
create or replace function public.set_finalized_at() 
returns trigger
language plpgsql
as $$
begin
  -- Regla de negocio global:
  -- Pendiente/En Ejecución siempre se consideran OT abiertas.
  if lower(trim(coalesce(new.status, ''))) in ('pendiente', 'en ejecución', 'en ejecucion') then
    new.finalized_at := null;
    new.is_archived := false;
  end if;

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

create trigger trg_set_finalized_at
before update on public.tickets
for each row
when (old.status is distinct from new.status)
execute function public.set_finalized_at();


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
CREATE TRIGGER trg_work_order_assignees_updated
  BEFORE UPDATE ON public.work_order_assignees
  FOR EACH ROW EXECUTE FUNCTION public.set_work_order_assignees_updated_fields();


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

CREATE TRIGGER trg_enforce_active_limits
  BEFORE INSERT OR UPDATE ON public.work_order_assignees
  FOR EACH ROW EXECUTE FUNCTION public.enforce_active_assignees_limits();


-- Crear funciones de trazabilidad
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

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
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

-- 0.4) Triggers de trazabilidad (usa tus funciones genéricas)
CREATE TRIGGER trg_announcements_created
BEFORE INSERT ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

CREATE TRIGGER trg_announcements_updated
BEFORE UPDATE ON public.announcements
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();


-- ================================
-- 1. Triggers de trazabilidad
-- ================================

-- WAREHOUSES
CREATE TRIGGER trg_warehouses_created
BEFORE INSERT ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

CREATE TRIGGER trg_warehouses_updated
BEFORE UPDATE ON public.warehouses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();


-- UOMS
CREATE TRIGGER trg_uoms_created
BEFORE INSERT ON public.uoms
FOR EACH ROW
EXECUTE FUNCTION public.set_created_by();

CREATE TRIGGER trg_uoms_updated
BEFORE UPDATE ON public.uoms
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by();

create trigger trg_locations_created
before insert on public.locations
for each row execute function public.set_created_by();

create trigger trg_locations_updated
before update on public.locations
for each row execute function public.set_updated_by();

do $$
begin
  if to_regclass('public.societies') is not null then
    execute $sql$
      create trigger trg_societies_updated_at
      before update on public.societies
      for each row execute function public.set_updated_at()
    $sql$;
  end if;
end $$;
