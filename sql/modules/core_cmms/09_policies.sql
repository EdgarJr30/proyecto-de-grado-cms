-- DROPS
drop policy if exists users_select_rbac       on public.users;
drop policy if exists users_select_self_profile on public.users;
drop policy if exists users_insert_rbac       on public.users;
drop policy if exists users_update_rbac       on public.users;
drop policy if exists users_update_self_profile on public.users;
drop policy if exists users_delete_rbac       on public.users;
drop policy if exists "rbac roles rw"         on public.roles;
drop policy if exists locations_select_active on public.locations;
drop policy if exists locations_select_full on public.locations;
drop policy if exists locations_insert_rbac on public.locations;
drop policy if exists locations_update_rbac on public.locations;
drop policy if exists locations_disable_rbac on public.locations;
drop policy if exists locations_delete_rbac on public.locations;
drop policy if exists "societies_read" on public.societies;
drop policy if exists "societies_write" on public.societies;
DROP POLICY IF EXISTS announcements_public_read    ON public.announcements;
DROP POLICY IF EXISTS announcements_manage_read    ON public.announcements;
DROP POLICY IF EXISTS announcements_insert         ON public.announcements;
DROP POLICY IF EXISTS announcements_update_full    ON public.announcements;
DROP POLICY IF EXISTS announcements_delete         ON public.announcements;
DROP POLICY IF EXISTS aar_select ON public.announcement_audience_roles;
DROP POLICY IF EXISTS aar_insert ON public.announcement_audience_roles;
DROP POLICY IF EXISTS aar_delete ON public.announcement_audience_roles;
-- warehouses → resource: inventory_warehouses
DROP POLICY IF EXISTS warehouses_select ON public.warehouses;
DROP POLICY IF EXISTS warehouses_insert ON public.warehouses;
DROP POLICY IF EXISTS warehouses_update ON public.warehouses;
DROP POLICY IF EXISTS warehouses_delete ON public.warehouses;

DROP POLICY IF EXISTS uoms_select ON public.uoms;
DROP POLICY IF EXISTS uoms_insert ON public.uoms;
DROP POLICY IF EXISTS uoms_update ON public.uoms;
DROP POLICY IF EXISTS uoms_delete ON public.uoms;
DROP POLICY IF EXISTS report_layout_select_own ON public.report_layout_preferences;
DROP POLICY IF EXISTS report_layout_insert_own ON public.report_layout_preferences;
DROP POLICY IF EXISTS report_layout_update_own ON public.report_layout_preferences;
DROP POLICY IF EXISTS report_layout_delete_own ON public.report_layout_preferences;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='roles' and policyname='roles readable') then
    create policy "roles readable" on public.roles for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='roles' and policyname='rbac roles rw') then
    create policy "rbac roles rw"
    on public.roles for all
    using (public.me_has_permission('rbac:manage_roles'))
    with check (public.me_has_permission('rbac:manage_roles'));
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

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_roles' and policyname='user_roles self read') then
    create policy "user_roles self read" on public.user_roles for select using (user_id = auth.uid());
  end if;
end $$;



create policy users_select_rbac
on public.users for select to authenticated
using ( public.me_has_permission('users:read') or public.me_has_permission('users:full_access') );

create policy users_select_self_profile
on public.users for select to authenticated
using ( id = auth.uid() );

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

-- Helper: ¿el usuario es el técnico asignado (principal/secundario activo o legacy)?
create or replace function public.is_ticket_assigned_technician(p_uid uuid, p_ticket_id bigint)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.assignees a
    where a.user_id = p_uid
      and (
        exists (
          select 1 from public.work_order_assignees wa
          where wa.work_order_id = p_ticket_id
            and wa.assignee_id = a.id
            and wa.is_active = true
        )
        or exists (
          select 1 from public.tickets t
          where t.id = p_ticket_id and t.assignee_id = a.id
        )
      )
  );
$$;

create or replace function public.am_i_ticket_assigned_technician(p_ticket_id bigint)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_ticket_assigned_technician(auth.uid(), p_ticket_id);
$$;

grant execute on function public.is_ticket_assigned_technician(uuid, bigint) to authenticated;
grant execute on function public.am_i_ticket_assigned_technician(bigint) to authenticated;

