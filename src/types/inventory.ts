// src/types/inventory.ts

// ===== Catálogos base =====

export interface Uom {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string; // ISO
  updated_at: string; // ISO
  created_by?: string | null;
  updated_by?: string | null;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export type WarehouseArea = {
  id: number;
  warehouse_id: number;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export interface Item {
  id: number;
  sku: string;
  name: string;
  base_uom_id: number;
  is_weightable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface ItemUom {
  id: number;
  item_id: number;
  uom_id: number;
  conversion_factor: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface Basket {
  id: number;
  name: string;
  color: string;
  weight: number;
  uom_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

// ===== Jornadas de conteo =====

export type InventoryCountStatus = 'open' | 'closed' | 'cancelled';
export type PendingReasonCode = 'UOM_DIFFERENT' | 'REVIEW';

export interface InventoryCount {
  id: number;
  warehouse_id: number;
  name: string;
  description?: string | null;
  status: InventoryCountStatus;
  planned_at?: string | null; // timestamptz
  started_at?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;

  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export type InventoryLineStatus = 'counted' | 'pending' | 'ignored';

export interface InventoryCountLine {
  id: number;
  inventory_count_id: number;
  item_id: number;
  uom_id: number;
  counted_qty: number | null;
  last_counted_at?: string | null;

  status: InventoryLineStatus;
  status_comment?: string | null;

  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

// ===== Operaciones crudas / disparos =====

export interface InventoryCountOperation {
  id: number;
  client_op_id: string; // uuid
  inventory_count_id: number;
  item_id: number;
  uom_id: number;

  user_id?: string | null;
  device_id?: string | null;

  is_weighted: boolean;
  basket_id?: number | null;
  gross_qty?: number | null;
  net_qty?: number | null;

  is_pending: boolean;
  pending_comment?: string | null;

  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

// ===== Ajustes finales =====

export interface InventoryAdjustment {
  id: number;
  inventory_count_id: number;
  item_id: number;
  uom_id: number;

  difference_qty: number;
  adjustment_reason?: string | null;

  posted_to_erp: boolean;
  posted_at?: string | null;
  erp_document_ref?: string | null;

  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

// ===== Helpers para inputs =====

export type ItemInsert = Pick<
  Item,
  'sku' | 'name' | 'base_uom_id' | 'is_weightable'
>;

export type ItemUpdate = Partial<
  Pick<Item, 'name' | 'base_uom_id' | 'is_weightable' | 'is_active'>
>;

export type InventoryCountInsert = {
  warehouse_id: number;
  name: string;
  description?: string;
  planned_at?: string; // ISO/timestamptz
};

export type InventoryCountUpdate = Partial<
  Pick<
    InventoryCount,
    | 'name'
    | 'description'
    | 'status'
    | 'planned_at'
    | 'started_at'
    | 'closed_at'
  >
>;

export type InventoryCountLineUpsertInput = {
  inventory_count_id: number;
  item_id: number;
  uom_id: number;
  counted_qty?: number | null;
  status?: InventoryLineStatus;
  status_comment?: string | null;
  pendingReasonCode?: PendingReasonCode;
};

export type InventoryOperationInsert = {
  client_op_id: string;
  inventory_count_id: number;
  item_id: number;
  uom_id: number;
  user_id?: string | null;
  device_id?: string | null;
  is_weighted?: boolean;
  basket_id?: number | null;
  gross_qty?: number | null;
  net_qty?: number | null;
  is_pending?: boolean;
  pending_comment?: string | null;
  pendingReasonCode?: PendingReasonCode;
};

export type InventoryAdjustmentInsert = {
  inventory_count_id: number;
  item_id: number;
  uom_id: number;
  difference_qty: number;
  adjustment_reason?: string;
};

export type WarehouseStockItem = {
  warehouse_item_id: number;
  quantity: string; // o number si castea
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

  base_uom_id: number | null;
  base_uom_code: string | null;
  base_uom_name: string | null;

  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};
