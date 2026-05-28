import type { AuditFields, BigIntLike, UUID } from './common';

export type ToolStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'CHECKED_OUT'
  | 'MAINTENANCE'
  | 'DAMAGED'
  | 'RETIRED';

export type TicketToolRequestStatus =
  | 'RESERVED'
  | 'CHECKED_OUT'
  | 'RETURNED'
  | 'CANCELLED';

export type ToolReturnCondition = 'GOOD' | 'DAMAGED' | 'MAINTENANCE';

export type ToolCategoryRow = AuditFields & {
  id: UUID;
  name: string;
  parent_id: UUID | null;
};

export type ToolCategoryInsert = {
  id?: UUID;
  name: string;
  parent_id?: UUID | null;
};

export type ToolCategoryUpdate = Partial<
  Omit<ToolCategoryRow, 'id' | 'created_at' | 'created_by'>
>;

export type ToolRow = AuditFields & {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  category_id: UUID | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  home_warehouse_id: UUID | null;
  home_bin_id: UUID | null;
  current_warehouse_id: UUID;
  current_bin_id: UUID | null;
  status: ToolStatus;
  requires_calibration: boolean;
  calibration_due_on: string | null;
  is_active: boolean;
};

export type ToolInsert = {
  id?: UUID;
  code?: string;
  name: string;
  description?: string | null;
  category_id?: UUID | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  asset_tag?: string | null;
  home_warehouse_id?: UUID | null;
  home_bin_id?: UUID | null;
  current_warehouse_id: UUID;
  current_bin_id?: UUID | null;
  status?: ToolStatus;
  requires_calibration?: boolean;
  calibration_due_on?: string | null;
  is_active?: boolean;
};

export type ToolUpdate = Partial<
  Omit<ToolRow, 'id' | 'created_at' | 'created_by'>
>;

export type TicketToolRequestRow = AuditFields & {
  id: UUID;
  ticket_id: BigIntLike;
  tool_id: UUID;
  reserved_at: string;
  checked_out_at: string | null;
  expected_return_at: string | null;
  returned_at: string | null;
  cancelled_at: string | null;
  status: TicketToolRequestStatus;
  checkout_notes: string | null;
  return_notes: string | null;
  condition_on_return: ToolReturnCondition | null;
};

export type VAvailableToolRow = {
  tool_id: UUID;
  tool_code: string;
  tool_name: string;
  description: string | null;
  category_id: UUID | null;
  category_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  warehouse_id: UUID;
  warehouse_code: string;
  warehouse_name: string;
  bin_id: UUID | null;
  bin_code: string | null;
  bin_name: string | null;
  status: ToolStatus;
  requires_calibration: boolean;
  calibration_due_on: string | null;
  is_available: boolean;
  reserved_ticket_id: BigIntLike | null;
  expected_return_at: string | null;
};
