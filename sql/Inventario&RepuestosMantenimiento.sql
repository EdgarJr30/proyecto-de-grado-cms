-- =========================================================
-- INVENTORY (Parts + Stock + Docs + Ledger) - FULL SCRIPT
-- ✅ Tipos ENUM idempotentes
-- ✅ Tablas idempotentes
-- ✅ Auditoría completa (created_at/updated_at/created_by/updated_by)
-- ✅ Triggers / functions
-- ✅ post_inventory_doc concurrency-safe (FOR UPDATE locks)
-- ✅ Vistas
-- ✅ Índices
-- =========================================================

-- =========================================================
-- ENUM TYPES (idempotentes)
-- =========================================================
do $$ begin
  create type inventory_doc_type as enum ('RECEIPT','ISSUE','TRANSFER','ADJUSTMENT','RETURN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type inventory_doc_status as enum ('DRAFT','POSTED','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type part_criticality as enum ('LOW','MEDIUM','HIGH','CRITICAL');
exception when duplicate_object then null; end $$;

-- =========================================================
-- EXTENSIONS
-- =========================================================
create extension if not exists pgcrypto;

-- =========================================================
-- AUDIT HELPERS (created_at/updated_at/created_by/updated_by)
-- - Usa hora RD en BD (America/Santo_Domingo)
-- - Intenta setear created_by/updated_by con auth.uid() (Supabase)
-- - FK a public.users(id) como pediste
-- =========================================================

create or replace function public.now_santo_domingo()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

create or replace function public.audit_set_defaults()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_at is null then new.created_at := public.now_santo_domingo(); end if;
    if new.updated_at is null then new.updated_at := public.now_santo_domingo(); end if;

    if new.created_by is null then
      begin
        new.created_by := auth.uid();
      exception when others then
        null;
      end;
    end if;

    if new.updated_by is null then
      new.updated_by := new.created_by;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.updated_at := public.now_santo_domingo();

    if new.updated_by is null then
      begin
        new.updated_by := auth.uid();
      exception when others then
        null;
      end;
    end if;
  end if;

  return new;
end;
$$;

-- =========================================================
-- MASTER DATA
-- =========================================================

create table if not exists public.uoms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id)
);

drop trigger if exists trg_audit_uoms on public.uoms;
create trigger trg_audit_uoms
before insert or update on public.uoms
for each row execute function public.audit_set_defaults();

create table if not exists public.part_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  parent_id uuid null references public.part_categories(id),

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id)
);

drop trigger if exists trg_audit_part_categories on public.part_categories;
create trigger trg_audit_part_categories
before insert or update on public.part_categories
for each row execute function public.audit_set_defaults();

create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text null,
  category_id uuid null references public.part_categories(id),
  uom_id uuid not null references public.uoms(id),
  criticality part_criticality not null default 'MEDIUM',
  is_active boolean not null default true,
  is_stocked boolean not null default true,

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id)
);

drop trigger if exists trg_audit_parts on public.parts;
create trigger trg_audit_parts
before insert or update on public.parts
for each row execute function public.audit_set_defaults();

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  email text null,
  phone text null,
  is_active boolean not null default true,

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id)
);

drop trigger if exists trg_audit_vendors on public.vendors;
create trigger trg_audit_vendors
before insert or update on public.vendors
for each row execute function public.audit_set_defaults();

create table if not exists public.part_vendors (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  vendor_part_code text null,
  lead_time_days int null check (lead_time_days >= 0),
  moq numeric(18,3) null check (moq is null or moq >= 0),
  last_price numeric(18,4) null,
  currency text null,
  is_preferred boolean not null default false,
  unique (part_id, vendor_id),

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id)
);

drop trigger if exists trg_audit_part_vendors on public.part_vendors;
create trigger trg_audit_part_vendors
before insert or update on public.part_vendors
for each row execute function public.audit_set_defaults();

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  location_label text null,
  is_active boolean not null default true,

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id)
);

drop trigger if exists trg_audit_warehouses on public.warehouses;
create trigger trg_audit_warehouses
before insert or update on public.warehouses
for each row execute function public.audit_set_defaults();

create table if not exists public.warehouse_bins (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  code text not null,
  name text null,
  is_active boolean not null default true,
  unique (warehouse_id, code),

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id)
);

drop trigger if exists trg_audit_warehouse_bins on public.warehouse_bins;
create trigger trg_audit_warehouse_bins
before insert or update on public.warehouse_bins
for each row execute function public.audit_set_defaults();

-- =========================================================
-- STOCK
-- =========================================================

create table if not exists public.stock_on_hand (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id),
  warehouse_id uuid not null references public.warehouses(id),
  bin_id uuid null references public.warehouse_bins(id),
  qty numeric(18,3) not null default 0,

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id),

  unique (part_id, warehouse_id, bin_id)
);

drop trigger if exists trg_audit_stock_on_hand on public.stock_on_hand;
create trigger trg_audit_stock_on_hand
before insert or update on public.stock_on_hand
for each row execute function public.audit_set_defaults();

-- =========================================================
-- INVENTORY DOCUMENTS
-- =========================================================

create table if not exists public.inventory_docs (
  id uuid primary key default gen_random_uuid(),
  doc_type inventory_doc_type not null,
  status inventory_doc_status not null default 'DRAFT',
  doc_no text null,

  warehouse_id uuid null references public.warehouses(id),
  from_warehouse_id uuid null references public.warehouses(id),
  to_warehouse_id uuid null references public.warehouses(id),

  ticket_id bigint null references public.tickets(id),

  vendor_id uuid null references public.vendors(id),
  reference text null,
  notes text null,

  posted_at timestamptz null,

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id)
);

drop trigger if exists trg_audit_inventory_docs on public.inventory_docs;
create trigger trg_audit_inventory_docs
before insert or update on public.inventory_docs
for each row execute function public.audit_set_defaults();

create index if not exists idx_inventory_docs_ticket
  on public.inventory_docs(ticket_id);

create table if not exists public.inventory_doc_lines (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.inventory_docs(id) on delete cascade,
  line_no int not null,
  part_id uuid not null references public.parts(id),
  uom_id uuid not null references public.uoms(id),

  -- Importante:
  -- - Para RECEIPT/ISSUE/TRANSFER/RETURN: qty > 0
  -- - Para ADJUSTMENT: qty puede ser +/- (solo no 0)
  qty numeric(18,3) not null,
  unit_cost numeric(18,4) null,

  from_bin_id uuid null references public.warehouse_bins(id),
  to_bin_id uuid null references public.warehouse_bins(id),

  notes text null,

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id),

  unique (doc_id, line_no)
);

drop trigger if exists trg_audit_inventory_doc_lines on public.inventory_doc_lines;
create trigger trg_audit_inventory_doc_lines
before insert or update on public.inventory_doc_lines
for each row execute function public.audit_set_defaults();

-- checks por tipo de documento (en vez de un solo check fijo)
do $$
begin
  -- 1) Drop constraints si llegaron a existir (o si las creaste antes)
  if exists (
    select 1
    from pg_constraint
    where conname = 'chk_doc_lines_qty_positive_non_adjustment'
  ) then
    alter table public.inventory_doc_lines
      drop constraint chk_doc_lines_qty_positive_non_adjustment;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'chk_doc_lines_qty_nonzero_adjustment'
  ) then
    alter table public.inventory_doc_lines
      drop constraint chk_doc_lines_qty_nonzero_adjustment;
  end if;
end $$;

-- 2) Function validator (idempotente)
create or replace function public.validate_inventory_doc_line_qty()
returns trigger
language plpgsql
as $$
declare
  v_type inventory_doc_type;
begin
  select d.doc_type
    into v_type
  from public.inventory_docs d
  where d.id = new.doc_id;

  if v_type is null then
    raise exception 'Doc % no existe', new.doc_id;
  end if;

  if v_type = 'ADJUSTMENT' then
    if new.qty = 0 then
      raise exception 'ADJUSTMENT requiere qty != 0';
    end if;
  else
    if new.qty <= 0 then
      raise exception '% requiere qty > 0', v_type;
    end if;
  end if;

  return new;
end;
$$;

-- 3) Trigger (idempotente)
drop trigger if exists trg_validate_inventory_doc_line_qty on public.inventory_doc_lines;

create trigger trg_validate_inventory_doc_line_qty
before insert or update of qty, doc_id
on public.inventory_doc_lines
for each row
execute function public.validate_inventory_doc_line_qty();

create table if not exists public.inventory_ledger (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.inventory_docs(id),
  doc_line_id uuid not null references public.inventory_doc_lines(id),
  doc_type inventory_doc_type not null,
  occurred_at timestamptz not null,
  part_id uuid not null references public.parts(id),
  warehouse_id uuid not null references public.warehouses(id),
  bin_id uuid null references public.warehouse_bins(id),
  qty_delta numeric(18,3) not null,
  unit_cost numeric(18,4) null,
  movement_side text null check (movement_side in ('OUT','IN')),

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id)
);

drop trigger if exists trg_audit_inventory_ledger on public.inventory_ledger;
create trigger trg_audit_inventory_ledger
before insert or update on public.inventory_ledger
for each row execute function public.audit_set_defaults();

create index if not exists idx_ledger_part_date
  on public.inventory_ledger(part_id, occurred_at desc);

-- =========================================================
-- TICKETS -> PART REQUESTS
-- =========================================================

