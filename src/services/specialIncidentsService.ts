import { supabase } from '../lib/supabaseClient';
import type { SpecialIncident } from '../types/SpecialIncident';

export type SpecialIncidentInput = {
  name: string;
  code?: string;                     // si no llega, lo generamos a partir de name
  description?: string | null;
  is_active?: boolean;               // por defecto true
};

export type SpecialIncidentListParams = {
  page: number;
  pageSize: number;
  search?: string;                   // por name/code/description
  includeInactive?: boolean;         // default: true (porque la política full_access puede ver todas)
  orderBy?: 'created_at' | 'updated_at' | 'name' | 'code';
  ascending?: boolean;
};

/* --------------------------------- Helpers -------------------------------- */

function normalizeCode(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw
    .normalize('NFD').replace(/\p{Diacritic}/gu, '') // quita acentos
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')                     // separador _
    .replace(/^_+|_+$/g, '');
}

function makeCodeFromName(name: string): string {
  return normalizeCode(name) ?? '';
}

/** Construye un mapa id -> SpecialIncident */
export function makeSpecialIncidentMap(list: SpecialIncident[]): Record<number, SpecialIncident> {
  const map: Record<number, SpecialIncident> = {};
  for (const it of list) map[it.id] = it;
  return map;
}

/** Construye un mapa code -> SpecialIncident */
export function makeSpecialIncidentCodeMap(list: SpecialIncident[]): Record<string, SpecialIncident> {
  const map: Record<string, SpecialIncident> = {};
  for (const it of list) if (it.code) map[it.code] = it;
  return map;
}

/* --------------------------------- Queries -------------------------------- */

export async function getAllSpecialIncidents(): Promise<SpecialIncident[]> {
  const { data, error } = await supabase
    .from('special_incidents')
    .select('id, name, code, description, is_active, created_at, updated_at, created_by, updated_by')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SpecialIncident[];
}

/** Ideal para combos en la UI (solo activas, orden alfabético) */
export async function getActiveSpecialIncidents(): Promise<SpecialIncident[]> {
  const { data, error } = await supabase
    .from('special_incidents')
    .select('id, name, code, description, is_active, created_at, updated_at, created_by, updated_by')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as SpecialIncident[];
}

/** Paginado + filtros */
export async function getSpecialIncidentsPaginated(params: SpecialIncidentListParams): Promise<{
  data: SpecialIncident[];
  count: number;
}> {
  const {
    page,
    pageSize,
    search,
    includeInactive = true,
    orderBy = 'created_at',
    ascending = false,
  } = params;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('special_incidents')
    .select('id, name, code, description, is_active, created_at, updated_at, created_by, updated_by', { count: 'exact' })
    .order(orderBy, { ascending })
    .range(from, to);

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  if (search && search.trim().length >= 2) {
    const like = `%${search.trim()}%`;
    query = query.or(
      `name.ilike.${like},code.ilike.${like},description.ilike.${like}`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as SpecialIncident[], count: count ?? 0 };
}

/* ---------------------------------- CRUD ---------------------------------- */

export async function createSpecialIncident(input: SpecialIncidentInput): Promise<number> {
  const payload = {
    name: input.name.trim(),
    code: normalizeCode(input.code) ?? makeCodeFromName(input.name),
    description: input.description ?? null,
    is_active: input.is_active ?? true,
  };

  const { data, error } = await supabase
    .from('special_incidents')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data!.id as number;
}

export async function updateSpecialIncident(
  id: number,
  input: Partial<SpecialIncidentInput>
): Promise<void> {
  const payload: Record<string, unknown> = {};

  if (typeof input.name === 'string') payload.name = input.name.trim();
  if (typeof input.code === 'string') payload.code = normalizeCode(input.code);
  if ('description' in input) payload.description = input.description ?? null;
  if (typeof input.is_active === 'boolean') payload.is_active = input.is_active;

  const { error } = await supabase
    .from('special_incidents')
    .update(payload)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteSpecialIncident(id: number): Promise<void> {
  const { error } = await supabase
    .from('special_incidents')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/** Alterna el estado activo (usa política `special_incidents_disable_rbac` si solo delegas toggle) */
export async function setSpecialIncidentActive(id: number, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('special_incidents')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function bulkSetSpecialIncidentActive(ids: number[], isActive: boolean): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('special_incidents')
    .update({ is_active: isActive })
    .in('id', ids);

  if (error) throw new Error(error.message);
}

/* ------------------------------ Utils de UI ------------------------------- */

/** Formatea una etiqueta estándar p/combos (Name — code) */
export function formatSpecialIncidentLabel(it?: Pick<SpecialIncident, 'name' | 'code'>): string {
  if (!it) return '<< SIN INCIDENTE >>';
  return it.code ? `${it.name} — ${it.code}` : it.name;
}
