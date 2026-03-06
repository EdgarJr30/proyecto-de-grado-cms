-- índices Assignees
create index if not exists assignees_is_active_idx on public.assignees (is_active);
create index if not exists assignees_section_idx on public.assignees (section);
create index if not exists assignees_user_id_idx on public.assignees (user_id);

-- índices tickets
create index if not exists idx_tickets_status on public.tickets (status);
create index if not exists idx_tickets_isaccepted on public.tickets (is_accepted);
create index if not exists idx_tickets_location on public.tickets (location_id);
create index if not exists idx_tickets_created_by on public.tickets (created_by);
create index if not exists idx_tickets_title_trgm on public.tickets using gin (title gin_trgm_ops);
create index if not exists idx_tickets_requester_trgm on public.tickets using gin (requester gin_trgm_ops);
create index if not exists idx_tickets_pend_accepted_loc on public.tickets (status, location_id)
where
    status = 'Pendiente'
    and is_accepted = true;

create index if not exists idx_tickets_not_pend_loc on public.tickets (status, location_id)
where
    status <> 'Pendiente';

-- 1.4) Índices que ayudan a tus listas y conteos
create index if not exists ix_tickets_status_archived_created on public.tickets (status, is_archived, created_at desc);
create index if not exists ix_tickets_accepted_archived_status_loc_assignee_created on public.tickets (
    is_accepted,
    is_archived,
    status,
    location_id,
    assignee_id,
    created_at desc
);

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS i_work_order_assignees_work_order ON public.work_order_assignees (work_order_id)
WHERE
    is_active;

CREATE INDEX IF NOT EXISTS i_work_order_assignees_assignee ON public.work_order_assignees (assignee_id)
WHERE
    is_active;

CREATE INDEX IF NOT EXISTS i_work_order_assignees_role ON public.work_order_assignees (role)
WHERE
    is_active;

-- 12) Unicidad base (sin filtro)
DROP INDEX IF EXISTS ux_work_order_assignees_unique;

CREATE UNIQUE INDEX IF NOT EXISTS ux_work_order_assignees_unique ON public.work_order_assignees (work_order_id, assignee_id);

-- 13) Un principal activo por OT (índice único parcial)
DROP INDEX IF EXISTS ux_one_primary_per_work_order;

CREATE UNIQUE INDEX IF NOT EXISTS ux_one_primary_per_work_order ON public.work_order_assignees (work_order_id)
WHERE
    role = 'PRIMARY'
    AND is_active = true;

-- 14) Un secundario ACTIVO por persona/OT (parcial)
DROP INDEX IF EXISTS ux_woa_one_active_secondary_per_person;

CREATE UNIQUE INDEX IF NOT EXISTS ux_woa_one_active_secondary_per_person ON public.work_order_assignees (work_order_id, assignee_id)
WHERE
    role = 'SECONDARY'
    AND is_active = true;

create index if not exists societies_name_idx on public.societies (name);
create index if not exists locations_is_active_idx on public.locations (is_active);
create index if not exists locations_name_trgm_idx on public.locations using gin (name gin_trgm_ops);