create table if not exists public.ticket_part_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_id bigint not null references public.tickets(id) on delete cascade,
  part_id uuid not null references public.parts(id),
  warehouse_id uuid not null references public.warehouses(id),

  requested_qty numeric(18,3) not null check (requested_qty > 0),
  reserved_qty numeric(18,3) not null default 0,
  issued_qty numeric(18,3) not null default 0,
  returned_qty numeric(18,3) not null default 0,

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id),

  unique (ticket_id, part_id, warehouse_id)
);

drop trigger if exists trg_audit_ticket_part_requests on public.ticket_part_requests;
create trigger trg_audit_ticket_part_requests
before insert or update on public.ticket_part_requests
for each row execute function public.audit_set_defaults();

create index if not exists idx_ticket_part_requests_ticket
  on public.ticket_part_requests(ticket_id);

-- =========================================================
-- REORDER POLICIES
-- =========================================================

create table if not exists public.reorder_policies (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id),
  warehouse_id uuid not null references public.warehouses(id),

  min_qty numeric(18,3) not null default 0,
  max_qty numeric(18,3) null,
  reorder_point numeric(18,3) null,
  safety_stock numeric(18,3) null,
  lead_time_days int null,
  preferred_vendor_id uuid null references public.vendors(id),

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id),

  unique (part_id, warehouse_id)
);

drop trigger if exists trg_audit_reorder_policies on public.reorder_policies;
create trigger trg_audit_reorder_policies
before insert or update on public.reorder_policies
for each row execute function public.audit_set_defaults();

-- =========================================================
-- BUSINESS RULES
-- =========================================================

create or replace function public.ensure_ticket_is_accepted()
returns trigger as $$
declare
  v_is_accepted boolean;
begin
  if new.ticket_id is null then
    return new;
  end if;

  select is_accepted into v_is_accepted
  from public.tickets
  where id = new.ticket_id;

  if coalesce(v_is_accepted,false) = false then
    raise exception
      'Ticket % no está aceptado (no es WO). No se permite consumo/devolución.',
      new.ticket_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_inventory_docs_ticket_accepted on public.inventory_docs;

create trigger trg_inventory_docs_ticket_accepted
before insert or update of ticket_id, doc_type
on public.inventory_docs
for each row
when (new.doc_type in ('ISSUE','RETURN'))
execute function public.ensure_ticket_is_accepted();

-- =========================================================
-- STOCK HELPERS
-- =========================================================

create or replace function public.apply_stock_delta(
  p_part_id uuid,
  p_warehouse_id uuid,
  p_bin_id uuid,
  p_qty_delta numeric
) returns void as $$
declare
  v_rows int := 0;
begin
  if coalesce(p_qty_delta, 0) = 0 then
    return;
  end if;

  if p_qty_delta > 0 then
    insert into public.stock_on_hand(part_id, warehouse_id, bin_id, qty)
    values (p_part_id, p_warehouse_id, p_bin_id, p_qty_delta)
    on conflict (part_id, warehouse_id, bin_id)
    do update set
      qty = public.stock_on_hand.qty + excluded.qty;
    return;
  end if;

  -- Para salidas: aplicar de forma atómica y solo si no deja stock negativo.
  update public.stock_on_hand s
  set qty = s.qty + p_qty_delta
  where s.part_id = p_part_id
    and s.warehouse_id = p_warehouse_id
    and (
      (s.bin_id is null and p_bin_id is null)
      or s.bin_id = p_bin_id
    )
    and (s.qty + p_qty_delta) >= 0;

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    raise exception
      'Stock insuficiente para salida (part_id=%, warehouse_id=%, bin_id=%, qty_delta=%)',
      p_part_id, p_warehouse_id, p_bin_id, p_qty_delta;
  elsif v_rows > 1 then
    raise exception
      'Inconsistencia: múltiples filas de stock para la misma llave (part_id=%, warehouse_id=%, bin_id=%)',
      p_part_id, p_warehouse_id, p_bin_id;
  end if;
end;
$$ language plpgsql;

-- =========================================================
-- POST INVENTORY DOC
-- - La version activa/actualizada de post_inventory_doc esta mas abajo
--   en la seccion "UPDATE: post_inventory_doc enhancements".
-- =========================================================

-- =========================================================
-- LAST LINE OF DEFENSE: NO NEGATIVE STOCK
-- =========================================================

create or replace function public.prevent_negative_stock()
returns trigger as $$
begin
  if new.qty < 0 then
    raise exception
      'Stock negativo no permitido (part_id=%, warehouse_id=%, bin_id=%)',
      new.part_id, new.warehouse_id, new.bin_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_negative_stock on public.stock_on_hand;

create trigger trg_prevent_negative_stock
before insert or update of qty
on public.stock_on_hand
for each row
when (new.qty < 0)
execute function public.prevent_negative_stock();

-- =========================================================
-- VIEWS
-- =========================================================

create or replace view public.v_part_stock_summary
with (security_invoker = on)
 as
select
  p.id as part_id,
  p.code,
  p.name,
  p.is_active,
  p.criticality,
  p.category_id,
  p.uom_id,
  coalesce(sum(s.qty),0) as total_qty
from public.parts p
left join public.stock_on_hand s on s.part_id = p.id
group by p.id;

create or replace view public.v_stock_by_location 
with (security_invoker = on)
as
select
  s.part_id,
  p.code as part_code,
  p.name as part_name,
  s.warehouse_id,
  w.code as warehouse_code,
  w.name as warehouse_name,
  s.bin_id,
  b.code as bin_code,
  b.name as bin_name,
  s.qty,
  s.updated_at
from public.stock_on_hand s
join public.parts p on p.id = s.part_id
join public.warehouses w on w.id = s.warehouse_id
left join public.warehouse_bins b on b.id = s.bin_id;

create or replace view public.v_inventory_kardex 
with (security_invoker = on)
as
select
  l.occurred_at,
  l.doc_type,
  l.movement_side,
  d.status,
  d.doc_no,
  d.reference,
  d.ticket_id,
  l.part_id,
  p.code as part_code,
  p.name as part_name,
  l.warehouse_id,
  w.code as warehouse_code,
  w.name as warehouse_name,
  l.bin_id,
  b.code as bin_code,
  l.qty_delta,
  l.unit_cost
from public.inventory_ledger l
join public.inventory_docs d on d.id = l.doc_id
join public.parts p on p.id = l.part_id
join public.warehouses w on w.id = l.warehouse_id
left join public.warehouse_bins b on b.id = l.bin_id;

create or replace view public.v_reorder_suggestions 
with (security_invoker = on)
as
select
  rp.part_id,
  p.code as part_code,
  p.name as part_name,
  rp.warehouse_id,
  w.code as warehouse_code,
  w.name as warehouse_name,
  rp.min_qty,
  rp.reorder_point,
  coalesce(sum(soh.qty),0) as on_hand_qty,
  greatest(coalesce(rp.min_qty,0) - coalesce(sum(soh.qty),0), 0) as suggested_min_replenish,
  case
    when rp.reorder_point is not null and coalesce(sum(soh.qty),0) <= rp.reorder_point then true
    when rp.reorder_point is null and coalesce(sum(soh.qty),0) <= rp.min_qty then true
    else false
  end as needs_reorder
from public.reorder_policies rp
join public.parts p on p.id = rp.part_id
join public.warehouses w on w.id = rp.warehouse_id
left join public.stock_on_hand soh
  on soh.part_id = rp.part_id
 and soh.warehouse_id = rp.warehouse_id
group by
  rp.part_id, p.code, p.name,
  rp.warehouse_id, w.code, w.name,
  rp.min_qty, rp.reorder_point;

-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists idx_stock_part_wh
  on public.stock_on_hand(part_id, warehouse_id);

create index if not exists idx_doc_lines_doc
  on public.inventory_doc_lines(doc_id);

create index if not exists idx_docs_type_status
  on public.inventory_docs(doc_type, status);

create index if not exists idx_ledger_wh_date
  on public.inventory_ledger(warehouse_id, occurred_at desc);





-- =========================================================
-- PATCH: Inventory hardening (Doc No, Cancel, Reserve, Cost, RLS)
-- =========================================================

-- =========================================================
-- 2.1 DOC NUMBERING (doc_no) - per doc_type + year (concurrency-safe)
-- =========================================================

create table if not exists public.inventory_doc_counters (
  doc_type inventory_doc_type not null,
  year int not null,
  last_no int not null default 0,
  primary key (doc_type, year),

  created_at timestamptz not null default public.now_santo_domingo(),
  updated_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id)
);

drop trigger if exists trg_audit_inventory_doc_counters on public.inventory_doc_counters;
create trigger trg_audit_inventory_doc_counters
before insert or update on public.inventory_doc_counters
for each row execute function public.audit_set_defaults();

-- doc_no unique (solo cuando no es null)
create unique index if not exists ux_inventory_docs_doc_no
on public.inventory_docs(doc_no)
where doc_no is not null;

-- helper: prefix por tipo
create or replace function public.inventory_doc_type_prefix(p_doc_type inventory_doc_type)
returns text
language sql
immutable
as $$
  select case p_doc_type
    when 'RECEIPT' then 'REC'
    when 'ISSUE' then 'ISS'
    when 'TRANSFER' then 'TRF'
    when 'ADJUSTMENT' then 'ADJ'
    when 'RETURN' then 'RET'
  end;
$$;

