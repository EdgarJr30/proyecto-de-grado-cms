import type { ListParams, UUID } from '../../types/inventory';
import type { PartInsert, PartRow, PartUpdate } from '../../types/inventory';
import { inv } from './inventoryClient';

export async function listParts(
  params: ListParams & { is_active?: boolean } = {}
) {
  const {
    limit = 200,
    offset = 0,
    orderBy = 'code',
    ascending = true,
    is_active,
  } = params;

  let q = inv().from('parts').select('*');

  if (typeof is_active === 'boolean') q = q.eq('is_active', is_active);

  const { data, error } = await q
    .order(orderBy, { ascending })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as PartRow[];
}

export async function getPart(id: UUID) {
  const { data, error } = await inv()
    .from('parts')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as PartRow;
}

export async function createPart(payload: PartInsert) {
  const { data, error } = await inv()
    .from('parts')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as PartRow;
}

export async function updatePart(id: UUID, patch: PartUpdate) {
  const { data, error } = await inv()
    .from('parts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as PartRow;
}

export async function deletePart(id: UUID) {
  const { error } = await inv().from('parts').delete().eq('id', id);
  if (error) throw error;
}
