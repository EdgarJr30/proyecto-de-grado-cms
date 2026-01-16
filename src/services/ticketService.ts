import { supabase } from "../lib/supabaseClient";
import type { Ticket, WorkOrder } from "../types/Ticket";
import type { FilterState } from "../types/filters";
import type { WorkRequestsFilterKey } from "../features/tickets/workRequestsFilters";

const PAGE_SIZE = 20;
type Status = Ticket["status"];
export type TicketCounts = Record<Status, number>;

/** ===== Tipos nuevos para aceptación con responsable ===== */
export type AcceptTicketItem = { id: number; assignee_id: number };
export type AcceptTicketsInput = string[] | AcceptTicketItem[];

/**
 * Normaliza el rango de fechas a límites del día (00:00:00 / 23:59:59).
 */
function normalizeDateRange(
  v: FilterState<WorkRequestsFilterKey>['created_at']
): { from?: string; to?: string } | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const from = (v as { from?: string }).from;
  const to   = (v as { to?: string }).to;
  return {
    from: from ? `${from} 00:00:00` : undefined,
    to:   to   ? `${to} 23:59:59`   : undefined,
  };
}

export async function createTicket(
  ticket: Omit<Ticket, "id" | "status" | "created_by" | 'is_archived' | 'finalized_at'>
) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error("No hay sesión activa.");

  const { data, error } = await supabase
    .from("tickets")
    .insert([{
      ...ticket,
      status: "Pendiente",
      assignee: "Sin asignar",
      assignee_id: null,
      created_by: user.id,
      is_archived: false,
      finalized_at: null,
    }])
    .select("id, title")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getAllTickets(page: number): Promise<Ticket[]> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq('is_archived', false) 
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Error al obtener tickets:", error.message);
    return [];
  }

  return data as Ticket[];
}

export async function updateTicket(id: number, updatedData: Partial<Ticket>) {
  const { error } = await supabase
    .from("tickets")
    .update(updatedData)
    .eq("id", id);

  if (error) {
    throw new Error(`Error al actualizar el ticket: ${error.message}`);
  }
}

export async function getTicketsByUserId(userId: string): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Ticket[];
}

export async function getTicketsByStatusPaginated(
  status: Ticket['status'],
  page: number,
  pageSize: number,
  location?: string
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("v_tickets_compat")
    .select("*")
    .eq("status", status)
    .eq("is_accepted", true)
    .eq('is_archived', false)
    .order("id", { ascending: false })
    .range(from, to);

  if (status === "Pendiente") {
    query = query.eq("is_accepted", true);
  }
  if (location) {
    query = query.eq("location", location);
  }

  const { data, error } = await query;

  if (error) {
    console.error(`❌ Error al cargar tickets con estado "${status}":`, error.message);
    return [];
  }
  return data as unknown as WorkOrder[];
}

export async function getFilteredTickets(
  term: string,
  location?: string,
  isAccepted?: boolean
): Promise<Ticket[]> {
  let query = supabase
    .from("v_tickets_compat")
    .select("*")
    .eq('is_archived', false) 
    .order("id", { ascending: false });

  if (typeof isAccepted === "boolean") {
    query = query.eq("is_accepted", isAccepted);
  }

  if (location) {
    query = query.eq("location", location);
  }

  if (term.length >= 2) {
    const filters = [
      `title.ilike.%${term}%`,
      `requester.ilike.%${term}%`,
    ];
    if (!isNaN(Number(term))) filters.push(`id.eq.${term}`);
    query = query.or(filters.join(","));
  }

  const { data, error } = await query;
  if (error) {
    console.error("❌ Error buscando tickets:", error.message);
    return [];
  }
  return (data ?? []) as unknown as WorkOrder[];
}

export async function getUnacceptedTicketsPaginated(
  page: number,
  pageSize: number,
  location?: string
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("tickets")
    .select("*", { count: "exact" })
    .eq("is_accepted", false)
    .eq('is_archived', false) 
    .order("id", { ascending: false })
    .range(from, to);

  if (location) {
    query = query.eq("location", location);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("❌ Error al cargar tickets no aceptados:", error.message);
    return { data: [], count: 0 };
  }

  return { data: data as Ticket[], count: count || 0 };
}

/**
 * Acepta tickets.
 * - NUEVO: si pasas [{id, assignee_id}, ...] asigna responsable y marca is_accepted=true (bulk).
 * - LEGACY: si pasas string[] con ids, primero validamos que ya tengan assignee_id antes de aceptar.
 */
