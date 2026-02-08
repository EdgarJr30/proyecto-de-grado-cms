import type { UUID } from '../../types/inventory';
import type { StockOnHandRow } from '../../types/inventory';
import { inv } from './inventoryClient';

export async function getStockOnHandByPart(partId: UUID) {
  const { data, error } = await inv()
    .from('stock_on_hand')
    .select('*')
    .eq('part_id', partId);
  if (error) throw error;
  return (data ?? []) as StockOnHandRow[];
}

export async function getStockOnHandByWarehouse(warehouseId: UUID) {
  const { data, error } = await inv()
    .from('stock_on_hand')
    .select('*')
    .eq('warehouse_id', warehouseId);
  if (error) throw error;
  return (data ?? []) as StockOnHandRow[];
}
