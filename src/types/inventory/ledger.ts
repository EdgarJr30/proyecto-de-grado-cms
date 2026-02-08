import type { AuditFields, UUID } from './common';
import type { InventoryDocType, MovementSide } from './enums';

export type InventoryLedgerRow = AuditFields & {
  id: UUID;
  doc_id: UUID;
  doc_line_id: UUID;
  doc_type: InventoryDocType;
  occurred_at: string;
  part_id: UUID;
  warehouse_id: UUID;
  bin_id: UUID | null;
  qty_delta: number;
  unit_cost: number | null;
  movement_side: MovementSide | null;
};
