import type { AuditFields, UUID } from './common';

export type WarehouseRow = AuditFields & {
  id: UUID;
  code: string;
  name: string;
  location_label: string | null;
  is_active: boolean;
};

export type WarehouseInsert = {
  id?: UUID;
  code: string;
  name: string;
  location_label?: string | null;
  is_active?: boolean;
};

export type WarehouseUpdate = Partial<
  Omit<WarehouseRow, 'id' | 'created_at' | 'created_by'>
>;

export type WarehouseBinRow = AuditFields & {
  id: UUID;
  warehouse_id: UUID;
  code: string;
  name: string | null;
  is_active: boolean;
};

export type WarehouseBinInsert = {
  id?: UUID;
  warehouse_id: UUID;
  code: string;
  name?: string | null;
  is_active?: boolean;
};

export type WarehouseBinUpdate = Partial<
  Omit<WarehouseBinRow, 'id' | 'created_at' | 'created_by'>
>;

export type StockOnHandRow = AuditFields & {
  id: UUID;
  part_id: UUID;
  warehouse_id: UUID;
  bin_id: UUID | null;
  qty: number;
};

export type StockOnHandKey = {
  part_id: UUID;
  warehouse_id: UUID;
  bin_id: UUID | null;
};
