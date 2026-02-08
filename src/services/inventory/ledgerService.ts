import type { UUID } from '../../types/inventory';
import type { InventoryLedgerRow } from '../../types/inventory';
import { inv } from './inventoryClient';

export async function listLedgerByPart(partId: UUID, limit = 200) {
  const { data, error } = await inv()
    .from('inventory_ledger')
    .select('*')
    .eq('part_id', partId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as InventoryLedgerRow[];
}

export async function listLedgerByWarehouse(warehouseId: UUID, limit = 200) {
  const { data, error } = await inv()
    .from('inventory_ledger')
    .select('*')
    .eq('warehouse_id', warehouseId)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as InventoryLedgerRow[];
}