export async function acceptTickets(input: AcceptTicketsInput): Promise<void> {
  // === LEGACY: ids como string[] ===
  if (Array.isArray(input) && input.length && typeof input[0] === "string") {
    const ticketIds = (input as string[]).map(Number);

    // Verifica que (1) existen, (2) no están aceptados y (3) tienen assignee_id
    const { data: rows, error: selErr } = await supabase
      .from("tickets")
      .select("id, assignee_id, is_accepted")
      .in("id", ticketIds);

    if (selErr) throw new Error(selErr.message);

    const pendientes = (rows ?? []).filter(r => !r.is_accepted);
    const sinAsignar = pendientes.filter(r => r.assignee_id == null).map(r => `#${r.id}`);
    if (sinAsignar.length) {
      throw new Error(`No puedes aceptar solicitudes sin responsable. Faltan: ${sinAsignar.join(", ")}`);
    }

    const idsPend = pendientes.map(r => r.id);
    if (idsPend.length) {
      const { error } = await supabase
        .from("tickets")
        .update({ is_accepted: true })
        .in("id", idsPend)
        .eq("is_accepted", false);

      if (error) throw new Error(error.message);
    }
    return;
  }

  // === NUEVO: [{ id, assignee_id }, ...] ===
  const items = (input as AcceptTicketItem[]) ?? [];
  if (!items.length) return;

  for (const it of items) {
    if (!it.id || !it.assignee_id) {
      throw new Error("Cada ticket debe incluir { id, assignee_id } para aceptar.");
    }
  }

  // UPDATE por fila (evita INSERTs accidentales del upsert)
  const updates = items.map(({ id, assignee_id }) =>
    supabase
      .from("tickets")
      .update({ assignee_id, is_accepted: true /*, status: 'Aprobada'*/ })
      .eq("id", id)
      .eq("is_accepted", false) // sólo solicitudes
      .select("id")             // para saber si realmente actualizó
  );

  const results = await Promise.all(updates);

  // Si hubo algún error en un UPDATE, lánzalo
  const firstErr = results.find(r => r.error);
  if (firstErr?.error) throw new Error(firstErr.error.message);

  // Detecta casos donde no se actualizó nada (id inexistente o ya aceptado)
  const notUpdated: number[] = [];
  results.forEach((r, i) => {
    const changed = Array.isArray(r.data) && r.data.length > 0;
    if (!changed) notUpdated.push(items[i].id);
  });

  if (notUpdated.length) {
    throw new Error(
      `No se pudieron aceptar: ${notUpdated.join(
        ", "
      )} (no existen, ya estaban aceptados o no tienes permiso).`
    );
  }
}

/** RPC de conteos (sin cambios) */
export async function getTicketCountsRPC(filters?: {
  term?: string;
  location?: string;
}): Promise<TicketCounts> {
  const { data, error } = await supabase.rpc("ticket_counts", {
    p_location: filters?.location ?? null,
    p_term: filters?.term ?? null,
  });

  if (error) {
    console.error("RPC ticket_counts error:", error.message);
  }

  const out: TicketCounts = {
    "Pendiente": 0,
    "En Ejecución": 0,
    "Finalizadas": 0,
  };

  (data as { status: Status; total: number }[] | null | undefined)?.forEach(
    (row) => {
      if (row?.status && typeof row.total === "number") {
        out[row.status] = row.total;
      }
    }
  );

  return out;
}

/**
 * Filtra directamente en Supabase (server-side) con paginación y count.
 * SIN serverFiltering.ts y SIN WorkRequestsServerSchema.ts
 * (Para WorkRequests: forzamos is_accepted = false)
 */
