import { supabase } from '../../lib/supabaseClient';
import type {
  KardexListArgs,
  KardexListResult,
  VInventoryKardexRow,
} from '../../types/inventory/inventoryKardex';
import { showToastError } from '../../notifications';

const VIEW = 'v_inventory_kardex' as const;

// Helpers para normalizar numeric (Supabase puede devolver string/number)
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeRow(row: VInventoryKardexRow): VInventoryKardexRow {
  return {
    ...row,
    qty_delta: toNumber(row.qty_delta),
    unit_cost: toNullableNumber(row.unit_cost),
  };
}

/**
 * ✅ Construye el query base UNA SOLA VEZ y usamos ReturnType para tipar TODO el chain.
 * Esto evita el infierno de PostgrestFilterBuilder vs TransformBuilder según versión.
 */
function makeBaseQuery() {
  return supabase.from(VIEW).select(
    `
        occurred_at,
        doc_type,
        movement_side,
        status,
        doc_no,
        reference,
        ticket_id,
        part_id,
        part_code,
        part_name,
        warehouse_id,
        warehouse_code,
        warehouse_name,
        bin_id,
        bin_code,
        qty_delta,
        unit_cost
      `,
    { count: 'exact' }
  );
}

type KardexQuery = ReturnType<typeof makeBaseQuery>;

// Helper: aplica q (búsqueda libre) en OR ilike múltiples columnas
function applySearchQ(query: KardexQuery, qRaw: string): KardexQuery {
  const q = qRaw.trim();
  if (!q) return query;

  const like = `%${q}%`;

  return query.or(
    [
      `doc_no.ilike.${like}`,
      `reference.ilike.${like}`,
      `part_code.ilike.${like}`,
      `part_name.ilike.${like}`,
      `warehouse_code.ilike.${like}`,
      `warehouse_name.ilike.${like}`,
      `bin_code.ilike.${like}`,
    ].join(',')
  );
}

function applyFilters(query: KardexQuery, args: KardexListArgs): KardexQuery {
  const f = args.filters;
  if (!f) return query;

  let q = query;

  if (f.partId) q = q.eq('part_id', f.partId);
  if (f.warehouseId) q = q.eq('warehouse_id', f.warehouseId);
  if (typeof f.ticketId === 'number') q = q.eq('ticket_id', f.ticketId);

  if (f.docType) q = q.eq('doc_type', f.docType);
  if (f.status) q = q.eq('status', f.status);
  if (f.movementSide) q = q.eq('movement_side', f.movementSide);

  if (f.dateFrom) q = q.gte('occurred_at', f.dateFrom);
  if (f.dateTo) q = q.lte('occurred_at', f.dateTo);

  if (f.q) q = applySearchQ(q, f.q);

  return q;
}

function applySort(query: KardexQuery, args: KardexListArgs): KardexQuery {
  const sortBy = args.sort?.by ?? 'occurred_at';
  const dir = args.sort?.dir ?? 'desc';

  return query.order(sortBy, { ascending: dir === 'asc', nullsFirst: false });
}

export async function listKardex(
  args: KardexListArgs = {}
): Promise<KardexListResult> {
  const pageSize = Math.min(Math.max(args.pageSize ?? 50, 1), 200);
  const page = Math.max(args.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = makeBaseQuery();

    query = applyFilters(query, args);
    query = applySort(query, args);

    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    const rows: VInventoryKardexRow[] = (data ?? []).map(
      (r: VInventoryKardexRow) => normalizeRow(r)
    );

    return {
      rows,
      count: count ?? 0,
      page,
      pageSize,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      showToastError(error.message);
      throw error;
    }
    showToastError('Error inesperado cargando Kardex.');
    throw new Error('Error inesperado cargando Kardex.');
  }
}

/**
 * Utilidad opcional para exportar todo por lotes
 */
export async function listKardexAll(
  args: Omit<KardexListArgs, 'page' | 'pageSize'> & { batchSize?: number } = {}
): Promise<VInventoryKardexRow[]> {
  const batchSize = Math.min(Math.max(args.batchSize ?? 1000, 200), 5000);

  const all: VInventoryKardexRow[] = [];
  let page = 1;

  while (true) {
    const res = await listKardex({
      ...args,
      page,
      pageSize: batchSize,
    });

    all.push(...res.rows);

    if (all.length >= res.count) break;
    page += 1;
  }

  return all;
}
