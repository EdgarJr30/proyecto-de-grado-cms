import { supabase } from '../lib/supabaseClient';
import type {
  Uom,
  // Warehouse,
  WarehouseArea,
  Item,
  ItemInsert,
  ItemUpdate,
  ItemUom,
  Basket,
  InventoryCount,
  InventoryCountInsert,
  InventoryCountUpdate,
  InventoryCountLine,
  InventoryCountLineUpsertInput,
  InventoryCountStatus,
  InventoryCountOperation,
  InventoryOperationInsert,
  InventoryAdjustment,
  InventoryAdjustmentInsert,
} from '../types/inventory';

const PAGE_SIZE = 20;

export type WarehouseDto = {
  id: number;
  code: string;
  name: string;
};

export type WarehouseAreaDto = {
  id: number;
  code: string; // código del área (ABARROTES, CF-01, etc.)
  name: string; // nombre del área
  warehouseId: number;
  warehouseCode: string; // código del almacén (OC, PAP-GRAL, etc.)
  warehouseName: string; // nombre del almacén
};

// =========================
// 1) Catálogos base
// =========================

export async function getActiveUoms(): Promise<Uom[]> {
  const { data, error } = await supabase
    .from('uoms')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('❌ Error al obtener UoMs:', error.message);
    return [];
  }

  return (data ?? []) as Uom[];
}

export async function getActiveWarehouses(): Promise<WarehouseDto[]> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('id, code, name')
    .eq('is_active', true)
    .order('id', { ascending: false });

  if (error) {
    console.error('❌ Error al cargar almacenes:', error.message);
    throw new Error(error.message);
  }

  return (data ?? []) as WarehouseDto[];
}

export async function getActiveWarehouseAreas(): Promise<WarehouseAreaDto[]> {
  const { data, error } = await supabase
    .from('warehouse_areas')
    .select(
      `
        id,
        code,
        name,
        is_active,
        warehouse_id,
        warehouses (
          id,
          code,
          name
        )
      `
    )
    .eq('is_active', true)
    // 👇 Primero por ID del almacén (tabla relacionada) de mayor a menor
    .order('id', { foreignTable: 'warehouses', ascending: false })
    // 👇 Luego opcionalmente por nombre del área
    .order('name', { ascending: true });

  if (error) {
    console.error('❌ Error al cargar áreas de almacén:', error.message);
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as Array<{
    id: number;
    code: string;
    name: string;
    warehouse_id: number;
    warehouses: {
      id: number;
      code: string;
      name: string;
    } | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    warehouseId: row.warehouse_id,
    warehouseCode: row.warehouses?.code ?? '',
    warehouseName: row.warehouses?.name ?? '',
  }));
}

export async function getWarehouseAreasByWarehouseId(
  warehouseId: number
): Promise<WarehouseArea[]> {
  const { data, error } = await supabase
    .from('warehouse_areas')
    .select('*')
    .eq('warehouse_id', warehouseId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error(
      `❌ Error al obtener áreas del almacén #${warehouseId}:`,
      error.message
    );
    return [];
  }

  return (data ?? []) as WarehouseArea[];
}

export async function getWarehouseAreasByWarehouseCode(
  warehouseCode: string
): Promise<WarehouseArea[]> {
  // Útil si en el front trabajas con el código 'OC', 'OC-QUIM', etc.
  const { data: wh, error: whError } = await supabase
    .from('warehouses')
    .select('id')
    .eq('code', warehouseCode)
    .maybeSingle();

  if (whError || !wh) {
    console.error(
      `❌ Error al obtener almacén por código "${warehouseCode}":`,
      whError?.message
    );
    return [];
  }

  return getWarehouseAreasByWarehouseId(wh.id as number);
}

export async function getActiveBaskets(): Promise<Basket[]> {
  const { data, error } = await supabase
    .from('baskets')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('❌ Error al obtener canastos:', error.message);
    return [];
  }

  return (data ?? []) as Basket[];
}

// =========================
// 2) Ítems & UoM por ítem
// =========================

export async function getItemsPaginated(
  page: number,
  pageSize = PAGE_SIZE,
  term?: string
): Promise<{ data: Item[]; count: number }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('items')
    .select('*', { count: 'exact' })
    .eq('is_active', true);

  const trimmed = (term ?? '').trim();
  if (trimmed.length >= 2) {
    const ors: string[] = [`sku.ilike.%${trimmed}%`, `name.ilike.%${trimmed}%`];
    const n = Number(trimmed);
    if (!Number.isNaN(n)) {
      // por si quieres buscar por id
      ors.push(`id.eq.${n}`);
    }
    query = query.or(ors.join(','));
  }

  const { data, error, count } = await query
    .order('name', { ascending: true })
    .range(from, to);

  if (error) {
    console.error('❌ Error al obtener items:', error.message);
    return { data: [], count: 0 };
  }

  return { data: (data ?? []) as Item[], count: count ?? 0 };
}

