import type {
  BigIntLike,
  InventoryDocInsert,
  InventoryDocLineInsert,
  InventoryDocLineRow,
  InventoryDocRow,
  InventoryDocStatus,
  InventoryDocType,
  UUID,
} from '../../types/inventory';
import { inv } from './inventoryClient';

export type ListDocsFilters = {
  doc_type?: InventoryDocType;
  status?: InventoryDocStatus;
  ticket_id?: BigIntLike;
  warehouse_id?: UUID;
  q?: string; // doc_no/reference (ilike)
};

export async function listInventoryDocs(
  filters: ListDocsFilters = {},
  limit = 200
) {
  let q = inv().from('inventory_docs').select('*');

  if (filters.doc_type) q = q.eq('doc_type', filters.doc_type);
  if (filters.status) q = q.eq('status', filters.status);
  if (typeof filters.ticket_id === 'number')
    q = q.eq('ticket_id', filters.ticket_id);
  if (filters.warehouse_id) q = q.eq('warehouse_id', filters.warehouse_id);

  if (filters.q && filters.q.trim().length > 0) {
    const s = filters.q.trim();
    q = q.or(`doc_no.ilike.%${s}%,reference.ilike.%${s}%`);
  }

  const { data, error } = await q
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InventoryDocRow[];
}

export async function getInventoryDoc(docId: UUID) {
  const { data, error } = await inv()
    .from('inventory_docs')
    .select('*')
    .eq('id', docId)
    .single();
  if (error) throw error;
  return data as InventoryDocRow;
}

export async function createInventoryDoc(payload: InventoryDocInsert) {
  const { data, error } = await inv()
    .from('inventory_docs')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryDocRow;
}

export async function updateInventoryDoc(
  docId: UUID,
  patch: Partial<InventoryDocRow>
) {
  const { data, error } = await inv()
    .from('inventory_docs')
    .update(patch)
    .eq('id', docId)
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryDocRow;
}

export async function deleteInventoryDoc(docId: UUID) {
  const { error } = await inv().from('inventory_docs').delete().eq('id', docId);
  if (error) throw error;
}

export async function listInventoryDocLines(docId: UUID) {
  const { data, error } = await inv()
    .from('inventory_doc_lines')
    .select('*')
    .eq('doc_id', docId)
    .order('line_no', { ascending: true });

  if (error) throw error;
  return (data ?? []) as InventoryDocLineRow[];
}

export async function addInventoryDocLines(lines: InventoryDocLineInsert[]) {
  const { data, error } = await inv()
    .from('inventory_doc_lines')
    .insert(lines)
    .select('*');
  if (error) throw error;
  return (data ?? []) as InventoryDocLineRow[];
}

export async function updateInventoryDocLine(
  lineId: UUID,
  patch: Partial<InventoryDocLineRow>
) {
  const { data, error } = await inv()
    .from('inventory_doc_lines')
    .update(patch)
    .eq('id', lineId)
    .select('*')
    .single();
  if (error) throw error;
  return data as InventoryDocLineRow;
}

export async function deleteInventoryDocLine(lineId: UUID) {
  const { error } = await inv()
    .from('inventory_doc_lines')
    .delete()
    .eq('id', lineId);
  if (error) throw error;
}

// RPCs
export async function postInventoryDoc(docId: UUID) {
  const { error } = await inv().rpc('post_inventory_doc', { p_doc_id: docId });
  if (error) throw error;
}

export async function cancelInventoryDoc(docId: UUID) {
  // returns uuid (reversal doc id)
  const { data, error } = await inv().rpc('cancel_inventory_doc', {
    p_doc_id: docId,
  });
  if (error) throw error;
  return data as UUID;
}
