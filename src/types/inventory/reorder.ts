import type { AuditFields, UUID } from './common';

export type ReorderPolicyRow = AuditFields & {
  id: UUID;
  part_id: UUID;
  warehouse_id: UUID;
  min_qty: number;
  max_qty: number | null;
  reorder_point: number | null;
  safety_stock: number | null;
  lead_time_days: number | null;
  preferred_vendor_id: UUID | null;
};

export type ReorderPolicyInsert = {
  id?: UUID;
  part_id: UUID;
  warehouse_id: UUID;
  min_qty?: number;
  max_qty?: number | null;
  reorder_point?: number | null;
  safety_stock?: number | null;
  lead_time_days?: number | null;
  preferred_vendor_id?: UUID | null;
};

export type ReorderPolicyUpdate = Partial<
  Omit<ReorderPolicyRow, 'id' | 'created_at' | 'created_by'>
>;
