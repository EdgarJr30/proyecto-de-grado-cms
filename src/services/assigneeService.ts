import { supabase } from '../lib/supabaseClient';
import type { Assignee, AssigneeSection } from '../types/Assignee';

export type AssigneeInput = {
  name: string;
  last_name: string;
  section: AssigneeSection;
  email?: string | null;
  phone?: string | null;
  user_id?: string | null;
  is_active?: boolean;
};

export async function getAllAssignees(): Promise<Assignee[]> {
  const { data, error } = await supabase
    .from('assignees')
    .select('id, name, last_name, section, is_active, user_id, email, phone');

  if (error) throw new Error(error.message);
  return (data ?? []) as Assignee[];
}

export async function getActiveAssignees(): Promise<Assignee[]> {
  const { data, error } = await supabase
    .from('assignees')
    .select('id, name, last_name, section, is_active, user_id, email, phone')
    .eq('is_active', true)
    .order('section', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Assignee[];
}

export function groupBySection(list: Assignee[]): Record<AssigneeSection, Assignee[]> {
  const sections: AssigneeSection[] = ['SIN ASIGNAR', 'Internos', 'TERCEROS', 'OTROS'];
  const grouped = Object.fromEntries(sections.map(s => [s, [] as Assignee[]])) as Record<AssigneeSection, Assignee[]>;
  for (const a of list) {
    const key = sections.includes(a.section) ? a.section : 'OTROS';
    grouped[key].push(a);
  }
  return grouped;
}

export function makeAssigneeMap(list: Assignee[]): Record<number, Assignee> {
  const map: Record<number, Assignee> = {};
  for (const a of list) map[a.id] = a;
  return map;
}

export function formatAssigneeFullName(a?: Assignee): string {
  if (!a) return '<< SIN ASIGNAR >>';
  return `${a.name} ${a.last_name}`.trim();
}

export function assigneeInitials(a?: Assignee): string {
  if (!a) return 'SA';
  const parts = `${a.name} ${a.last_name}`.trim().split(/\s+/);
  const i1 = parts[0]?.[0] ?? '';
  const i2 = parts[1]?.[0] ?? '';
  return `${i1}${i2}`.toUpperCase() || 'SA';
}

/* ------------------------------- NUEVO CRUD ------------------------------- */

export type AssigneeListParams = {
  page: number;
  pageSize: number;
  search?: string; // por nombre/apellido/email/phone
  section?: AssigneeSection | 'TODOS';
  includeInactive?: boolean; // default: false
};

export async function getAssigneesPaginated(params: AssigneeListParams): Promise<{
  data: Assignee[];
  count: number;
}> {
  const { page, pageSize, search, section, includeInactive } = params;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('assignees')
    .select('id, name, last_name, section, is_active, user_id, email, phone', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (!includeInactive) query = query.eq('is_active', true);

  if (section && section !== 'TODOS') {
    query = query.eq('section', section);
  }

  if (search && search.trim().length >= 2) {
    // usa or/ilike para nombre, apellido, email y phone
    const like = `%${search.trim()}%`;
    query = query.or(
      `name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { data: (data ?? []) as Assignee[], count: count ?? 0 };
}

export async function createAssignee(input: AssigneeInput): Promise<number> {
  const payload = {
    name: input.name.trim(),
    last_name: input.last_name.trim(),
    section: input.section,
    email: input.email ?? null,
    phone: input.phone ?? null,
    user_id: input.user_id ?? null,
    is_active: input.is_active ?? true,
  };

  const { data, error } = await supabase
    .from('assignees')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data!.id as number;
}

export async function updateAssignee(id: number, input: Partial<AssigneeInput>): Promise<void> {
  const payload: Record<string, unknown> = { ...input };
  if (typeof input.name === 'string') payload.name = input.name.trim();
  if (typeof input.last_name === 'string') payload.last_name = input.last_name.trim();

  const { error } = await supabase
    .from('assignees')
    .update(payload)
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteAssignee(id: number): Promise<void> {
  const { error } = await supabase.from('assignees').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function setAssigneeActive(id: number, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('assignees').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function bulkSetAssigneeActive(ids: number[], isActive: boolean): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('assignees').update({ is_active: isActive }).in('id', ids);
  if (error) throw new Error(error.message);
}