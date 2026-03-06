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