-- next doc_no (locks counter row FOR UPDATE)
create or replace function public.next_inventory_doc_no(p_doc_type inventory_doc_type)
returns text
language plpgsql
as $$
declare
  v_year int := extract(year from public.now_santo_domingo())::int;
  v_last int;
  v_next int;
  v_prefix text := public.inventory_doc_type_prefix(p_doc_type);
begin
  insert into public.inventory_doc_counters(doc_type, year, last_no)
  values (p_doc_type, v_year, 0)
  on conflict (doc_type, year) do nothing;

  select last_no
    into v_last
  from public.inventory_doc_counters
  where doc_type = p_doc_type and year = v_year
  for update;

  v_next := coalesce(v_last, 0) + 1;

  update public.inventory_doc_counters
  set last_no = v_next
  where doc_type = p_doc_type and year = v_year;

  return 'INV-' || v_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
end;
$$;

-- =========================================================
-- 2.4 COSTING: Weighted Average per (part, warehouse)
-- =========================================================

create table if not exists public.part_costs (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id),
  warehouse_id uuid not null references public.warehouses(id),

  avg_unit_cost numeric(18,4) not null default 0,
  updated_at timestamptz not null default public.now_santo_domingo(),

  created_at timestamptz not null default public.now_santo_domingo(),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id),

  unique (part_id, warehouse_id)
);

drop trigger if exists trg_audit_part_costs on public.part_costs;
create trigger trg_audit_part_costs
before insert or update on public.part_costs
for each row execute function public.audit_set_defaults();

-- obtener costo actual (0 si no existe)
create or replace function public.get_part_avg_cost(p_part_id uuid, p_warehouse_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(
    (select pc.avg_unit_cost from public.part_costs pc
     where pc.part_id = p_part_id and pc.warehouse_id = p_warehouse_id),
    0
  );
$$;

-- =========================================================
-- 2.3 RESERVATIONS: reserve_ticket_part (no mueve stock)
-- - Valida disponibilidad: on_hand - reserved_total >= qty (si allow_backorder=false)
-- =========================================================

create or replace function public.reserve_ticket_part(
  p_ticket_id bigint,
  p_part_id uuid,
  p_warehouse_id uuid,
  p_qty numeric,
  p_allow_backorder boolean default false
) returns void
language plpgsql
as $$
declare
  v_now timestamptz := public.now_santo_domingo();
  v_on_hand numeric := 0;
  v_reserved numeric := 0;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'reserved qty debe ser > 0';
  end if;

  -- Lock stock rows del part+warehouse (todas las bins) para consistencia
  perform 1
  from public.stock_on_hand s
  where s.part_id = p_part_id and s.warehouse_id = p_warehouse_id
  for update;

  select coalesce(sum(s.qty),0)
    into v_on_hand
  from public.stock_on_hand s
  where s.part_id = p_part_id and s.warehouse_id = p_warehouse_id;

  -- Lock reservas existentes para este part+warehouse
  perform 1
  from public.ticket_part_requests r
  where r.part_id = p_part_id and r.warehouse_id = p_warehouse_id
  for update;

  select coalesce(sum(r.reserved_qty),0)
    into v_reserved
  from public.ticket_part_requests r
  where r.part_id = p_part_id and r.warehouse_id = p_warehouse_id;

  if not p_allow_backorder then
    if (v_on_hand - v_reserved) < p_qty then
      raise exception
        'Stock disponible insuficiente para reservar. OnHand=%, Reserved=%, Requested=%',
        v_on_hand, v_reserved, p_qty;
    end if;
  end if;

  insert into public.ticket_part_requests(
    ticket_id, part_id, warehouse_id,
    requested_qty, reserved_qty, issued_qty, returned_qty,
    created_at, updated_at
  )
  values (
    p_ticket_id, p_part_id, p_warehouse_id,
    p_qty, p_qty, 0, 0,
    v_now, v_now
  )
  on conflict (ticket_id, part_id, warehouse_id)
  do update set
    requested_qty = public.ticket_part_requests.requested_qty + excluded.requested_qty,
    reserved_qty  = public.ticket_part_requests.reserved_qty + excluded.reserved_qty,
    updated_at    = v_now;
end;
$$;

-- =========================================================
-- 2.2 CANCEL: reverse doc generator + cancel_inventory_doc
-- - Solo POSTED
-- - Crea un doc reverso (DRAFT) y lo postea
-- - Si no hay stock para reversar, fallará (consistente).
-- =========================================================

-- columnas para trazabilidad (idempotente)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='inventory_docs' and column_name='cancelled_at'
  ) then
    alter table public.inventory_docs add column cancelled_at timestamptz null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='inventory_docs' and column_name='cancelled_by'
  ) then
    alter table public.inventory_docs add column cancelled_by uuid null references public.users(id);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='inventory_docs' and column_name='reversal_doc_id'
  ) then
    alter table public.inventory_docs add column reversal_doc_id uuid null references public.inventory_docs(id);
  end if;
end $$;

