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

