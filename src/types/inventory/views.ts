import type { UUID, BigIntLike } from './common';
import type {
  InventoryDocStatus,
  InventoryDocType,
  MovementSide,
  PartCriticality,
} from './enums';

export type VPartStockSummaryRow = {
  part_id: UUID;
  code: string;
  name: string;
  is_active: boolean;
  criticality: PartCriticality;
  category_id: UUID | null;
  uom_id: UUID;
  total_qty: number;
};

export type VStockByLocationRow = {
  part_id: UUID;
  part_code: string;
  part_name: string;
  warehouse_id: UUID;
  warehouse_code: string;
  warehouse_name: string;
  bin_id: UUID | null;
  bin_code: string | null;
  bin_name: string | null;
  qty: number;
  updated_at: string;
};

export type VInventoryKardexRow = {
  occurred_at: string;
  doc_type: InventoryDocType;
  movement_side: MovementSide | null;
  status: InventoryDocStatus;
  doc_no: string | null;
  reference: string | null;
  ticket_id: BigIntLike | null;
  part_id: UUID;
  part_code: string;
  part_name: string;
  warehouse_id: UUID;
  warehouse_code: string;
  warehouse_name: string;
  bin_id: UUID | null;
  bin_code: string | null;
  qty_delta: number;
  unit_cost: number | null;
};

export type VReorderSuggestionsRow = {
  part_id: UUID;
  part_code: string;
  part_name: string;
  warehouse_id: UUID;
  warehouse_code: string;
  warehouse_name: string;
  min_qty: number;
  reorder_point: number | null;
  on_hand_qty: number;
  suggested_min_replenish: number;
  needs_reorder: boolean;
};

export type VAvailableStockRow = {
  part_id: UUID;
  part_code: string;
  part_name: string;
  warehouse_id: UUID;
  warehouse_code: string;
  warehouse_name: string;
  on_hand_qty: number;
  reserved_qty: number;
  available_qty: number;
};