create or replace function public.create_reversal_doc(p_doc_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_doc public.inventory_docs%rowtype;
  v_new_id uuid;
  v_now timestamptz := public.now_santo_domingo();
begin
  select * into v_doc
  from public.inventory_docs
  where id = p_doc_id
  for update;

  if not found then
    raise exception 'Documento % no existe', p_doc_id;
  end if;

  if v_doc.status <> 'POSTED' then
    raise exception 'Solo se reversa un documento POSTED. doc_id=% status=%', p_doc_id, v_doc.status;
  end if;

  if v_doc.reversal_doc_id is not null then
    raise exception 'Documento % ya tiene reversa asociada: %', p_doc_id, v_doc.reversal_doc_id;
  end if;

  -- doc_type reverso (mismo inventario pero opuesto)
  -- RECEIPT -> ISSUE
  -- ISSUE   -> RETURN
  -- RETURN  -> ISSUE
  -- TRANSFER-> TRANSFER (swap)
  -- ADJUSTMENT -> ADJUSTMENT (qty * -1)
  insert into public.inventory_docs(
    doc_type, status, doc_no,
    warehouse_id, from_warehouse_id, to_warehouse_id,
    ticket_id, vendor_id, reference, notes,
    posted_at, created_at, updated_at, created_by, updated_by
  )
  values (
  (
    case v_doc.doc_type
      when 'RECEIPT'::public.inventory_doc_type then 'ISSUE'::public.inventory_doc_type
      when 'ISSUE'::public.inventory_doc_type   then 'RETURN'::public.inventory_doc_type
      when 'RETURN'::public.inventory_doc_type  then 'ISSUE'::public.inventory_doc_type
      when 'TRANSFER'::public.inventory_doc_type then 'TRANSFER'::public.inventory_doc_type
      when 'ADJUSTMENT'::public.inventory_doc_type then 'ADJUSTMENT'::public.inventory_doc_type
    end
  )::public.inventory_doc_type,
  'DRAFT'::public.inventory_doc_status,
  null,
    -- warehouse context:
    case
      when v_doc.doc_type in ('RECEIPT','ISSUE','RETURN','ADJUSTMENT') then v_doc.warehouse_id
      else null
    end,
    case when v_doc.doc_type = 'TRANSFER' then v_doc.to_warehouse_id else null end, -- swap
    case when v_doc.doc_type = 'TRANSFER' then v_doc.from_warehouse_id else null end, -- swap
    v_doc.ticket_id,
    v_doc.vendor_id,
    'REVERSAL OF ' || coalesce(v_doc.doc_no, v_doc.id::text),
    'Auto reversal',
    null,
    v_now, v_now,
    v_doc.created_by, v_doc.updated_by
  )
  returning id into v_new_id;

  -- copiar líneas invertidas
  insert into public.inventory_doc_lines(
    doc_id, line_no, part_id, uom_id, qty, unit_cost,
    from_bin_id, to_bin_id, notes,
    created_at, updated_at, created_by, updated_by
  )
  select
    v_new_id,
    l.line_no,
    l.part_id,
    l.uom_id,
    case
      when v_doc.doc_type = 'ADJUSTMENT' then -l.qty
      else l.qty
    end as qty,
    l.unit_cost,
    -- bins:
    case
      when v_doc.doc_type = 'RECEIPT' then l.to_bin_id          -- reverse = ISSUE from that bin
      when v_doc.doc_type = 'ISSUE' then null                  -- reverse = RETURN to_bin_id below
      when v_doc.doc_type = 'RETURN' then l.to_bin_id          -- reverse = ISSUE from that bin
      when v_doc.doc_type = 'TRANSFER' then l.to_bin_id        -- reverse transfer: OUT from original to_bin
      when v_doc.doc_type = 'ADJUSTMENT' then l.from_bin_id
    end as from_bin_id,
    case
      when v_doc.doc_type = 'RECEIPT' then null                -- ISSUE no necesita to_bin_id
      when v_doc.doc_type = 'ISSUE' then l.from_bin_id         -- RETURN to original from_bin
      when v_doc.doc_type = 'RETURN' then null                 -- ISSUE no necesita to_bin_id
      when v_doc.doc_type = 'TRANSFER' then l.from_bin_id      -- reverse transfer: IN to original from_bin
      when v_doc.doc_type = 'ADJUSTMENT' then l.to_bin_id
    end as to_bin_id,
    'Reversal line',
    v_now, v_now, l.created_by, l.updated_by
  from public.inventory_doc_lines l
  where l.doc_id = p_doc_id;

  -- link
  update public.inventory_docs
  set reversal_doc_id = v_new_id
  where id = p_doc_id;

  return v_new_id;
end;
$$;

create or replace function public.cancel_inventory_doc(p_doc_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_doc public.inventory_docs%rowtype;
  v_rev_id uuid;
  v_now timestamptz := public.now_santo_domingo();
  v_uid uuid;
begin
  begin
    v_uid := auth.uid();
  exception when others then
    v_uid := null;
  end;

  select * into v_doc
  from public.inventory_docs
  where id = p_doc_id
  for update;

  if not found then
    raise exception 'Documento % no existe', p_doc_id;
  end if;

  if v_doc.status <> 'POSTED' then
    raise exception 'Solo se puede cancelar un documento POSTED. doc_id=% status=%', p_doc_id, v_doc.status;
  end if;

  v_rev_id := public.create_reversal_doc(p_doc_id);
  perform public.post_inventory_doc(v_rev_id);

  update public.inventory_docs
  set status = 'CANCELLED',
      cancelled_at = v_now,
      cancelled_by = v_uid,
      updated_at = v_now,
      updated_by = v_uid
  where id = p_doc_id;

  return v_rev_id;
end;
$$;

-- =========================================================
-- UPDATE: post_inventory_doc enhancements
-- - Asigna doc_no al postear (si null)
-- - Costeo promedio: actualizar en RECEIPT/ADJUSTMENT (solo entradas positivas)
-- - ISSUE/RETURN/TRANSFER: si unit_cost null => usa avg cost
-- - ISSUE: reduce reserved_qty del ticket si existe (no baja de 0)
-- =========================================================

create or replace function public.post_inventory_doc(p_doc_id uuid)
returns void
language plpgsql
as $$
declare
  v_doc public.inventory_docs%rowtype;
  v_ticket_is_accepted boolean;
  v_has_stock_issue boolean := false;
  v_now timestamptz := public.now_santo_domingo();
begin
  -- 1) Lock del documento para evitar doble post
  select * into v_doc
  from public.inventory_docs
  where id = p_doc_id
  for update;

  if not found then
    raise exception 'Documento % no existe', p_doc_id;
  end if;

  if v_doc.status <> 'DRAFT' then
    raise exception 'Documento % no está en DRAFT (status=%)', p_doc_id, v_doc.status;
  end if;

  -- 1.1) doc_no automático (si no lo tiene)
  if v_doc.doc_no is null then
    update public.inventory_docs
    set doc_no = public.next_inventory_doc_no(v_doc.doc_type)
    where id = v_doc.id;

    select * into v_doc
    from public.inventory_docs
    where id = p_doc_id
    for update;
  end if;

  -- 2) Validación ticket aceptado si aplica (ISSUE/RETURN)
  if v_doc.doc_type in ('ISSUE','RETURN') and v_doc.ticket_id is not null then
    select is_accepted
      into v_ticket_is_accepted
    from public.tickets
    where id = v_doc.ticket_id;

    if coalesce(v_ticket_is_accepted,false) = false then
      raise exception 'Ticket % no está aceptado. No se permite %.', v_doc.ticket_id, v_doc.doc_type;
    end if;
  end if;

  -- 3) Validaciones de contexto
  if v_doc.doc_type in ('RECEIPT','ISSUE','ADJUSTMENT','RETURN') then
    if v_doc.warehouse_id is null then
      raise exception 'warehouse_id es requerido para doc_type %', v_doc.doc_type;
    end if;
  end if;

  if v_doc.doc_type = 'TRANSFER' then
    if v_doc.from_warehouse_id is null or v_doc.to_warehouse_id is null then
      raise exception 'from_warehouse_id y to_warehouse_id son requeridos para TRANSFER';
    end if;
    if v_doc.from_warehouse_id = v_doc.to_warehouse_id then
      raise exception 'TRANSFER requiere warehouses distintos';
    end if;
  end if;

  -- 4) Validar líneas
  if not exists (select 1 from public.inventory_doc_lines where doc_id = p_doc_id) then
    raise exception 'Documento % no tiene líneas', p_doc_id;
  end if;

  -- ======================================================
  -- 5) Concurrency-safe locks
  -- ======================================================

  -- 5.1) Upsert filas faltantes
  if v_doc.doc_type in ('RECEIPT','RETURN','ADJUSTMENT') then
    insert into public.stock_on_hand(part_id, warehouse_id, bin_id, qty)
    select
      l.part_id,
      v_doc.warehouse_id,
      case
        when v_doc.doc_type = 'ADJUSTMENT' then coalesce(l.to_bin_id, l.from_bin_id)
        else l.to_bin_id
      end as bin_id,
      0
    from public.inventory_doc_lines l
    where l.doc_id = p_doc_id
    on conflict (part_id, warehouse_id, bin_id) do nothing;
  end if;

  if v_doc.doc_type = 'ISSUE' then
    insert into public.stock_on_hand(part_id, warehouse_id, bin_id, qty)
    select l.part_id, v_doc.warehouse_id, l.from_bin_id, 0
    from public.inventory_doc_lines l
    where l.doc_id = p_doc_id
    on conflict (part_id, warehouse_id, bin_id) do nothing;
  end if;

  if v_doc.doc_type = 'TRANSFER' then
    insert into public.stock_on_hand(part_id, warehouse_id, bin_id, qty)
    select l.part_id, v_doc.from_warehouse_id, l.from_bin_id, 0
    from public.inventory_doc_lines l
    where l.doc_id = p_doc_id
    on conflict (part_id, warehouse_id, bin_id) do nothing;

    insert into public.stock_on_hand(part_id, warehouse_id, bin_id, qty)
    select l.part_id, v_doc.to_warehouse_id, l.to_bin_id, 0
    from public.inventory_doc_lines l
    where l.doc_id = p_doc_id
    on conflict (part_id, warehouse_id, bin_id) do nothing;
  end if;

  -- 5.2) Lock filas afectadas (FIX: WITH + PERFORM)
  if v_doc.doc_type in ('ISSUE','TRANSFER') then
    perform 1
    from (
      with keys_out as (
        select distinct
          l.part_id,
          case
            when v_doc.doc_type = 'TRANSFER' then v_doc.from_warehouse_id
            else v_doc.warehouse_id
          end as warehouse_id,
          l.from_bin_id as bin_id
        from public.inventory_doc_lines l
        where l.doc_id = p_doc_id
      )
      select 1
      from public.stock_on_hand s
      join keys_out k
        on s.part_id = k.part_id
        and s.warehouse_id = k.warehouse_id
        and ( (s.bin_id is null and k.bin_id is null) or s.bin_id = k.bin_id )
      for update
    ) q;
  end if;

  if v_doc.doc_type in ('RECEIPT','RETURN','ADJUSTMENT') then
    perform 1
    from (
      with keys_in as (
        select distinct
          l.part_id,
          v_doc.warehouse_id as warehouse_id,
          case
            when v_doc.doc_type = 'ADJUSTMENT' then coalesce(l.to_bin_id, l.from_bin_id)
            else l.to_bin_id
          end as bin_id
        from public.inventory_doc_lines l
        where l.doc_id = p_doc_id
      )
      select 1
      from public.stock_on_hand s
      join keys_in k
        on s.part_id = k.part_id
        and s.warehouse_id = k.warehouse_id
        and ( (s.bin_id is null and k.bin_id is null) or s.bin_id = k.bin_id )
      for update
    ) q;
  end if;

  if v_doc.doc_type = 'TRANSFER' then
    perform 1
    from (
      with keys_in_t as (
        select distinct
          l.part_id,
          v_doc.to_warehouse_id as warehouse_id,
          l.to_bin_id as bin_id
        from public.inventory_doc_lines l
        where l.doc_id = p_doc_id
      )
      select 1
      from public.stock_on_hand s
      join keys_in_t k
        on s.part_id = k.part_id
        and s.warehouse_id = k.warehouse_id
        and ( (s.bin_id is null and k.bin_id is null) or s.bin_id = k.bin_id )
      for update
    ) q;
  end if;

  -- 6) Validación stock suficiente (ISSUE/TRANSFER)
  if v_doc.doc_type in ('ISSUE','TRANSFER') then
    with need as (
      select
        l.part_id,
        case
          when v_doc.doc_type = 'TRANSFER' then v_doc.from_warehouse_id
          else v_doc.warehouse_id
        end as warehouse_id,
        l.from_bin_id as bin_id,
        sum(l.qty) as qty_needed
      from public.inventory_doc_lines l
      where l.doc_id = p_doc_id
      group by l.part_id, l.from_bin_id
    ), on_hand as (
      select
        n.part_id,
        n.warehouse_id,
        n.bin_id,
        n.qty_needed,
        coalesce(sum(h.qty), 0) as qty_available
      from need n
      left join public.stock_on_hand h
        on h.part_id = n.part_id
        and h.warehouse_id = n.warehouse_id
        and ( (h.bin_id is null and n.bin_id is null) or h.bin_id = n.bin_id )
      group by n.part_id, n.warehouse_id, n.bin_id, n.qty_needed
    )
    select exists (
      select 1
      from on_hand x
      where x.qty_available < x.qty_needed
    )
    into v_has_stock_issue;

    if v_has_stock_issue then
      raise exception 'Stock insuficiente para postear %', p_doc_id;
    end if;
  end if;

  -- ======================================================
  -- 6.5) Default unit_cost where null (ISSUE/RETURN/TRANSFER)
  -- ======================================================
  if v_doc.doc_type in ('ISSUE','RETURN') then
    update public.inventory_doc_lines l
    set unit_cost = public.get_part_avg_cost(l.part_id, v_doc.warehouse_id)
    where l.doc_id = v_doc.id
      and l.unit_cost is null;
  elsif v_doc.doc_type = 'TRANSFER' then
    update public.inventory_doc_lines l
    set unit_cost = public.get_part_avg_cost(l.part_id, v_doc.from_warehouse_id)
    where l.doc_id = v_doc.id
      and l.unit_cost is null;
  end if;

  -- 7) Ledger + stock + ticket_part_requests
  if v_doc.doc_type = 'RECEIPT' then
    -- costo promedio: update part_costs por (part,warehouse) usando weighted avg
    -- (solo qty positivas; si mandas unit_cost null queda 0)
    with agg as (
      select
        l.part_id,
        sum(l.qty) as qty_in,
        sum(l.qty * coalesce(l.unit_cost,0)) as cost_in
      from public.inventory_doc_lines l
      where l.doc_id = v_doc.id
      group by l.part_id
    ), onhand as (
      select
        a.part_id,
        coalesce(sum(s.qty),0) as qty_on_hand
      from agg a
      left join public.stock_on_hand s
        on s.part_id = a.part_id and s.warehouse_id = v_doc.warehouse_id
      group by a.part_id
    )
    insert into public.part_costs(part_id, warehouse_id, avg_unit_cost)
    select a.part_id, v_doc.warehouse_id,
      case
        when (o.qty_on_hand + a.qty_in) = 0 then 0
        else (public.get_part_avg_cost(a.part_id, v_doc.warehouse_id) * o.qty_on_hand + a.cost_in) / (o.qty_on_hand + a.qty_in)
      end
    from agg a
    join onhand o on o.part_id = a.part_id
    on conflict (part_id, warehouse_id) do update set
      avg_unit_cost = excluded.avg_unit_cost,
      updated_at = public.now_santo_domingo();

    insert into public.inventory_ledger
      (doc_id, doc_line_id, doc_type, occurred_at, part_id, warehouse_id, bin_id, qty_delta, unit_cost)
    select v_doc.id, l.id, v_doc.doc_type, v_now,
            l.part_id, v_doc.warehouse_id, l.to_bin_id,
            l.qty, l.unit_cost
    from public.inventory_doc_lines l
    where l.doc_id = v_doc.id;

    perform public.apply_stock_delta(l.part_id, v_doc.warehouse_id, l.to_bin_id, l.qty)
    from public.inventory_doc_lines l
    where l.doc_id = v_doc.id;

  elsif v_doc.doc_type = 'ISSUE' then
    insert into public.inventory_ledger
      (doc_id, doc_line_id, doc_type, occurred_at, part_id, warehouse_id, bin_id, qty_delta, unit_cost)
    select v_doc.id, l.id, v_doc.doc_type, v_now,
            l.part_id, v_doc.warehouse_id, l.from_bin_id,
            -l.qty, l.unit_cost
    from public.inventory_doc_lines l
    where l.doc_id = v_doc.id;

    perform public.apply_stock_delta(l.part_id, v_doc.warehouse_id, l.from_bin_id, -l.qty)
    from public.inventory_doc_lines l
    where l.doc_id = v_doc.id;

    if v_doc.ticket_id is not null then
      -- upsert y ajustar reserved_qty (reduce, sin bajar de 0)
      insert into public.ticket_part_requests(
        ticket_id, part_id, warehouse_id,
        requested_qty, reserved_qty, issued_qty, returned_qty
      )
      select v_doc.ticket_id, l.part_id, v_doc.warehouse_id, sum(l.qty), 0, sum(l.qty), 0
      from public.inventory_doc_lines l
      where l.doc_id = v_doc.id
      group by l.part_id
      on conflict (ticket_id, part_id, warehouse_id)
      do update set
        issued_qty = public.ticket_part_requests.issued_qty + excluded.issued_qty,
        requested_qty = greatest(
          public.ticket_part_requests.requested_qty,
          public.ticket_part_requests.issued_qty + excluded.issued_qty
        ),
        reserved_qty = greatest(public.ticket_part_requests.reserved_qty - excluded.issued_qty, 0);
    end if;

  elsif v_doc.doc_type = 'RETURN' then
    insert into public.inventory_ledger
      (doc_id, doc_line_id, doc_type, occurred_at, part_id, warehouse_id, bin_id, qty_delta, unit_cost)
    select v_doc.id, l.id, v_doc.doc_type, v_now,
            l.part_id, v_doc.warehouse_id, l.to_bin_id,
            l.qty, l.unit_cost
    from public.inventory_doc_lines l
    where l.doc_id = v_doc.id;

    perform public.apply_stock_delta(l.part_id, v_doc.warehouse_id, l.to_bin_id, l.qty)
    from public.inventory_doc_lines l
    where l.doc_id = v_doc.id;

    if v_doc.ticket_id is not null then
      insert into public.ticket_part_requests(
        ticket_id, part_id, warehouse_id,
        requested_qty, reserved_qty, issued_qty, returned_qty
      )
      select v_doc.ticket_id, l.part_id, v_doc.warehouse_id, sum(l.qty), 0, sum(l.qty), sum(l.qty)
      from public.inventory_doc_lines l
      where l.doc_id = v_doc.id
      group by l.part_id
      on conflict (ticket_id, part_id, warehouse_id)
      do update set
        returned_qty = public.ticket_part_requests.returned_qty + excluded.returned_qty,
        requested_qty = greatest(
          public.ticket_part_requests.requested_qty,
          public.ticket_part_requests.issued_qty,
          public.ticket_part_requests.returned_qty + excluded.returned_qty
        ),
        issued_qty = greatest(
          public.ticket_part_requests.issued_qty,
          public.ticket_part_requests.returned_qty + excluded.returned_qty
        );
    end if;

  elsif v_doc.doc_type = 'ADJUSTMENT' then
    -- si qty>0 y unit_cost null, usa avg actual (para no contaminar con 0)
    update public.inventory_doc_lines l
    set unit_cost = public.get_part_avg_cost(l.part_id, v_doc.warehouse_id)
    where l.doc_id = v_doc.id
      and l.unit_cost is null
      and l.qty > 0;

    -- costo promedio: solo afecta si hay entradas (qty>0)
    with agg as (
      select
        l.part_id,
        sum(case when l.qty > 0 then l.qty else 0 end) as qty_in,
        sum(case when l.qty > 0 then l.qty * coalesce(l.unit_cost,0) else 0 end) as cost_in
      from public.inventory_doc_lines l
      where l.doc_id = v_doc.id
      group by l.part_id
    ), onhand as (
      select
        a.part_id,
        coalesce(sum(s.qty),0) as qty_on_hand
      from agg a
      left join public.stock_on_hand s
        on s.part_id = a.part_id and s.warehouse_id = v_doc.warehouse_id
      group by a.part_id
    )
    insert into public.part_costs(part_id, warehouse_id, avg_unit_cost)
    select a.part_id, v_doc.warehouse_id,
      case
        when a.qty_in = 0 then public.get_part_avg_cost(a.part_id, v_doc.warehouse_id)
        when (o.qty_on_hand + a.qty_in) = 0 then 0
        else (public.get_part_avg_cost(a.part_id, v_doc.warehouse_id) * o.qty_on_hand + a.cost_in) / (o.qty_on_hand + a.qty_in)
      end
    from agg a
    join onhand o on o.part_id = a.part_id
    on conflict (part_id, warehouse_id) do update set
      avg_unit_cost = excluded.avg_unit_cost,
      updated_at = public.now_santo_domingo();

    insert into public.inventory_ledger
      (doc_id, doc_line_id, doc_type, occurred_at, part_id, warehouse_id, bin_id, qty_delta, unit_cost)
    select v_doc.id, l.id, v_doc.doc_type, v_now,
            l.part_id, v_doc.warehouse_id, coalesce(l.to_bin_id, l.from_bin_id),
            l.qty, l.unit_cost
    from public.inventory_doc_lines l
    where l.doc_id = v_doc.id;

    perform public.apply_stock_delta(
      l.part_id,
      v_doc.warehouse_id,
      coalesce(l.to_bin_id, l.from_bin_id),
      l.qty
    )
    from public.inventory_doc_lines l
    where l.doc_id = v_doc.id;

  elsif v_doc.doc_type = 'TRANSFER' then
    insert into public.inventory_ledger
      (doc_id, doc_line_id, doc_type, occurred_at, part_id, warehouse_id, bin_id, qty_delta, unit_cost, movement_side)
    select v_doc.id, l.id, v_doc.doc_type, v_now,
            l.part_id, v_doc.from_warehouse_id, l.from_bin_id,
            -l.qty, l.unit_cost, 'OUT'
    from public.inventory_doc_lines l
    where l.doc_id = v_doc.id;

    insert into public.inventory_ledger
      (doc_id, doc_line_id, doc_type, occurred_at, part_id, warehouse_id, bin_id, qty_delta, unit_cost, movement_side)
    select v_doc.id, l.id, v_doc.doc_type, v_now,
            l.part_id, v_doc.to_warehouse_id, l.to_bin_id,
            l.qty, l.unit_cost, 'IN'
    from public.inventory_doc_lines l
    where l.doc_id = v_doc.id;

    perform public.apply_stock_delta(l.part_id, v_doc.from_warehouse_id, l.from_bin_id, -l.qty)
    from public.inventory_doc_lines l
    where l.doc_id = v_doc.id;

    perform public.apply_stock_delta(l.part_id, v_doc.to_warehouse_id, l.to_bin_id, l.qty)
    from public.inventory_doc_lines l
    where l.doc_id = v_doc.id;

  else
    raise exception 'doc_type % no soportado', v_doc.doc_type;
  end if;

  -- 8) Marcar POSTED
  update public.inventory_docs
  set status = 'POSTED',
      posted_at = v_now
  where id = v_doc.id;
