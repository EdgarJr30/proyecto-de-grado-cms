grant usage on schema public  to anon, authenticated;
grant usage on schema storage to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.societies_public to anon, authenticated;

-- Limitar ejecución de helpers
REVOKE ALL ON FUNCTION public.current_user_in_announcement_audience(BIGINT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_announcement_publicly_visible(BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, BIGINT, BOOLEAN) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_in_announcement_audience(BIGINT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_announcement_publicly_visible(BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, BIGINT, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.toggle_announcement_active(BIGINT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_announcement_active(BIGINT, BOOLEAN) TO authenticated;


-- =========[ 6) RLS ]=========
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.users enable row level security;

-- assignees
alter table public.assignees enable row level security;
drop policy if exists assignees_select_rbac on public.assignees;
drop policy if exists assignees_insert_rbac on public.assignees;
drop policy if exists assignees_update_rbac on public.assignees;
drop policy if exists assignees_delete_rbac on public.assignees;

alter table public.tickets enable row level security;
drop policy if exists tickets_insert_rbac on public.tickets;
drop policy if exists tickets_select_requests on public.tickets;
drop policy if exists tickets_select_work_orders on public.tickets;
drop policy if exists tickets_update_requests on public.tickets;
drop policy if exists tickets_update_work_orders on public.tickets;
drop policy if exists tickets_delete_requests on public.tickets;
drop policy if exists tickets_delete_work_orders on public.tickets;

ALTER TABLE public.work_order_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_layout_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_incidents ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.announcements              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_audience_roles ENABLE ROW LEVEL SECURITY;
alter table public.locations enable row level security;
alter table public.societies enable row level security;

-- storage: bucket PUBLICO (esto suele permitir lectura sin policies)
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;