create policy tickets_select_work_orders
on public.tickets for select to authenticated
using (
  is_accepted=true and (
    public.me_has_permission('work_orders:read')
    or public.me_has_permission('work_orders:full_access')
    or (
      public.me_has_permission('work_orders:read_own')
      and (
        created_by = auth.uid()
        or public.is_ticket_assigned_technician(auth.uid(), id)
      )
    )
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
    or public.is_ticket_assigned_technician(auth.uid(), id)
  )
)
with check (
  is_accepted=true and (
    public.me_has_permission('work_orders:full_access')
    or (public.me_has_permission('work_orders:create') and created_by = auth.uid())
    or public.is_ticket_assigned_technician(auth.uid(), id)
  )
);

create policy tickets_delete_requests
on public.tickets for delete to authenticated
using ( is_accepted=false and public.me_has_permission('work_requests:delete') );

create policy tickets_delete_work_orders
on public.tickets for delete to authenticated
using ( is_accepted=true  and public.me_has_permission('work_orders:delete') );



create policy locations_select_active
on public.locations
for select to authenticated
using (
  is_active = true
  and (
    public.me_has_permission('locations:read')
    or public.me_has_permission('locations:full_access')
  )
);

create policy locations_select_full
on public.locations
for select to authenticated
using (
  public.me_has_permission('locations:full_access')
);

create policy locations_insert_rbac
on public.locations
for insert to authenticated
with check ( public.me_has_permission('locations:full_access') );

create policy locations_update_rbac
on public.locations
for update to authenticated
using ( public.me_has_permission('locations:full_access') )
with check ( public.me_has_permission('locations:full_access') );

create policy locations_disable_rbac
on public.locations
for update to authenticated
using (
  public.me_has_permission('locations:disable')
  or public.me_has_permission('locations:full_access')
)
with check (
  public.me_has_permission('locations:disable')
  or public.me_has_permission('locations:full_access')
);

create policy locations_delete_rbac
on public.locations
for delete to authenticated
using (
  public.me_has_permission('locations:delete')
  or public.me_has_permission('locations:full_access')
);


create policy "societies_read"
on public.societies
for select
using (
  public.me_has_permission('society:read')
  or public.me_has_permission('society:full_access')
);

create policy "societies_write"
on public.societies
for all
using (public.me_has_permission('society:full_access'))
with check (public.me_has_permission('society:full_access'));

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

CREATE POLICY report_layout_select_own
ON public.report_layout_preferences
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY report_layout_insert_own
ON public.report_layout_preferences
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY report_layout_update_own
ON public.report_layout_preferences
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY report_layout_delete_own
ON public.report_layout_preferences
FOR DELETE TO authenticated
USING (user_id = auth.uid());


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


-- 2.1) SELECT: lectura pública (todos ven activos + vigentes + en su audiencia)
CREATE POLICY announcements_public_read
ON public.announcements
FOR SELECT
USING (
  public.is_announcement_publicly_visible(
    is_active,
    starts_at,
    ends_at,
    id,
    audience_all
  )
);

-- 2.2) SELECT: lectura de gestión (ve TODO: borradores, inactivos, futuros, cualquier audiencia)
CREATE POLICY announcements_manage_read
ON public.announcements
FOR SELECT
USING (
  public.me_has_permission('announcements:read')
  OR public.me_has_permission('announcements:full_access')
);

-- 2.3) INSERT: crear anuncios
CREATE POLICY announcements_insert
ON public.announcements
FOR INSERT
WITH CHECK (
  public.me_has_permission('announcements:create')
  OR public.me_has_permission('announcements:full_access')
);

-- 2.4) UPDATE: edición completa
CREATE POLICY announcements_update_full
ON public.announcements
FOR UPDATE
USING (
  public.me_has_permission('announcements:full_access')
)
WITH CHECK (
  public.me_has_permission('announcements:full_access')
);

-- 2.5) DELETE: eliminar
CREATE POLICY announcements_delete
ON public.announcements
FOR DELETE
USING (
  public.me_has_permission('announcements:delete')
  OR public.me_has_permission('announcements:full_access')
);


-- 3.1) SELECT (solo gestión)
CREATE POLICY aar_select
ON public.announcement_audience_roles
FOR SELECT
USING (
  public.me_has_permission('announcements:read')
  OR public.me_has_permission('announcements:full_access')
);

-- 3.2) INSERT (solo gestión total)
CREATE POLICY aar_insert
ON public.announcement_audience_roles
FOR INSERT
WITH CHECK (
  public.me_has_permission('announcements:full_access')
);

-- 3.3) DELETE (solo gestión total)
CREATE POLICY aar_delete
ON public.announcement_audience_roles
FOR DELETE
USING (
  public.me_has_permission('announcements:full_access')
);



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
