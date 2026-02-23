import type {
  PartCostRow,
  PartCostsFilters,
  PartCostsResult,
  UUID,
  VPartCostRow,
} from '../../types/inventory';
import { inv } from './inventoryClient';

type PartJoin = { code: string; name: string };
type WarehouseJoin = { code: string; name: string };

// Supabase puede devolver relación como objeto, array o null (según metadata/typegen)
type DbPartCostsRow = {
  part_id: UUID;
  warehouse_id: UUID;
  avg_unit_cost: number | string | null;
  updated_at: string;

  parts: PartJoin | PartJoin[] | null;
  warehouses: WarehouseJoin | WarehouseJoin[] | null;
};

function toNumber(v: number | string | null): number {
  if (v === null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function firstOrNull<T>(v: T | T[] | null): T | null {
  if (v === null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function mapRow(r: DbPartCostsRow): VPartCostRow {
  const p = firstOrNull(r.parts);
  const w = firstOrNull(r.warehouses);

  return {
    part_id: r.part_id,
    part_code: p?.code ?? '',
    part_name: p?.name ?? '',

    warehouse_id: r.warehouse_id,
    warehouse_code: w?.code ?? '',
    warehouse_name: w?.name ?? '',

    avg_unit_cost: toNumber(r.avg_unit_cost),
    updated_at: r.updated_at,
  };
}

export async function getPartCost(
  partId: UUID,
  warehouseId: UUID
): Promise<PartCostRow> {
  try {
    const { data, error } = await inv()
      .from('part_costs')
      .select('*')
      .eq('part_id', partId)
      .eq('warehouse_id', warehouseId)
      .single();

    if (error) throw error;

    const row = data as unknown as PartCostRow;
    return {
      ...row,
      avg_unit_cost: toNumber(
        (row as unknown as { avg_unit_cost: number | string | null })
          .avg_unit_cost
      ),
    };
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('Error desconocido obteniendo part_costs.');
  }
}

export async function getPartAvgCost(
  partId: UUID,
  warehouseId: UUID
): Promise<number> {
  try {
    const { data, error } = await inv()
      .from('part_costs')
      .select('avg_unit_cost')
      .eq('part_id', partId)
      .eq('warehouse_id', warehouseId)
      .maybeSingle();

    if (error) throw error;
    return toNumber((data?.avg_unit_cost ?? 0) as number | string | null);
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('Error desconocido obteniendo avg_unit_cost.');
  }
}

export async function listPartCostsByWarehouse(
  warehouseId: UUID
): Promise<PartCostRow[]> {
  try {
    const { data, error } = await inv()
      .from('part_costs')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const rows = (data ?? []) as unknown as PartCostRow[];
    return rows.map((r) => ({
      ...r,
      avg_unit_cost: toNumber(
        (r as unknown as { avg_unit_cost: number | string | null })
          .avg_unit_cost
      ),
    }));
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('Error desconocido listando costos por almacén.');
  }
}

export async function listPartCosts(
  filters: PartCostsFilters = {}
): Promise<PartCostsResult> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  try {
    let query = inv()
      .from('part_costs')
      .select(
        `
        part_id,
        warehouse_id,
        avg_unit_cost,
        updated_at,
        parts:parts ( code, name ),
        warehouses:warehouses ( code, name )
      `,
        { count: 'exact' }
      )
      .order('updated_at', { ascending: false });

    if (filters.partId) query = query.eq('part_id', filters.partId);
    if (filters.warehouseId)
      query = query.eq('warehouse_id', filters.warehouseId);

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    const mapped = (data ?? []).map((r) =>
      mapRow(r as unknown as DbPartCostsRow)
    );

    const q = (filters.q ?? '').trim().toLowerCase();
    const rows =
      q.length >= 2
        ? mapped.filter((x) => {
            const haystack =
              `${x.part_code} ${x.part_name} ${x.warehouse_code} ${x.warehouse_name}`.toLowerCase();
            return haystack.includes(q);
          })
        : mapped;

    return { rows, count: count ?? rows.length };
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('Error desconocido listando costos (vista).');
  }
}