export async function getTicketsByFiltersPaginated(
  values: FilterState<WorkRequestsFilterKey>,
  page: number,
  pageSize: number
): Promise<{ data: Ticket[]; count: number }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("tickets")
    .select("*", { count: "exact" })
    .eq("is_accepted", false); 

  const term = typeof values.q === 'string' ? values.q.trim() : '';
  if (term.length >= 2) {
    const ors = [`title.ilike.%${term}%`, `requester.ilike.%${term}%`];
    const n = Number(term);
    if (!Number.isNaN(n)) ors.push(`id.eq.${n}`);
    q = q.or(ors.join(','));
  }

  const location = (values.location as string) || '';
  if (location) q = q.eq("location", location);

  if (typeof values.accepted === 'boolean') {
    q = q.eq("is_accepted", values.accepted);
  }

  const range = normalizeDateRange(values.created_at);
  if (range?.from) q = q.gte("created_at", range.from);
  if (range?.to)   q = q.lte("created_at", range.to);

  if (values.has_image === true) {
    q = q.neq("image", "");
  }

  const priorities = Array.isArray(values.priority)
    ? (values.priority as (string | number)[]).map(String)
    : [];
  if (priorities.length) {
    const PRIORITY_DB: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' };
    const dbValues = priorities.map(p => PRIORITY_DB[p.toLowerCase()] ?? p);
    q = q.in("priority", dbValues);
  }

  const statuses = Array.isArray(values.status)
    ? (values.status as (string | number)[]).map(String)
    : [];
  if (statuses.length) {
    q = q.in("status", statuses);
  }

  const { data, error, count } = await q
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("❌ getTicketsByFiltersPaginated error:", error.message);
    return { data: [], count: 0 };
  }
  return { data: (data ?? []) as Ticket[], count: count ?? 0 };
}

/** Filtrado para WorkOrders (aceptados) */
export async function getTicketsByWorkOrdersFiltersPaginated<TKeys extends string>(
  values: FilterState<TKeys>,
  page: number,
  pageSize: number
): Promise<{ data: WorkOrder[]; count: number }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  // 👇 cambiamos la fuente a la vista que trae los extras:
  let q = supabase
    .from("v_tickets_compat")
    .select("*", { count: "exact" })
    .eq("is_accepted", true)
    .eq('is_archived', false);

  const termRaw = (values as Record<string, unknown>)["q"];
  const term = typeof termRaw === "string" ? termRaw.trim() : "";
  if (term.length >= 2) {
    const ors = [`title.ilike.%${term}%`, `requester.ilike.%${term}%`];
    const n = Number(term);
    if (!Number.isNaN(n)) ors.push(`id.eq.${n}`);
    q = q.or(ors.join(","));
  }

  const locationRaw = (values as Record<string, unknown>)["location"];
  const location = typeof locationRaw === "string" ? locationRaw : undefined;
  if (location) q = q.eq("location", location);

  const assigneeIdRaw = (values as Record<string, unknown>)["assignee_id"];
  if (assigneeIdRaw !== undefined && assigneeIdRaw !== null && assigneeIdRaw !== "") {
    q = q.filter('id', 'in', `(
      select work_order_id from v_work_order_assignees_current
      where assignee_id = ${Number(assigneeIdRaw)}
    )`);
  }

  const createdRaw = (values as Record<string, unknown>)["created_at"];
  if (createdRaw && typeof createdRaw === "object") {
    const { from: dFrom, to: dTo } = createdRaw as { from?: string; to?: string };
    if (dFrom) q = q.gte("created_at", `${dFrom} 00:00:00`);
    if (dTo)   q = q.lte("created_at", `${dTo} 23:59:59`);
  }

  if ((values as Record<string, unknown>)["has_image"] === true) {
    q = q.neq("image", "");
  }

  const prw = (values as Record<string, unknown>)["priority"];
  const priorities = Array.isArray(prw) ? prw.map(String) : [];
  if (priorities.length) q = q.in("priority", priorities);

  const stw = (values as Record<string, unknown>)["status"];
  const statuses = Array.isArray(stw) ? stw.map(String) : [];
  if (statuses.length) q = q.in("status", statuses);

  const { data, error, count } = await q
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("❌ getTicketsByWorkOrdersFiltersPaginated error:", error.message);
    return { data: [], count: 0 };
  }
  return { data: (data ?? []) as WorkOrder[], count: count ?? 0 };
}

export async function archiveTicket(id: number): Promise<void> {
  const { error } = await supabase
    .from('tickets')
    .update({ is_archived: true })
    .eq('id', id)
    .eq('is_archived', false);

  if (error) throw new Error(`No se pudo archivar: ${error.message}`);
}

export async function acceptWorkOrderWithPrimary(workOrderId: number, primaryAssigneeId: number) {
  const { error } = await supabase.rpc('accept_work_order', {
    p_work_order_id: workOrderId,
    p_primary_assignee_id: primaryAssigneeId
  });
  if (error) throw new Error(error.message);
}

export async function setSecondaryAssignees(workOrderId: number, secondaryIds: number[]) {
  const { error } = await supabase.rpc('set_secondary_assignees', {
    p_work_order_id: workOrderId,
    p_secondary_ids: secondaryIds.length ? secondaryIds : null
  });
  if (error) throw new Error(error.message);
}
