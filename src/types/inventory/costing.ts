import type { AuditFields, UUID } from './common';

export type PartCostRow = AuditFields & {
  id: UUID;
  part_id: UUID;
  warehouse_id: UUID;
  avg_unit_cost: number;
  updated_at: string;
};
