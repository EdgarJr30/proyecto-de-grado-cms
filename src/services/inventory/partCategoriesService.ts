import type { ListParams, UUID } from '../../types/inventory';
import type {
  PartCategoryInsert,
  PartCategoryRow,
  PartCategoryUpdate,
} from '../../types/inventory';
import { inv } from './inventoryClient';

export async function listPartCategories(params: ListParams = {}) {
  const {
    limit = 500,
    offset = 0,
    orderBy = 'name',
    ascending = true,
  } = params;

  const { data, error } = await inv()
    .from('part_categories')
    .select('*')
    .order(orderBy, { ascending })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as PartCategoryRow[];
}

export async function createPartCategory(payload: PartCategoryInsert) {
  const { data, error } = await inv()
    .from('part_categories')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as PartCategoryRow;
}

export async function updatePartCategory(id: UUID, patch: PartCategoryUpdate) {
  const { data, error } = await inv()
    .from('part_categories')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as PartCategoryRow;
}

export async function deletePartCategory(id: UUID) {
  const { error } = await inv().from('part_categories').delete().eq('id', id);
  if (error) throw error;
}
