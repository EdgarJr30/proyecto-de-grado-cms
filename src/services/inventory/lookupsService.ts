import type { UUID } from '../../types/inventory';
import { inv } from './inventoryClient';

export type OptionRow = { id: UUID; label: string; meta?: string };

export async function listWarehousesOptions() {
  const { data, error } = await inv()
    .from('warehouses')
    .select('id, code, name, is_active')
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((w) => ({
    id: w.id,
    label: `${w.code} — ${w.name}`,
  })) as OptionRow[];
}

export async function listVendorsOptions() {
  const { data, error } = await inv()
    .from('vendors')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((v) => ({ id: v.id, label: v.name })) as OptionRow[];
}

export async function listCategoriesOptions() {
  const { data, error } = await inv()
    .from('part_categories')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id, label: c.name })) as OptionRow[];
}

export async function listPartsOptions(params?: {
  categoryId?: UUID;
  q?: string;
}) {
  let q = inv()
    .from('parts')
    .select('id, code, name, is_active, is_stocked, category_id')
    .eq('is_active', true)
    .eq('is_stocked', true);

  if (params?.categoryId) q = q.eq('category_id', params.categoryId);
  if (params?.q?.trim()) {
    const term = params.q.trim();
    q = q.or(`code.ilike.%${term}%,name.ilike.%${term}%`);
  }

  const { data, error } = await q.order('code', { ascending: true }).limit(200);
  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: p.id,
    label: `${p.code} — ${p.name}`,
  })) as OptionRow[];
}
