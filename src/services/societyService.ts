import { supabase } from '../lib/supabaseClient';
import type { Society, SocietyFormState } from '../types/Society';

export async function getLatestSociety(): Promise<Society | null> {
  const { data, error } = await supabase
    .from('societies')
    .select('id,name,logo_url,is_active,created_at,updated_at')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);

  return (data?.[0] ?? null) as Society | null;
}

export async function updateSociety(
  id: number,
  payload: Pick<SocietyFormState, 'name' | 'logo_url' | 'is_active'>
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('societies')
    .update({
      name: payload.name.trim(),
      logo_url: payload.logo_url,
      is_active: payload.is_active,
      updated_at: now,
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function createSociety(
  payload: Pick<SocietyFormState, 'name' | 'logo_url' | 'is_active'>
): Promise<void> {
  const { error } = await supabase.from('societies').insert({
    name: payload.name.trim(),
    logo_url: payload.logo_url,
    is_active: payload.is_active,
  });

  if (error) throw new Error(error.message);
}
