import type { AuditFields, BigIntLike, UUID } from './common';
import type { InventoryDocStatus, InventoryDocType } from './enums';

export type InventoryDocRow = AuditFields & {
  id: UUID;
  doc_type: InventoryDocType;
  status: InventoryDocStatus;
  doc_no: string | null;
  warehouse_id: UUID | null;
  from_warehouse_id: UUID | null;
  to_warehouse_id: UUID | null;
  ticket_id: BigIntLike | null;
  vendor_id: UUID | null;
  reference: string | null;
  notes: string | null;
  posted_at: string | null;
  // patch cancel
  cancelled_at?: string | null;
  cancelled_by?: UUID | null;
  reversal_doc_id?: UUID | null;
};

export type InventoryDocInsert = {
  id?: UUID;
  doc_type: InventoryDocType;
  status?: InventoryDocStatus; // default DRAFT
  doc_no?: string | null;
  warehouse_id?: UUID | null;
  from_warehouse_id?: UUID | null;
  to_warehouse_id?: UUID | null;
  ticket_id?: BigIntLike | null;
  vendor_id?: UUID | null;
  reference?: string | null;
  notes?: string | null;
  posted_at?: string | null;
};

export type InventoryDocUpdate = Partial<
  Omit<InventoryDocRow, 'id' | 'created_at' | 'created_by'>
>;

export type InventoryDocLineRow = AuditFields & {
  id: UUID;
  doc_id: UUID;
  line_no: number;
  part_id: UUID;
  uom_id: UUID;
  qty: number;
  unit_cost: number | null;
  from_bin_id: UUID | null;
  to_bin_id: UUID | null;
  notes: string | null;
};

export type InventoryDocLineInsert = {
  id?: UUID;
  doc_id: UUID;
  line_no: number;
  part_id: UUID;
  uom_id: UUID;
  qty: number;
  unit_cost?: number | null;
  from_bin_id?: UUID | null;
  to_bin_id?: UUID | null;
  notes?: string | null;
};

export type InventoryDocLineUpdate = Partial<
  Omit<InventoryDocLineRow, 'id' | 'created_at' | 'created_by'>
>;