export async function getItemById(id: number): Promise<Item | null> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error(`❌ Error al obtener item #${id}:`, error.message);
    return null;
  }

  return data as Item;
}

export async function getItemIdsByAreaId(areaId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('warehouse_area_items')
    .select('item_id')
    .eq('area_id', areaId)
    .eq('is_active', true);

  if (error) {
    console.error(
      `❌ Error al obtener items del área #${areaId}:`,
      error.message
    );
    return [];
  }

  return (data ?? []).map((row) => row.item_id as number);
}

export async function createItem(input: ItemInsert): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert([{ ...input, is_active: true }])
    .select('*')
    .single();

  if (error) {
    throw new Error(`No se pudo crear el item: ${error.message}`);
  }

  return data as Item;
}

export async function updateItem(id: number, input: ItemUpdate): Promise<void> {
  const { error } = await supabase.from('items').update(input).eq('id', id);

  if (error) {
    throw new Error(`No se pudo actualizar el item #${id}: ${error.message}`);
  }
}

export async function toggleItemActive(
  id: number,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) {
    throw new Error(
      `No se pudo ${isActive ? 'activar' : 'desactivar'} el item #${id}: ${
        error.message
      }`
    );
  }
}

export async function getItemUoms(itemId: number): Promise<ItemUom[]> {
  const { data, error } = await supabase
    .from('item_uoms')
    .select('*')
    .eq('item_id', itemId)
    .eq('is_active', true)
    .order('id', { ascending: true });

  if (error) {
    console.error(
      `❌ Error al obtener UoMs de item #${itemId}:`,
      error.message
    );
    return [];
  }

  return (data ?? []) as ItemUom[];
}

// =========================
// 3) Jornadas de conteo
// =========================

export async function getInventoryCountsPaginated(options: {
  page: number;
  pageSize?: number;
  warehouseId?: number;
  status?: InventoryCountStatus;
  term?: string;
}): Promise<{ data: InventoryCount[]; count: number }> {
  const { page, pageSize = PAGE_SIZE, warehouseId, status, term } = options;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from('inventory_counts').select('*', { count: 'exact' });

  if (typeof warehouseId === 'number') {
    q = q.eq('warehouse_id', warehouseId);
  }

  if (status) {
    q = q.eq('status', status);
  }

  const trimmed = (term ?? '').trim();
  if (trimmed.length >= 2) {
    q = q.or(
      [`name.ilike.%${trimmed}%`, `description.ilike.%${trimmed}%`].join(',')
    );
  }

  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('❌ Error al obtener jornadas de conteo:', error.message);
    return { data: [], count: 0 };
  }

  return { data: (data ?? []) as InventoryCount[], count: count ?? 0 };
}

export async function getInventoryCountById(
  id: number
): Promise<InventoryCount | null> {
  const { data, error } = await supabase
    .from('inventory_counts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error(`❌ Error al obtener jornada #${id}:`, error.message);
    return null;
  }

  return data as InventoryCount;
}

export async function createInventoryCount(
  input: InventoryCountInsert
): Promise<InventoryCount> {
  const { data, error } = await supabase
    .from('inventory_counts')
    .insert([{ ...input, status: 'open' }])
    .select('*')
    .single();

  if (error) {
    throw new Error(`No se pudo crear la jornada de conteo: ${error.message}`);
  }

  return data as InventoryCount;
}

export async function updateInventoryCount(
  id: number,
  input: InventoryCountUpdate
): Promise<void> {
  const { error } = await supabase
    .from('inventory_counts')
    .update(input)
    .eq('id', id);

  if (error) {
    throw new Error(
      `No se pudo actualizar la jornada #${id}: ${error.message}`
    );
  }
}

export async function changeInventoryCountStatus(
  id: number,
  status: InventoryCountStatus
): Promise<void> {
  const nowIso = new Date().toISOString();

  let patch: Partial<InventoryCount> = { status };

  if (status === 'closed') {
    patch = { ...patch, closed_at: nowIso };
  }

  const { error } = await supabase
    .from('inventory_counts')
    .update(patch)
    .eq('id', id);

  if (error) {
    throw new Error(
      `No se pudo cambiar el estado de la jornada #${id}: ${error.message}`
    );
  }
}

// =========================
// 4) Líneas de conteo
// =========================

