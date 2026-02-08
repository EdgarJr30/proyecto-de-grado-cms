import type { UUID, BigIntLike } from '../../types/inventory';
import type {
  VAvailableStockRow,
  VInventoryKardexRow,
  VPartStockSummaryRow,
  VReorderSuggestionsRow,
  VStockByLocationRow,
} from '../../types/inventory';
import { inv } from './inventoryClient';

export async function listPartStockSummary(limit = 500) {
  const { data, error } = await inv()
    .from('v_part_stock_summary')
    .select('*')
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as VPartStockSummaryRow[];
}

export async function listStockByLocation(
  filters: { part_id?: UUID; warehouse_id?: UUID } = {},
  limit = 500
) {
  let q = inv().from('v_stock_by_location').select('*');
  if (filters.part_id) q = q.eq('part_id', filters.part_id);
  if (filters.warehouse_id) q = q.eq('warehouse_id', filters.warehouse_id);

  const { data, error } = await q
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as VStockByLocationRow[];
}

export async function listInventoryKardex(
  filters: { part_id?: UUID; warehouse_id?: UUID; ticket_id?: BigIntLike } = {},
  limit = 500
) {
  let q = inv().from('v_inventory_kardex').select('*');
  if (filters.part_id) q = q.eq('part_id', filters.part_id);
  if (filters.warehouse_id) q = q.eq('warehouse_id', filters.warehouse_id);
  if (typeof filters.ticket_id === 'number')
    q = q.eq('ticket_id', filters.ticket_id);

  const { data, error } = await q
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as VInventoryKardexRow[];
}

export async function listReorderSuggestions(
  filters: { warehouse_id?: UUID; needs_reorder?: boolean } = {},
  limit = 500
) {
  let q = inv().from('v_reorder_suggestions').select('*');
  if (filters.warehouse_id) q = q.eq('warehouse_id', filters.warehouse_id);
  if (typeof filters.needs_reorder === 'boolean')
    q = q.eq('needs_reorder', filters.needs_reorder);

  const { data, error } = await q
    .order('needs_reorder', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as VReorderSuggestionsRow[];
}

export async function listAvailableStock(
  filters: { part_id?: UUID; warehouse_id?: UUID } = {},
  limit = 1000
) {
  let q = inv().from('v_available_stock').select('*');
  if (filters.part_id) q = q.eq('part_id', filters.part_id);
  if (filters.warehouse_id) q = q.eq('warehouse_id', filters.warehouse_id);

  const { data, error } = await q.limit(limit);
  if (error) throw error;
  return (data ?? []) as VAvailableStockRow[];
}
