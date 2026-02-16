import type { AuditFields, UUID } from './common';

export type PartCostRow = AuditFields & {
  id: UUID;
  part_id: UUID;
  warehouse_id: UUID;
  avg_unit_cost: number; // numeric(18,4)
};

export type VPartCostRow = {
  part_id: UUID;
  part_code: string;
  part_name: string;

  warehouse_id: UUID;
  warehouse_code: string;
  warehouse_name: string;

  avg_unit_cost: number;
  updated_at: string;
};

export type PartCostsFilters = {
  partId?: UUID;
  warehouseId?: UUID;
  q?: string;
  limit?: number;
  offset?: number;
};

export type PartCostsResult = {
  rows: VPartCostRow[];
  count: number;
};
