import type { UUID, VReorderSuggestionsRow } from '../../types/inventory';
import { inv } from './inventoryClient';

export type ReorderSuggestionsFilters = {
  needsReorder?: boolean;
  warehouseId?: UUID;
  categoryId?: UUID;
  q?: string;
};

// PostgREST devuelve el join como array
type VReorderSuggestionsRowDb = VReorderSuggestionsRow & {
  parts: Array<{ category_id: UUID }>;
};

function stripJoin(row: VReorderSuggestionsRowDb): VReorderSuggestionsRow {
  // evitamos destructuring para que no haya "unused vars"
  const { parts, ...rest } = row; // si tu linter marca esto igual, usa la alternativa de abajo
  void parts; // fuerza "used" sin generar código extra real
  return rest;
}

export async function listReorderSuggestions(
  filters: ReorderSuggestionsFilters = {}
) {
  let q = inv()
    .from('v_reorder_suggestions')
    .select(
      `
        part_id,
        part_code,
        part_name,
        warehouse_id,
        warehouse_code,
        warehouse_name,
        min_qty,
        reorder_point,
        on_hand_qty,
        suggested_min_replenish,
        needs_reorder,
        parts:parts!inner(category_id)
      `
    );

  if (typeof filters.needsReorder === 'boolean') {
    q = q.eq('needs_reorder', filters.needsReorder);
  }
  if (filters.warehouseId) q = q.eq('warehouse_id', filters.warehouseId);
  if (filters.categoryId) q = q.eq('parts.category_id', filters.categoryId);

  if (filters.q?.trim()) {
    const term = filters.q.trim();
    q = q.or(`part_code.ilike.%${term}%,part_name.ilike.%${term}%`);
  }

  const { data, error } = await q
    .order('needs_reorder', { ascending: false })
    .order('part_code', { ascending: true });

  if (error) throw error;

  // cast “seguro” por ser boundary de red (y porque TS no puede inferir el payload de SQL string)
  const rows = (data ?? []) as unknown as VReorderSuggestionsRowDb[];

  return rows.map(stripJoin);
}
