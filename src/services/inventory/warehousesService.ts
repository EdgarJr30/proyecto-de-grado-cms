import type { ListParams, UUID } from '../../types/inventory';
import type {
  WarehouseInsert,
  WarehouseRow,
  WarehouseUpdate,
} from '../../types/inventory';
import { inv } from './inventoryClient';

export async function listWarehouses(
  params: ListParams & { is_active?: boolean } = {}
) {
  const {
    limit = 200,
    offset = 0,
    orderBy = 'code',
    ascending = true,
    is_active,
  } = params;

  let q = inv().from('warehouses').select('*');
  if (typeof is_active === 'boolean') q = q.eq('is_active', is_active);

  const { data, error } = await q
    .order(orderBy, { ascending })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as WarehouseRow[];
}

export async function createWarehouse(payload: WarehouseInsert) {
  const { data, error } = await inv()
    .from('warehouses')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as WarehouseRow;
}

export async function updateWarehouse(id: UUID, patch: WarehouseUpdate) {
  const { data, error } = await inv()
    .from('warehouses')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as WarehouseRow;
}

export async function deleteWarehouse(id: UUID) {
  const { error } = await inv().from('warehouses').delete().eq('id', id);
  if (error) throw error;
}
