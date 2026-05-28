import type {
  ListParams,
  ToolCategoryInsert,
  ToolCategoryRow,
  ToolCategoryUpdate,
  ToolInsert,
  ToolRow,
  TicketToolRequestRow,
  ToolUpdate,
  UUID,
} from '../../types/inventory';
import { inv } from './inventoryClient';

export async function listToolCategories(
  params: ListParams = {}
): Promise<ToolCategoryRow[]> {
  const {
    limit = 200,
    offset = 0,
    orderBy = 'name',
    ascending = true,
  } = params;

  const { data, error } = await inv()
    .from('tool_categories')
    .select('*')
    .order(orderBy, { ascending })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as ToolCategoryRow[];
}

export async function createToolCategory(payload: ToolCategoryInsert) {
  const { data, error } = await inv()
    .from('tool_categories')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data as ToolCategoryRow;
}

export async function updateToolCategory(
  id: UUID,
  patch: ToolCategoryUpdate
) {
  const { data, error } = await inv()
    .from('tool_categories')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as ToolCategoryRow;
}

export async function deleteToolCategory(id: UUID) {
  const { error } = await inv().from('tool_categories').delete().eq('id', id);
  if (error) throw error;
}

export async function listTools(
  params: ListParams & { is_active?: boolean; status?: string } = {}
): Promise<ToolRow[]> {
  const {
    limit = 300,
    offset = 0,
    orderBy = 'code',
    ascending = true,
    is_active,
    status,
  } = params;

  let q = inv().from('tools').select('*');
  if (typeof is_active === 'boolean') q = q.eq('is_active', is_active);
  if (status) q = q.eq('status', status);

  const { data, error } = await q
    .order(orderBy, { ascending })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as ToolRow[];
}

export async function createTool(payload: ToolInsert) {
  const cleanPayload = { ...payload };
  if (!cleanPayload.code?.trim()) delete cleanPayload.code;

  const { data, error } = await inv()
    .from('tools')
    .insert(cleanPayload)
    .select('*')
    .single();

  if (error) throw error;
  return data as ToolRow;
}

export async function updateTool(id: UUID, patch: ToolUpdate) {
  const { data, error } = await inv()
    .from('tools')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as ToolRow;
}

export async function deleteTool(id: UUID) {
  const { error } = await inv().from('tools').delete().eq('id', id);
  if (error) throw error;
}

export async function listOpenTicketToolRequests(): Promise<
  TicketToolRequestRow[]
> {
  const { data, error } = await inv()
    .from('ticket_tool_requests')
    .select('*')
    .in('status', ['RESERVED', 'CHECKED_OUT'])
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as TicketToolRequestRow[];
}