end;
$$;

-- =========================================================
-- 2.5 RLS / PERMISSIONS (Supabase)
-- - Basado en public.me_has_permission('perm_code')
-- - Stock/Ledger: solo lectura para usuarios; movimientos solo via funciones
-- =========================================================

-- Enable RLS
alter table public.uoms enable row level security;
alter table public.part_categories enable row level security;
alter table public.parts enable row level security;
alter table public.vendors enable row level security;
alter table public.part_vendors enable row level security;
alter table public.warehouses enable row level security;
alter table public.warehouse_bins enable row level security;

alter table public.stock_on_hand enable row level security;
alter table public.inventory_docs enable row level security;
alter table public.inventory_doc_lines enable row level security;
alter table public.inventory_ledger enable row level security;
alter table public.ticket_part_requests enable row level security;
alter table public.reorder_policies enable row level security;
alter table public.part_costs enable row level security;
alter table public.inventory_doc_counters enable row level security;

-- Helpers: permisos
-- Ajusta estos códigos a tu catálogo real
-- inventory:read, inventory:full_access, inventory:create, inventory:post, inventory:cancel, inventory:reserve
-- (si no existen, créalos con tu sync_permissions)

-- MASTER DATA
drop policy if exists p_uoms_read on public.uoms;
create policy p_uoms_read on public.uoms for select
using (public.me_has_permission('inventory:read'));

