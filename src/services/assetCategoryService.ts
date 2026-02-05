import { supabase } from '../lib/supabaseClient';
import type {
  AssetCategory,
  AssetCategoryInsert,
  AssetCategoryUpdate,
} from '../types/AssetCategory';

export async function listAssetCategories(params?: {
  includeInactive?: boolean;
}) {
  const includeInactive = params?.includeInactive ?? true;

  let query = supabase
    .from('asset_categories')
    .select('*')
    .order('name', { ascending: true });

  if (!includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as AssetCategory[];
}

export async function createAssetCategory(payload: AssetCategoryInsert) {
  const { error } = await supabase.from('asset_categories').insert(payload);
  if (error) throw error;
}

export async function updateAssetCategory(
  id: number,
  patch: AssetCategoryUpdate
) {
  const { error } = await supabase
    .from('asset_categories')
    .update(patch)
    .eq('id', id);
  if (error) throw error;
}

export async function toggleAssetCategoryActive(id: number, isActive: boolean) {
  const { error } = await supabase
    .from('asset_categories')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteAssetCategory(id: number) {
  const { error } = await supabase
    .from('asset_categories')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function listActiveAssetCategories() {
  const { data, error } = await supabase
    .from('asset_categories')
    .select('id,name,is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Array<{
    id: number;
    name: string;
    is_active: boolean;
  }>;
}
