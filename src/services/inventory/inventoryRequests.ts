import { supabase } from '../../lib/supabaseClient';
import type {
  AvailableStockRow,
  TicketPartRequestRow,
  PartPick,
  TicketWoPick,
  WarehouseBinPick,
  WarehousePick,
} from '../../types/inventory/inventoryRequests';

function normalizeReferenceLabel(value: string): string {
  return value
    .replace(/\bWO\b/gi, 'OT')
    .replace(/\bISSUE\b/gi, 'SALIDA')
    .replace(/\bRETURN\b/gi, 'DEVOLUCION')
    .replace(/\bRECEIPT\b/gi, 'ENTRADA')
    .replace(/\bTRANSFER\b/gi, 'TRANSFERENCIA')
    .replace(/\bADJUSTMENT\b/gi, 'AJUSTE');
}

function buildTicketDocReference(ticketId: number, movement: 'ISSUE' | 'RETURN') {
  return movement === 'ISSUE'
    ? `OT #${ticketId} SALIDA`
    : `OT #${ticketId} DEVOLUCION`;
}

function toNumber(x: unknown): number {
  // Supabase puede devolver numeric como string
  if (typeof x === 'number') return x;
  if (typeof x === 'string') return Number(x);
  return 0;
}

function resolveRequesterName(
  requester: string | null | undefined,
  createdByName: string | null | undefined
): string | null {
  const byCreator =
    typeof createdByName === 'string' ? createdByName.trim() : '';
  if (byCreator) return byCreator;
  const byTicket = typeof requester === 'string' ? requester.trim() : '';
  return byTicket || null;
}

export async function listTicketPartRequests(
  ticketId: number
): Promise<TicketPartRequestRow[]> {
  const { data, error } = await supabase
    .from('ticket_part_requests')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r) => ({
    ...r,
    requested_qty: toNumber(r.requested_qty),
    reserved_qty: toNumber(r.reserved_qty),
    issued_qty: toNumber(r.issued_qty),
    returned_qty: toNumber(r.returned_qty),
  })) as TicketPartRequestRow[];
}

export async function listPartsPick(): Promise<PartPick[]> {
  const { data, error } = await supabase
    .from('parts')
    .select('id,code,name,is_active')
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (error) throw error;
  return (data ?? []) as PartPick[];
}

export async function listWarehousesPick(): Promise<WarehousePick[]> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id,code,name,is_active')
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (error) throw error;
  return (data ?? []) as WarehousePick[];
}

export async function listAcceptedWorkOrders(
  limit = 200
): Promise<TicketWoPick[]> {
  const { data, error } = await supabase
    .from('v_tickets_compat')
    .select(
      'id,title,status,priority,requester,created_by_name,is_accepted,is_archived,created_at'
    )
    .eq('is_accepted', true)
    .eq('is_archived', false)
    .in('status', ['Pendiente', 'En Ejecución'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data ?? []) as Array<
    TicketWoPick & { created_by_name?: string | null }
  >).map((row) => ({
    ...row,
    requester: resolveRequesterName(row.requester, row.created_by_name),
  }));
}

export async function listWarehouseBinsPick(
  warehouseId: string
): Promise<WarehouseBinPick[]> {
  const { data, error } = await supabase
    .from('warehouse_bins')
    .select('id,warehouse_id,code,name,is_active')
    .eq('warehouse_id', warehouseId)
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (error) throw error;
  return (data ?? []) as WarehouseBinPick[];
}

export async function getAvailableStock(
  partId: string,
  warehouseId: string
): Promise<AvailableStockRow | null> {
  const { data, error } = await supabase
    .from('v_available_stock')
    .select('*')
    .eq('part_id', partId)
    .eq('warehouse_id', warehouseId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...(data as AvailableStockRow),
    on_hand_qty: toNumber((data as AvailableStockRow).on_hand_qty),
    reserved_qty: toNumber((data as AvailableStockRow).reserved_qty),
    available_qty: toNumber((data as AvailableStockRow).available_qty),
  };
}

export async function reserveTicketPart(input: {
  ticketId: number;
  partId: string;
  warehouseId: string;
  qty: number;
  allowBackorder?: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('reserve_ticket_part', {
    p_ticket_id: input.ticketId,
    p_part_id: input.partId,
    p_warehouse_id: input.warehouseId,
    p_qty: input.qty,
    p_allow_backorder: input.allowBackorder ?? false,
  });

  if (error) throw error;
}

export async function issueTicketPart(input: {
  ticketId: number;
  partId: string;
  warehouseId: string;
  qty: number;
  fromBinId?: string | null;
  reference?: string | null;
  notes?: string | null;
}): Promise<string> {
  const rawReference = input.reference?.trim() ?? '';
  const reference =
    rawReference.length > 0
      ? normalizeReferenceLabel(rawReference)
      : buildTicketDocReference(input.ticketId, 'ISSUE');

  const { data, error } = await supabase.rpc('issue_ticket_part', {
    p_ticket_id: input.ticketId,
    p_part_id: input.partId,
    p_warehouse_id: input.warehouseId,
    p_qty: input.qty,
    p_from_bin_id: input.fromBinId ?? null,
    p_reference: reference,
    p_notes: input.notes ?? null,
  });

  if (error) throw error;
  return String(data);
}

export async function returnTicketPart(input: {
  ticketId: number;
  partId: string;
  warehouseId: string;
  qty: number;
  toBinId?: string | null;
  reference?: string | null;
  notes?: string | null;
}): Promise<string> {
  const rawReference = input.reference?.trim() ?? '';
  const reference =
    rawReference.length > 0
      ? normalizeReferenceLabel(rawReference)
      : buildTicketDocReference(input.ticketId, 'RETURN');

  const { data, error } = await supabase.rpc('return_ticket_part', {
    p_ticket_id: input.ticketId,
    p_part_id: input.partId,
    p_warehouse_id: input.warehouseId,
    p_qty: input.qty,
    p_to_bin_id: input.toBinId ?? null,
    p_reference: reference,
    p_notes: input.notes ?? null,
  });

  if (error) throw error;
  return String(data);
}

export async function releaseTicketPartReservation(input: {
  ticketId: number;
  partId: string;
  warehouseId: string;
  qty: number;
}): Promise<void> {
  const { error } = await supabase.rpc('release_ticket_part_reservation', {
    p_ticket_id: input.ticketId,
    p_part_id: input.partId,
    p_warehouse_id: input.warehouseId,
    p_qty: input.qty,
  });

  if (error) throw error;
}