drop policy if exists p_uoms_write on public.uoms;
create policy p_uoms_write on public.uoms for all
using (public.me_has_permission('inventory:full_access'))
with check (public.me_has_permission('inventory:full_access'));

drop policy if exists p_part_categories_read on public.part_categories;
create policy p_part_categories_read on public.part_categories for select
using (public.me_has_permission('inventory:read'));

drop policy if exists p_part_categories_write on public.part_categories;
create policy p_part_categories_write on public.part_categories for all
using (public.me_has_permission('inventory:full_access'))
with check (public.me_has_permission('inventory:full_access'));

drop policy if exists p_parts_read on public.parts;
create policy p_parts_read on public.parts for select
using (public.me_has_permission('inventory:read'));

drop policy if exists p_parts_write on public.parts;
create policy p_parts_write on public.parts for all
using (public.me_has_permission('inventory:full_access'))
with check (public.me_has_permission('inventory:full_access'));

drop policy if exists p_vendors_read on public.vendors;
create policy p_vendors_read on public.vendors for select
using (public.me_has_permission('inventory:read'));

drop policy if exists p_vendors_write on public.vendors;
create policy p_vendors_write on public.vendors for all
using (public.me_has_permission('inventory:full_access'))
with check (public.me_has_permission('inventory:full_access'));

drop policy if exists p_wh_read on public.warehouses;
create policy p_wh_read on public.warehouses for select
using (public.me_has_permission('inventory:read'));

drop policy if exists p_wh_write on public.warehouses;
create policy p_wh_write on public.warehouses for all
using (public.me_has_permission('inventory:full_access'))
with check (public.me_has_permission('inventory:full_access'));
drop policy if exists p_bins_read on public.warehouse_bins;
create policy p_bins_read on public.warehouse_bins for select
using (public.me_has_permission('inventory:read'));

drop policy if exists p_bins_write on public.warehouse_bins;
create policy p_bins_write on public.warehouse_bins for all
using (public.me_has_permission('inventory:full_access'))
with check (public.me_has_permission('inventory:full_access'));

-- DOCS / LINES
drop policy if exists p_docs_read on public.inventory_docs;
create policy p_docs_read on public.inventory_docs for select
using (public.me_has_permission('inventory:read'));

drop policy if exists p_docs_all on public.inventory_docs;
CREATE POLICY p_docs_all ON public.inventory_docs
  FOR ALL
  TO authenticated
  USING ( public.me_has_permission('inventory:create') )
  WITH CHECK ( public.me_has_permission('inventory:create') );

drop policy if exists p_doc_lines_read on public.inventory_doc_lines;
create policy p_doc_lines_read on public.inventory_doc_lines for select
using (public.me_has_permission('inventory:read'));

drop policy if exists p_doc_lines_all on public.inventory_doc_lines;
CREATE POLICY p_doc_lines_all ON public.inventory_doc_lines
  FOR ALL
  TO authenticated
  USING ( public.me_has_permission('inventory:create') )
  WITH CHECK ( public.me_has_permission('inventory:create') );

-- STOCK / LEDGER (read-only)
drop policy if exists p_stock_read on public.stock_on_hand;
create policy p_stock_read on public.stock_on_hand for select
using (public.me_has_permission('inventory:read'));

drop policy if exists p_stock_all on public.stock_on_hand;
drop policy if exists p_stock_write on public.stock_on_hand;

drop policy if exists p_ledger_read on public.inventory_ledger;
create policy p_ledger_read on public.inventory_ledger for select
using (public.me_has_permission('inventory:read'));

drop policy if exists p_ledger_all on public.inventory_ledger;
drop policy if exists p_ledger_write on public.inventory_ledger;

-- REQUESTS / REORDER / COST
drop policy if exists p_ticket_req_read on public.ticket_part_requests;
create policy p_ticket_req_read on public.ticket_part_requests for select
using (public.me_has_permission('inventory:read'));

drop policy if exists p_ticket_req_all on public.ticket_part_requests;
CREATE POLICY p_ticket_req_all ON public.ticket_part_requests
  FOR ALL
  TO authenticated
  USING ( public.me_has_permission('inventory:create') )
  WITH CHECK ( public.me_has_permission('inventory:create') );

drop policy if exists p_reorder_read on public.reorder_policies;
create policy p_reorder_read on public.reorder_policies for select
using (public.me_has_permission('inventory:read'));

drop policy if exists p_reorder_all on public.reorder_policies;
CREATE POLICY p_reorder_all ON public.reorder_policies
  FOR ALL
  TO authenticated
  USING ( public.me_has_permission('inventory:full_access') )
  WITH CHECK ( public.me_has_permission('inventory:full_access') );

drop policy if exists p_costs_read on public.part_costs;
create policy p_costs_read on public.part_costs for select
using (public.me_has_permission('inventory:read'));

drop policy if exists p_costs_all on public.part_costs;
drop policy if exists p_costs_write on public.part_costs;

-- counters: nadie los toca directo desde app
drop policy if exists p_counters_none on public.inventory_doc_counters;
create policy p_counters_none on public.inventory_doc_counters for select
using (false);

-- Hard restrict writes directly to stock/ledger from app roles
revoke insert, update, delete on public.stock_on_hand from anon, authenticated;
revoke insert, update, delete on public.inventory_ledger from anon, authenticated;
revoke insert, update, delete on public.part_costs from anon, authenticated;
revoke insert, update, delete on public.inventory_doc_counters from anon, authenticated;

grant select on public.stock_on_hand to anon, authenticated;
grant select on public.inventory_ledger to anon, authenticated;
grant select on public.part_costs to anon, authenticated;

-- =========================================================
-- PATCH: stock_on_hand key hardening (NULL bin as real key)
-- - Evita duplicados lógicos (part,warehouse,NULL bin)
-- - Deduplica datos existentes antes de crear la restricción
-- =========================================================

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.stock_on_hand'::regclass
      and conname = 'stock_on_hand_part_id_warehouse_id_bin_id_key'
  ) then
    alter table public.stock_on_hand
      drop constraint stock_on_hand_part_id_warehouse_id_bin_id_key;
  end if;
exception when undefined_table then
  null;
end$$;

with ranked as (
  select
    s.id,
    s.part_id,
    s.warehouse_id,
    s.bin_id,
    row_number() over (
      partition by s.part_id, s.warehouse_id, s.bin_id
      order by s.id
    ) as rn,
    sum(s.qty) over (
      partition by s.part_id, s.warehouse_id, s.bin_id
    ) as qty_sum
  from public.stock_on_hand s
), upd as (
  update public.stock_on_hand s
  set qty = r.qty_sum,
      updated_at = public.now_santo_domingo()
  from ranked r
  where s.id = r.id
    and r.rn = 1
  returning s.id
)
delete from public.stock_on_hand s
using ranked r
where s.id = r.id
  and r.rn > 1;

do $$
begin
  -- Requiere PostgreSQL 15+ para UNIQUE NULLS NOT DISTINCT.
  if current_setting('server_version_num')::int < 150000 then
    raise exception
      'Este script requiere PostgreSQL 15+ (UNIQUE NULLS NOT DISTINCT en stock_on_hand).';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.stock_on_hand'::regclass
      and conname = 'ux_stock_on_hand_part_wh_bin'
  ) then
    execute '
      alter table public.stock_on_hand
      add constraint ux_stock_on_hand_part_wh_bin
      unique nulls not distinct (part_id, warehouse_id, bin_id)
    ';
  end if;
exception when undefined_table then
  null;
end$$;


-- =========================================================
-- PATCH: Reservas solo para WO + Vista disponibilidad real
-- =========================================================

-- =========================================================
-- 1) RESERVAS solo si ticket está aceptado (WO)
-- =========================================================

