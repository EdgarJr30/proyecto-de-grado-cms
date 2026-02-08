import type { ListParams, UUID } from '../../types/inventory';
import type {
  WarehouseBinInsert,
  WarehouseBinRow,
  WarehouseBinUpdate,
} from '../../types/inventory';
import { inv } from './inventoryClient';

export async function listWarehouseBins(
  warehouseId: UUID,
  params: ListParams & { is_active?: boolean } = {}
) {
  const {
    limit = 500,
    offset = 0,
    orderBy = 'code',
    ascending = true,
    is_active,
  } = params;

  let q = inv()
    .from('warehouse_bins')
    .select('*')
    .eq('warehouse_id', warehouseId);
  if (typeof is_active === 'boolean') q = q.eq('is_active', is_active);

  const { data, error } = await q
    .order(orderBy, { ascending })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as WarehouseBinRow[];
}

export async function createWarehouseBin(payload: WarehouseBinInsert) {
  const { data, error } = await inv()
    .from('warehouse_bins')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as WarehouseBinRow;
}

export async function updateWarehouseBin(id: UUID, patch: WarehouseBinUpdate) {
  const { data, error } = await inv()
    .from('warehouse_bins')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as WarehouseBinRow;
}

export async function deleteWarehouseBin(id: UUID) {
  const { error } = await inv().from('warehouse_bins').delete().eq('id', id);
  if (error) throw error;
}
