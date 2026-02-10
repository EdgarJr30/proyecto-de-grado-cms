import { supabase } from '../../lib/supabaseClient';
import type {
  AvailableStockRow,
  TicketPartRequestRow,
  PartPick,
  WarehousePick,
} from '../../types/inventory/inventoryRequests';

function toNumber(x: unknown): number {
  // Supabase puede devolver numeric como string
  if (typeof x === 'number') return x;
  if (typeof x === 'string') return Number(x);
  return 0;
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