create or replace function public.reserve_ticket_part(
  p_ticket_id bigint,
  p_part_id uuid,
  p_warehouse_id uuid,
  p_qty numeric,
  p_allow_backorder boolean default false
) returns void
language plpgsql
as $$
declare
  v_now timestamptz := public.now_santo_domingo();
  v_on_hand numeric := 0;
  v_reserved numeric := 0;
  v_is_accepted boolean := false;
begin
  if not (
    coalesce(public.me_has_permission('inventory:work'), false)
    or coalesce(public.me_has_permission('inventory:create'), false)
    or coalesce(public.me_has_permission('inventory:full_access'), false)
  ) then
    raise exception 'No autorizado para reservar repuestos de WO.';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'reserved qty debe ser > 0';
  end if;

  -- ✅ validar que el ticket sea WO (aceptado)
  select t.is_accepted
    into v_is_accepted
  from public.tickets t
  where t.id = p_ticket_id;

  if coalesce(v_is_accepted,false) = false then
    raise exception
      'Ticket % no está aceptado (no es WO). No se permite reservar repuestos.',
      p_ticket_id;
  end if;

  -- Lock stock rows del part+warehouse (todas las bins) para consistencia
  perform 1
  from public.stock_on_hand s
  where s.part_id = p_part_id and s.warehouse_id = p_warehouse_id
  for update;

  select coalesce(sum(s.qty),0)
    into v_on_hand
  from public.stock_on_hand s
  where s.part_id = p_part_id and s.warehouse_id = p_warehouse_id;

  -- Lock reservas existentes para este part+warehouse
  perform 1
  from public.ticket_part_requests r
  where r.part_id = p_part_id and r.warehouse_id = p_warehouse_id
  for update;

  select coalesce(sum(r.reserved_qty),0)
    into v_reserved
  from public.ticket_part_requests r
  where r.part_id = p_part_id and r.warehouse_id = p_warehouse_id;

  if not p_allow_backorder then
    if (v_on_hand - v_reserved) < p_qty then
      raise exception
        'Stock disponible insuficiente para reservar. OnHand=%, Reserved=%, Requested=%',
        v_on_hand, v_reserved, p_qty;
    end if;
  end if;

  insert into public.ticket_part_requests(
    ticket_id, part_id, warehouse_id,
    requested_qty, reserved_qty, issued_qty, returned_qty,
    created_at, updated_at
  )
  values (
    p_ticket_id, p_part_id, p_warehouse_id,
    p_qty, p_qty, 0, 0,
    v_now, v_now
  )
  on conflict (ticket_id, part_id, warehouse_id)
  do update set
    requested_qty = public.ticket_part_requests.requested_qty + excluded.requested_qty,
    reserved_qty  = public.ticket_part_requests.reserved_qty + excluded.reserved_qty,
    updated_at    = v_now;
end;
$$;

-- =========================================================
-- 1.1) ENTREGA / CONSUMO por WO (ISSUE)
-- - Crea doc ISSUE (DRAFT), líneas y postea en una sola transacción
-- - Si no se envía from_bin y el warehouse usa bins:
--   asigna automáticamente desde bins con stock disponible
-- =========================================================

create or replace function public.issue_ticket_part(
  p_ticket_id bigint,
  p_part_id uuid,
  p_warehouse_id uuid,
  p_qty numeric,
  p_from_bin_id uuid default null,
  p_reference text default null,
  p_notes text default null
) returns uuid
language plpgsql
as $$
declare
  v_now timestamptz := public.now_santo_domingo();
  v_doc_id uuid;
  v_uom_id uuid;
  v_reserved numeric := 0;
  v_bin_qty numeric := 0;
  v_is_accepted boolean := false;
  v_has_bins boolean := false;
  v_remaining numeric := 0;
  v_line_no int := 1;
  v_from_bin uuid := p_from_bin_id;
  r record;
begin
  if not (
    coalesce(public.me_has_permission('inventory:work'), false)
    or coalesce(public.me_has_permission('inventory:create'), false)
    or coalesce(public.me_has_permission('inventory:full_access'), false)
  ) then
    raise exception 'No autorizado para entregar repuestos de WO.';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'qty debe ser > 0';
  end if;

  select t.is_accepted
    into v_is_accepted
  from public.tickets t
  where t.id = p_ticket_id;

  if coalesce(v_is_accepted,false) = false then
    raise exception
      'Ticket % no está aceptado (no es WO). No se permite consumo.',
      p_ticket_id;
  end if;

  select p.uom_id
    into v_uom_id
  from public.parts p
  where p.id = p_part_id;

  if v_uom_id is null then
    raise exception 'Part % no existe o no tiene uom_id.', p_part_id;
  end if;

  select coalesce(rq.reserved_qty,0)
    into v_reserved
  from public.ticket_part_requests rq
  where rq.ticket_id = p_ticket_id
    and rq.part_id = p_part_id
    and rq.warehouse_id = p_warehouse_id
  for update;

  if not found then
    raise exception
      'No existe reserva para este ticket/repuesto/almacén. Debes reservar antes de entregar.';
  end if;

  if v_reserved < p_qty then
    raise exception
      'No puedes entregar más de lo reservado. Reserved=%, Requested=%',
      v_reserved, p_qty;
  end if;

  select exists (
    select 1
    from public.warehouse_bins b
    where b.warehouse_id = p_warehouse_id
      and b.is_active = true
  ) into v_has_bins;

  if v_from_bin is not null then
    if not exists (
      select 1
      from public.warehouse_bins b
      where b.id = v_from_bin
        and b.warehouse_id = p_warehouse_id
        and b.is_active = true
    ) then
      raise exception 'from_bin_id no pertenece al warehouse seleccionado.';
    end if;

    perform 1
    from public.stock_on_hand s
    where s.part_id = p_part_id
      and s.warehouse_id = p_warehouse_id
      and s.bin_id = v_from_bin
    for update;

    select coalesce(sum(s.qty),0)
      into v_bin_qty
    from public.stock_on_hand s
    where s.part_id = p_part_id
      and s.warehouse_id = p_warehouse_id
      and s.bin_id = v_from_bin;

    if v_bin_qty < p_qty then
      raise exception
        'Stock insuficiente en el bin seleccionado. Available=%, Requested=%',
        v_bin_qty, p_qty;
    end if;
  end if;

  insert into public.inventory_docs(
    doc_type, status, warehouse_id, ticket_id, reference, notes,
    created_at, updated_at
  )
  values (
    'ISSUE'::public.inventory_doc_type,
    'DRAFT'::public.inventory_doc_status,
    p_warehouse_id,
    p_ticket_id,
    coalesce(p_reference, 'WO #' || p_ticket_id::text || ' ISSUE'),
    p_notes,
    v_now, v_now
  )
  returning id into v_doc_id;

  if not v_has_bins then
    insert into public.inventory_doc_lines(
      doc_id, line_no, part_id, uom_id, qty, unit_cost,
      from_bin_id, to_bin_id, notes, created_at, updated_at
    )
    values (
      v_doc_id, 1, p_part_id, v_uom_id, p_qty, null,
      null, null, p_notes, v_now, v_now
    );
  elsif v_from_bin is not null then
    insert into public.inventory_doc_lines(
      doc_id, line_no, part_id, uom_id, qty, unit_cost,
      from_bin_id, to_bin_id, notes, created_at, updated_at
    )
    values (
      v_doc_id, 1, p_part_id, v_uom_id, p_qty, null,
      v_from_bin, null, p_notes, v_now, v_now
    );
  else
    v_remaining := p_qty;

    for r in
      select s.bin_id, s.qty
      from public.stock_on_hand s
      where s.part_id = p_part_id
        and s.warehouse_id = p_warehouse_id
        and s.bin_id is not null
        and s.qty > 0
      order by s.qty desc, s.updated_at asc
      for update
    loop
      exit when v_remaining <= 0;

      insert into public.inventory_doc_lines(
        doc_id, line_no, part_id, uom_id, qty, unit_cost,
        from_bin_id, to_bin_id, notes, created_at, updated_at
      )
      values (
        v_doc_id, v_line_no, p_part_id, v_uom_id, least(r.qty, v_remaining), null,
        r.bin_id, null, p_notes, v_now, v_now
      );

      v_remaining := v_remaining - least(r.qty, v_remaining);
      v_line_no := v_line_no + 1;
    end loop;

    if v_remaining > 0 then
      raise exception
        'No hay stock suficiente en bins para entregar la cantidad solicitada. Faltante=%',
        v_remaining;
    end if;
  end if;

  perform public.post_inventory_doc(v_doc_id);
  return v_doc_id;
end;
$$;

-- =========================================================
-- 1.2) DEVOLUCIÓN por WO (RETURN)
-- - Crea doc RETURN y lo postea en una sola transacción
-- - Valida que qty <= (issued - returned) para ese ticket/part/warehouse
-- =========================================================

create or replace function public.return_ticket_part(
  p_ticket_id bigint,
  p_part_id uuid,
  p_warehouse_id uuid,
  p_qty numeric,
  p_to_bin_id uuid default null,
  p_reference text default null,
  p_notes text default null
) returns uuid
language plpgsql
as $$
declare
  v_now timestamptz := public.now_santo_domingo();
  v_doc_id uuid;
  v_uom_id uuid;
  v_returnable numeric := 0;
  v_is_accepted boolean := false;
  v_has_bins boolean := false;
  v_to_bin uuid := p_to_bin_id;
