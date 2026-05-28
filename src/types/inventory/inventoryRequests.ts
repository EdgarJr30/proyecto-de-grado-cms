export type TicketPartRequestRow = {
  id: string;
  ticket_id: number;
  part_id: string;
  warehouse_id: string;
  requested_qty: number;
  reserved_qty: number;
  issued_qty: number;
  returned_qty: number;
  created_at: string;
  updated_at: string;
};

export type AvailableStockRow = {
  part_id: string;
  part_code: string;
  part_name: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  on_hand_qty: number;
  reserved_qty: number;
  available_qty: number;
};

export type AvailableToolRow = {
  tool_id: string;
  tool_code: string;
  tool_name: string;
  description: string | null;
  category_name: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  bin_id: string | null;
  bin_code: string | null;
  bin_name: string | null;
  status: ToolStatus;
  requires_calibration: boolean;
  calibration_due_on: string | null;
  is_available: boolean;
  reserved_ticket_id: number | null;
  expected_return_at: string | null;
};

export type PartPick = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};
export type WarehousePick = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

export type WarehouseBinPick = {
  id: string;
  warehouse_id: string;
  code: string;
  name: string | null;
  is_active: boolean;
};

export type TicketWoPick = {
  id: number;
  title: string;
  status: string | null;
  priority: string | null;
  requester: string | null;
  is_accepted: boolean;
  is_archived: boolean;
  created_at: string;
};

export type ToolStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'CHECKED_OUT'
  | 'MAINTENANCE'
  | 'DAMAGED'
  | 'RETIRED';

export type ToolReturnCondition = 'GOOD' | 'DAMAGED' | 'MAINTENANCE';

export type TicketToolRequestStatus =
  | 'RESERVED'
  | 'CHECKED_OUT'
  | 'RETURNED'
  | 'CANCELLED';

export type TicketToolRequestRow = {
  id: string;
  ticket_id: number;
  tool_id: string;
  reserved_at: string;
  checked_out_at: string | null;
  expected_return_at: string | null;
  returned_at: string | null;
  cancelled_at: string | null;
  status: TicketToolRequestStatus;
  checkout_notes: string | null;
  return_notes: string | null;
  condition_on_return: ToolReturnCondition | null;
  created_at: string;
  updated_at: string;
};
