export type InventoryDocType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'RETURN';
export type InventoryDocStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export type PartCriticality = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MovementSide = 'OUT' | 'IN';