begin
  if not (
    coalesce(public.me_has_permission('inventory:work'), false)
    or coalesce(public.me_has_permission('inventory:create'), false)
    or coalesce(public.me_has_permission('inventory:full_access'), false)
  ) then
    raise exception 'No autorizado para devolver repuestos de WO.';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'qty debe ser > 0';
  end if;

  select t.is_accepted
    into v_is_accepted
  from public.tickets t
  where t.id = p_ticket_id;

  if coalesce(v_is_accepted,false) = false then
    raise exception
      'Ticket % no está aceptado (no es WO). No se permite devolución.',
      p_ticket_id;
  end if;

  select p.uom_id
    into v_uom_id
  from public.parts p
  where p.id = p_part_id;

  if v_uom_id is null then
    raise exception 'Part % no existe o no tiene uom_id.', p_part_id;
  end if;

  select coalesce(rq.issued_qty - rq.returned_qty,0)
    into v_returnable
  from public.ticket_part_requests rq
  where rq.ticket_id = p_ticket_id
    and rq.part_id = p_part_id
    and rq.warehouse_id = p_warehouse_id
  for update;

  if v_returnable < p_qty then
    raise exception
      'No puedes devolver más de lo entregado pendiente de devolución. Returnable=%, Requested=%',
      v_returnable, p_qty;
  end if;

  select exists (
    select 1
    from public.warehouse_bins b
    where b.warehouse_id = p_warehouse_id
      and b.is_active = true
  ) into v_has_bins;

  if v_to_bin is not null then
    if not exists (
      select 1
      from public.warehouse_bins b
      where b.id = v_to_bin
        and b.warehouse_id = p_warehouse_id
        and b.is_active = true
    ) then
      raise exception 'to_bin_id no pertenece al warehouse seleccionado.';
    end if;
  elsif v_has_bins then
    -- intenta volver al último bin de salida para ese ticket/part
    select l.bin_id
      into v_to_bin
    from public.inventory_ledger l
    join public.inventory_docs d on d.id = l.doc_id
    where d.ticket_id = p_ticket_id
      and d.doc_type = 'ISSUE'
      and d.status = 'POSTED'
      and l.part_id = p_part_id
      and l.warehouse_id = p_warehouse_id
      and l.bin_id is not null
      and l.qty_delta < 0
    order by l.occurred_at desc
    limit 1;

    if v_to_bin is null then
      select b.id
        into v_to_bin
      from public.warehouse_bins b
      where b.warehouse_id = p_warehouse_id
        and b.is_active = true
      order by b.code asc
      limit 1;
    end if;
  end if;

  insert into public.inventory_docs(
    doc_type, status, warehouse_id, ticket_id, reference, notes,
    created_at, updated_at
  )
  values (
    'RETURN'::public.inventory_doc_type,
    'DRAFT'::public.inventory_doc_status,
    p_warehouse_id,
    p_ticket_id,
    coalesce(p_reference, 'WO #' || p_ticket_id::text || ' RETURN'),
    p_notes,
    v_now, v_now
  )
  returning id into v_doc_id;

  insert into public.inventory_doc_lines(
    doc_id, line_no, part_id, uom_id, qty, unit_cost,
    from_bin_id, to_bin_id, notes, created_at, updated_at
  )
  values (
    v_doc_id, 1, p_part_id, v_uom_id, p_qty, null,
    null, v_to_bin, p_notes, v_now, v_now
  );

  perform public.post_inventory_doc(v_doc_id);
  return v_doc_id;
end;
$$;

-- =========================================================
-- 1.3) LIBERAR RESERVA (sin movimiento físico de stock)
-- - Reduce reserved_qty y requested_qty de forma consistente
-- =========================================================

create or replace function public.release_ticket_part_reservation(
  p_ticket_id bigint,
  p_part_id uuid,
  p_warehouse_id uuid,
  p_qty numeric
) returns void
language plpgsql
as $$
declare
  v_row public.ticket_part_requests%rowtype;
  v_reserved numeric := 0;
  v_new_reserved numeric := 0;
  v_new_requested numeric := 0;
begin
  if not (
    coalesce(public.me_has_permission('inventory:work'), false)
    or coalesce(public.me_has_permission('inventory:create'), false)
    or coalesce(public.me_has_permission('inventory:full_access'), false)
  ) then
    raise exception 'No autorizado para liberar reservas de WO.';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'qty debe ser > 0';
  end if;

  select rq.*
    into v_row
  from public.ticket_part_requests rq
  where rq.ticket_id = p_ticket_id
    and rq.part_id = p_part_id
    and rq.warehouse_id = p_warehouse_id
  for update;

  if not found then
    raise exception
      'No existe reserva para este ticket/repuesto/almacén.';
  end if;

  v_reserved := coalesce(v_row.reserved_qty, 0);

  if v_reserved < p_qty then
    raise exception
      'No puedes liberar más de lo reservado. Reserved=%, Requested=%',
      v_reserved, p_qty;
  end if;

  v_new_reserved := v_row.reserved_qty - p_qty;
  v_new_requested := greatest(v_row.requested_qty - p_qty, v_row.issued_qty);

  if v_new_reserved = 0 and v_new_requested = 0 and v_row.issued_qty = 0 and v_row.returned_qty = 0 then
    delete from public.ticket_part_requests rq
    where rq.id = v_row.id;
    return;
  end if;

  update public.ticket_part_requests rq
  set reserved_qty = v_new_reserved,
      requested_qty = v_new_requested,
      updated_at = public.now_santo_domingo()
  where rq.id = v_row.id;
end;
$$;

-- =========================================================
-- 2) VISTA: v_available_stock
-- - disponibilidad real = on_hand - reserved_total
-- - por repuesto + warehouse (y con label)
-- =========================================================

create or replace view public.v_available_stock
with (security_invoker = on)
 as
with onhand as (
  select
    s.part_id,
    s.warehouse_id,
    coalesce(sum(s.qty),0) as on_hand_qty
  from public.stock_on_hand s
  group by s.part_id, s.warehouse_id
),
reserved as (
  select
    r.part_id,
    r.warehouse_id,
    coalesce(sum(r.reserved_qty),0) as reserved_qty
  from public.ticket_part_requests r
  group by r.part_id, r.warehouse_id
)
select
  p.id as part_id,
  p.code as part_code,
  p.name as part_name,
  w.id as warehouse_id,
  w.code as warehouse_code,
  w.name as warehouse_name,

  coalesce(o.on_hand_qty, 0) as on_hand_qty,
  coalesce(rv.reserved_qty, 0) as reserved_qty,
  greatest(coalesce(o.on_hand_qty, 0) - coalesce(rv.reserved_qty, 0), 0) as available_qty

from public.parts p
cross join public.warehouses w
left join onhand o
  on o.part_id = p.id and o.warehouse_id = w.id
left join reserved rv
  on rv.part_id = p.id and rv.warehouse_id = w.id
where p.is_active = true
  and w.is_active = true;

-- índice útil si filtras por repuesto/warehouse desde UI
-- (es una view, el índice sería sobre tablas base; ya tienes idx_stock_part_wh y unique ticket_part_requests)

-- =========================================================
-- SECURITY DEFINER for critical functions (RPC-only movement)
-- - Ejecutar al FINAL para asegurar que aplica sobre la última versión
-- - En Supabase normalmente el owner (postgres) bypass RLS
-- =========================================================

-- Mark as SECURITY DEFINER
alter function public.post_inventory_doc(uuid) security definer;
alter function public.cancel_inventory_doc(uuid) security definer;
alter function public.create_reversal_doc(uuid) security definer;
alter function public.next_inventory_doc_no(inventory_doc_type) security definer;
alter function public.reserve_ticket_part(bigint, uuid, uuid, numeric, boolean) security definer;
alter function public.issue_ticket_part(bigint, uuid, uuid, numeric, uuid, text, text) security definer;
alter function public.return_ticket_part(bigint, uuid, uuid, numeric, uuid, text, text) security definer;
alter function public.release_ticket_part_reservation(bigint, uuid, uuid, numeric) security definer;

-- Defensive search_path
alter function public.post_inventory_doc(uuid) set search_path = public;
alter function public.cancel_inventory_doc(uuid) set search_path = public;
alter function public.create_reversal_doc(uuid) set search_path = public;
alter function public.next_inventory_doc_no(inventory_doc_type) set search_path = public;
alter function public.reserve_ticket_part(bigint, uuid, uuid, numeric, boolean) set search_path = public;
alter function public.issue_ticket_part(bigint, uuid, uuid, numeric, uuid, text, text) set search_path = public;
alter function public.return_ticket_part(bigint, uuid, uuid, numeric, uuid, text, text) set search_path = public;
alter function public.release_ticket_part_reservation(bigint, uuid, uuid, numeric) set search_path = public;

-- Grants de ejecución (solo autenticados)
grant execute on function public.post_inventory_doc(uuid) to authenticated;
grant execute on function public.cancel_inventory_doc(uuid) to authenticated;
grant execute on function public.reserve_ticket_part(bigint, uuid, uuid, numeric, boolean) to authenticated;
grant execute on function public.issue_ticket_part(bigint, uuid, uuid, numeric, uuid, text, text) to authenticated;
grant execute on function public.return_ticket_part(bigint, uuid, uuid, numeric, uuid, text, text) to authenticated;
grant execute on function public.release_ticket_part_reservation(bigint, uuid, uuid, numeric) to authenticated;
