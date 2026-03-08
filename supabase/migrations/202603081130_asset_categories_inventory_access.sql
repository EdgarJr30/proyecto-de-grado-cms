drop policy if exists asset_categories_select_full on public.asset_categories;
create policy asset_categories_select_full
on public.asset_categories
for select
to authenticated
using (
  public.me_has_permission('assets:full_access')
  or public.me_has_permission('inventory:full_access')
);

drop policy if exists asset_categories_insert_rbac on public.asset_categories;
create policy asset_categories_insert_rbac
on public.asset_categories
for insert
to authenticated
with check (
  (
    public.me_has_permission('assets:full_access')
    or public.me_has_permission('inventory:full_access')
  )
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists asset_categories_update_rbac on public.asset_categories;
create policy asset_categories_update_rbac
on public.asset_categories
for update
to authenticated
using (
  public.me_has_permission('assets:full_access')
  or public.me_has_permission('inventory:full_access')
)
with check (
  public.me_has_permission('assets:full_access')
  or public.me_has_permission('inventory:full_access')
);

drop policy if exists asset_categories_delete_rbac on public.asset_categories;
create policy asset_categories_delete_rbac
on public.asset_categories
for delete
to authenticated
using (
  public.me_has_permission('assets:full_access')
  or public.me_has_permission('inventory:full_access')
);
