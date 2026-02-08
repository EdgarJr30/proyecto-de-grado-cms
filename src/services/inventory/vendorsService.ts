import type { ListParams, UUID } from '../../types/inventory';
import type {
  VendorInsert,
  VendorRow,
  VendorUpdate,
  PartVendorInsert,
  PartVendorRow,
  PartVendorUpdate,
} from '../../types/inventory';
import { inv } from './inventoryClient';

export async function listVendors(
  params: ListParams & { is_active?: boolean } = {}
) {
  const {
    limit = 200,
    offset = 0,
    orderBy = 'name',
    ascending = true,
    is_active,
  } = params;

  let q = inv().from('vendors').select('*');
  if (typeof is_active === 'boolean') q = q.eq('is_active', is_active);

  const { data, error } = await q
    .order(orderBy, { ascending })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as VendorRow[];
}

export async function createVendor(payload: VendorInsert) {
  const { data, error } = await inv()
    .from('vendors')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as VendorRow;
}

export async function updateVendor(id: UUID, patch: VendorUpdate) {
  const { data, error } = await inv()
    .from('vendors')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as VendorRow;
}

export async function deleteVendor(id: UUID) {
  const { error } = await inv().from('vendors').delete().eq('id', id);
  if (error) throw error;
}

export async function listPartVendors(partId: UUID) {
  const { data, error } = await inv()
    .from('part_vendors')
    .select('*')
    .eq('part_id', partId);
  if (error) throw error;
  return (data ?? []) as PartVendorRow[];
}

export async function upsertPartVendor(payload: PartVendorInsert) {
  const { data, error } = await inv()
    .from('part_vendors')
    .upsert(payload, { onConflict: 'part_id,vendor_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data as PartVendorRow;
}

export async function updatePartVendor(id: UUID, patch: PartVendorUpdate) {
  const { data, error } = await inv()
    .from('part_vendors')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as PartVendorRow;
}

export async function deletePartVendor(id: UUID) {
  const { error } = await inv().from('part_vendors').delete().eq('id', id);
  if (error) throw error;
}
