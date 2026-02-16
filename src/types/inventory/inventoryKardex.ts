import type { UUID } from './common';

export type VInventoryKardexRow = {
  occurred_at: string; // timestamptz -> ISO string

  doc_type: 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'ADJUSTMENT' | 'RETURN';
  movement_side: 'OUT' | 'IN' | null;

  status: 'DRAFT' | 'POSTED' | 'CANCELLED';
  doc_no: string | null;
  reference: string | null;
  ticket_id: number | null;

  part_id: UUID;
  part_code: string;
  part_name: string;

  warehouse_id: UUID;
  warehouse_code: string;
  warehouse_name: string;

  bin_id: UUID | null;
  bin_code: string | null;

  qty_delta: number; // numeric(18,3)
  unit_cost: number | null; // numeric(18,4)
};

// Filtros del Kardex
export type KardexFilters = {
  q?: string; // búsqueda libre (doc_no / reference / part_code / part_name / warehouse_code / warehouse_name / bin_code)
  partId?: UUID;
  warehouseId?: UUID;
  ticketId?: number;

  docType?: VInventoryKardexRow['doc_type'];
  movementSide?: Exclude<VInventoryKardexRow['movement_side'], null>;
  status?: VInventoryKardexRow['status'];

  dateFrom?: string; // ISO string
  dateTo?: string; // ISO string (inclusive en UI; en query lo manejamos con lte)
};

export type KardexSort = {
  by?: 'occurred_at' | 'part_code' | 'warehouse_code' | 'doc_no';
  dir?: 'asc' | 'desc';
};

export type KardexListArgs = {
  filters?: KardexFilters;
  sort?: KardexSort;
  page?: number; // 1-based
  pageSize?: number; // default 50
};

export type KardexListResult = {
  rows: VInventoryKardexRow[];
  count: number; // total rows (para paginación)
  page: number;
  pageSize: number;
};
