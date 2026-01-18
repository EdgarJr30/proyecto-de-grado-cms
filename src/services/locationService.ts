import { supabase } from '../lib/supabaseClient';
import type {
  Location,
  LocationInsert,
  LocationOption,
  LocationUpdate,
} from '../types/Location';

type ListLocationsArgs = {
  includeInactive?: boolean; // para pantallas de admin
  limit?: number;
};

function normalizeDbError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error('Unexpected error');
}

export async function listLocations(
  args: ListLocationsArgs = {}
): Promise<Location[]> {
  const { includeInactive = false, limit = 500 } = args;

  let query = supabase
    .from('locations')
    .select(
      'id,name,code,description,is_active,created_at,updated_at,created_by,updated_by'
    )
    .order('name', { ascending: true })
    .limit(limit);

  // Nota: si NO incluyes inactivas, el policy `locations_select_active`
  // igual te limita a is_active=true; pero filtramos también por UI.
  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listLocationOptions(): Promise<LocationOption[]> {
  // Para dropdowns: mínimo payload
  const { data, error } = await supabase
    .from('locations')
    .select('id,name,code')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getLocationById(id: number): Promise<Location | null> {
  const { data, error } = await supabase
    .from('locations')
    .select(
      'id,name,code,description,is_active,created_at,updated_at,created_by,updated_by'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getLocationByCode(
  code: string
): Promise<Location | null> {
  const { data, error } = await supabase
    .from('locations')
    .select(
      'id,name,code,description,is_active,created_at,updated_at,created_by,updated_by'
    )
    .eq('code', code)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function createLocation(
  payload: LocationInsert
): Promise<Location> {
  try {
    const { data, error } = await supabase
      .from('locations')
      .insert({
        name: payload.name.trim(),
        code: payload.code.trim(),
        description: payload.description ?? null,
        is_active: payload.is_active ?? true,
      })
      .select(
        'id,name,code,description,is_active,created_at,updated_at,created_by,updated_by'
      )
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned from createLocation');
    return data;
  } catch (error: unknown) {
    throw normalizeDbError(error);
  }
}

export async function updateLocation(
  id: number,
  patch: LocationUpdate
): Promise<Location> {
  try {
    const updatePayload: LocationUpdate = {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.code !== undefined ? { code: patch.code.trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
      ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
    };

    const { data, error } = await supabase
      .from('locations')
      .update(updatePayload)
      .eq('id', id)
      .select(
        'id,name,code,description,is_active,created_at,updated_at,created_by,updated_by'
      )
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('No data returned from updateLocation');
    return data;
  } catch (error: unknown) {
    throw normalizeDbError(error);
  }
}

export async function toggleLocationActive(
  id: number,
  nextActive: boolean
): Promise<Location> {
  // Usa update normal (tu policy locations_disable_rbac lo controla)
  return updateLocation(id, { is_active: nextActive });
}

export async function deleteLocation(id: number): Promise<void> {
  try {
    const { error } = await supabase.from('locations').delete().eq('id', id);
    if (error) throw new Error(error.message);
  } catch (error: unknown) {
    throw normalizeDbError(error);
  }
}
