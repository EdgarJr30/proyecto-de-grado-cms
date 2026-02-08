import type {
  ReorderPolicyInsert,
  ReorderPolicyRow,
  ReorderPolicyUpdate,
  UUID,
} from '../../types/inventory';
import { inv } from './inventoryClient';

export async function listReorderPolicies(warehouseId?: UUID) {
  let q = inv().from('reorder_policies').select('*');
  if (warehouseId) q = q.eq('warehouse_id', warehouseId);

  const { data, error } = await q.order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReorderPolicyRow[];
}

export async function upsertReorderPolicy(payload: ReorderPolicyInsert) {
  const { data, error } = await inv()
    .from('reorder_policies')
    .upsert(payload, { onConflict: 'part_id,warehouse_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data as ReorderPolicyRow;
}

export async function updateReorderPolicy(
  id: UUID,
  patch: ReorderPolicyUpdate
) {
  const { data, error } = await inv()
    .from('reorder_policies')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ReorderPolicyRow;
}

export async function deleteReorderPolicy(id: UUID) {
  const { error } = await inv().from('reorder_policies').delete().eq('id', id);
  if (error) throw error;
}
