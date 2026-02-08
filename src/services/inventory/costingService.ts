import type { PartCostRow, UUID } from '../../types/inventory';
import { inv } from './inventoryClient';

export async function getPartCost(partId: UUID, warehouseId: UUID) {
  const { data, error } = await inv()
    .from('part_costs')
    .select('*')
    .eq('part_id', partId)
    .eq('warehouse_id', warehouseId)
    .single();

  if (error) throw error;
  return data as PartCostRow;
}

export async function listPartCostsByWarehouse(warehouseId: UUID) {
  const { data, error } = await inv()
    .from('part_costs')
    .select('*')
    .eq('warehouse_id', warehouseId);
  if (error) throw error;
  return (data ?? []) as PartCostRow[];
}
