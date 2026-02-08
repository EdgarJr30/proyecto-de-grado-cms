import type { ListParams, UUID } from '../../types/inventory';
import type { UomInsert, UomRow, UomUpdate } from '../../types/inventory';
import { inv } from './inventoryClient';

export async function listUoms(params: ListParams = {}) {
  const {
    limit = 200,
    offset = 0,
    orderBy = 'code',
    ascending = true,
  } = params;

  const { data, error } = await inv()
    .from('uoms')
    .select('*')
    .order(orderBy, { ascending })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as UomRow[];
}

export async function createUom(payload: UomInsert) {
  const { data, error } = await inv()
    .from('uoms')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as UomRow;
}

export async function updateUom(id: UUID, patch: UomUpdate) {
  const { data, error } = await inv()
    .from('uoms')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as UomRow;
}

export async function deleteUom(id: UUID) {
  const { error } = await inv().from('uoms').delete().eq('id', id);
  if (error) throw error;
}