export async function getInventoryCountLines(
  inventoryCountId: number
): Promise<InventoryCountLine[]> {
  const { data, error } = await supabase
    .from('inventory_count_lines')
    .select('*')
    .eq('inventory_count_id', inventoryCountId)
    .order('id', { ascending: true });

  if (error) {
    console.error(
      `❌ Error al obtener líneas de jornada #${inventoryCountId}:`,
      error.message
    );
    return [];
  }

  return (data ?? []) as InventoryCountLine[];
}

/**
 * Upsert de líneas:
 * - clave lógica: (inventory_count_id, item_id, uom_id)
 * - permitido por el unique de la tabla.
 */
export async function upsertInventoryCountLine(
  input: InventoryCountLineUpsertInput
): Promise<InventoryCountLine> {
  const { data, error } = await supabase
    .from('inventory_count_lines')
    .insert({
      inventory_count_id: input.inventory_count_id,
      item_id: input.item_id,
      uom_id: input.uom_id,
      counted_qty: input.counted_qty ?? null,
      status: input.status ?? 'counted',
      status_comment: input.status_comment ?? null,
      pending_reason_code: input.pendingReasonCode ?? null,
      last_counted_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(
      `No se pudo guardar la línea de conteo (inv=${input.inventory_count_id}, item=${input.item_id}): ${error.message}`
    );
  }

  return data as InventoryCountLine;
}

// =========================
// 5) Operaciones crudas
// =========================

export async function recordInventoryOperation(
  input: InventoryOperationInsert
): Promise<InventoryCountOperation> {
  const {
    client_op_id,
    inventory_count_id,
    item_id,
    uom_id,
    user_id,
    device_id,
    is_weighted = false,
    basket_id,
    gross_qty,
    net_qty,
    is_pending = false,
    pending_comment,
    pendingReasonCode,
  } = input;

  const { data, error } = await supabase
    .from('inventory_count_operations')
    .insert([
      {
        client_op_id,
        inventory_count_id,
        item_id,
        uom_id,
        user_id: user_id ?? null,
        device_id: device_id ?? null,
        is_weighted,
        basket_id: basket_id ?? null,
        gross_qty: gross_qty ?? null,
        net_qty: net_qty ?? null,
        is_pending,
        pending_comment: pending_comment ?? null,
        pending_reason_code: pendingReasonCode ?? null,
      },
    ])
    .select('*')
    .single();

  if (error) {
    throw new Error(
      `No se pudo registrar la operación de conteo: ${error.message}`
    );
  }

  return data as InventoryCountOperation;
}

export async function getOperationsByInventoryCount(
  inventoryCountId: number
): Promise<InventoryCountOperation[]> {
  const { data, error } = await supabase
    .from('inventory_count_operations')
    .select('*')
    .eq('inventory_count_id', inventoryCountId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(
      `❌ Error al obtener operaciones de jornada #${inventoryCountId}:`,
      error.message
    );
    return [];
  }

  return (data ?? []) as InventoryCountOperation[];
}

// =========================
// 6) Ajustes de inventario
// =========================

export async function getAdjustmentsByInventoryCount(
  inventoryCountId: number
): Promise<InventoryAdjustment[]> {
  const { data, error } = await supabase
    .from('inventory_adjustments')
    .select('*')
    .eq('inventory_count_id', inventoryCountId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(
      `❌ Error al obtener ajustes de jornada #${inventoryCountId}:`,
      error.message
    );
    return [];
  }

  return (data ?? []) as InventoryAdjustment[];
}

export async function createInventoryAdjustment(
  input: InventoryAdjustmentInsert
): Promise<InventoryAdjustment> {
  const { data, error } = await supabase
    .from('inventory_adjustments')
    .insert([
      {
        ...input,
        posted_to_erp: false,
        posted_at: null,
        erp_document_ref: null,
      },
    ])
    .select('*')
    .single();

  if (error) {
    throw new Error(
      `No se pudo crear el ajuste de inventario: ${error.message}`
    );
  }

  return data as InventoryAdjustment;
}

export async function markAdjustmentAsPosted(
  id: number,
  erpDocumentRef?: string
): Promise<void> {
  const { error } = await supabase
    .from('inventory_adjustments')
    .update({
      posted_to_erp: true,
      posted_at: new Date().toISOString(),
      erp_document_ref: erpDocumentRef ?? null,
    })
    .eq('id', id);

  if (error) {
    throw new Error(
      `No se pudo marcar el ajuste #${id} como posteado a ERP: ${error.message}`
    );
  }
}

// =========================
// X) Items por almacén
// =========================

export type WarehouseStockItem = {
  warehouse_item_id: number;
  quantity: string; // numeric → string
  is_active: boolean;

  warehouse_id: number;
  warehouse_code: string;
  warehouse_name: string;

  item_id: number;
  item_sku: string;
  item_name: string;
  item_is_weightable: boolean;

  uom_id: number;
  uom_code: string;
  uom_name: string;

  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

/**
 * Obtiene el listado de artículos que pertenecen a un almacén
 * identificado por su código (slug), ej: 'oc-quimicos'.
 *
 * Esta función asume una vista/tabla `inventory_warehouse_items`
 * en la BD con las columnas usadas abajo.
 */
export async function getWarehouseItemsByCode(
  warehouseCode: string
): Promise<WarehouseStockItem[]> {
  const PAGE_SIZE = 1000;
  let from = 0;
  let all: WarehouseStockItem[] = [];

  while (true) {
    const { data, error } = await supabase
      .from('vw_warehouse_stock')
      .select('*')
      .eq('warehouse_code', warehouseCode)
      .order('item_name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(
        `❌ Error al obtener items de almacén "${warehouseCode}":`,
        error.message
      );
      return all; // o lanza throw si prefieres
    }

    const rows = (data ?? []) as WarehouseStockItem[];
    all = all.concat(rows);

    // si vino menos que el PAGE_SIZE, ya no hay más rows
    if (rows.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  console.log(
    `✅ getWarehouseItemsByCode("${warehouseCode}") → ${all.length} filas`
  );

  return all;
}

export async function getWarehouseItemBySku(
  warehouseCode: string,
  sku: string
): Promise<WarehouseStockItem | null> {
  const { data, error } = await supabase
    .from('vw_warehouse_stock')
    .select('*')
    .eq('warehouse_code', warehouseCode)
    .eq('item_sku', sku)
    .maybeSingle();

  if (error) {
    console.error(
      `❌ Error al buscar item "${sku}" en almacén "${warehouseCode}":`,
      error.message
    );
    return null;
  }

  return (data as WarehouseStockItem) ?? null;
}

export async function getWarehouseItemByWarehouseItemId(
  warehouseItemId: number
): Promise<WarehouseStockItem | null> {
  const { data, error } = await supabase
    .from('vw_warehouse_stock')
    .select('*')
    .eq('warehouse_item_id', warehouseItemId)
    .maybeSingle();

  if (error) {
    console.error(
      `❌ Error al buscar warehouse_item_id ${warehouseItemId}:`,
      error.message
    );
    return null;
  }

  return (data as WarehouseStockItem) ?? null;
}

export async function getWarehouseItemIdForItemInWarehouse(
  warehouseId: number,
  itemId: number
): Promise<number | null> {
  const { data, error } = await supabase
    .from('warehouse_items')
    .select('id')
    .eq('warehouse_id', warehouseId)
    .eq('item_id', itemId)
    .order('id', { ascending: false }) // toma el más nuevo
    .limit(1);

  if (error) {
    console.error('[getWarehouseItemIdForItemInWarehouse] error:', error);
    throw new Error(error.message);
  }

  const first = data?.[0];
  return first?.id ? Number(first.id) : null;
}

export async function getBaseUomCodeByItemIds(
  itemIds: number[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (itemIds.length === 0) return map;

  const { data, error } = await supabase
    .from('items')
    .select(
      `
      id,
      uoms:base_uom_id ( code )
    `
    )
    .in('id', itemIds);

  if (error) {
    console.error('❌ Error al obtener UoM base por items:', error.message);
    return map;
  }

  const rows = (data ?? []) as unknown as Array<{
    id: number;
    uoms: { code: string } | null;
  }>;

  for (const r of rows) {
    map.set(r.id, r.uoms?.code ?? '—');
  }

  return map;
}

export async function getTotalCountedBaseQtyByItemIds(
  itemIds: number[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (itemIds.length === 0) return map;

  const { data, error } = await supabase
    .from('inventory_count_lines')
    .select('item_id, base_counted_qty, counted_qty, status')
    .in('item_id', itemIds);

  if (error) {
    console.error(
      '❌ Error al obtener total contado por items:',
      error.message
    );
    return map;
  }

  const rows = (data ?? []) as Array<{
    item_id: number;
    base_counted_qty: string | number | null;
    counted_qty: string | number | null;
    status: 'counted' | 'pending' | 'ignored' | null;
  }>;

  for (const r of rows) {
    // Solo sumar lo contado
    if (r.status && r.status !== 'counted') continue;

    const base = Number(r.base_counted_qty);
    const fallback = Number(r.counted_qty ?? 0);
    const qty = Number.isFinite(base) ? base : fallback;

    const prev = map.get(r.item_id) ?? 0;
    map.set(r.item_id, prev + (Number.isFinite(qty) ? qty : 0));
  }

  return map;
}
