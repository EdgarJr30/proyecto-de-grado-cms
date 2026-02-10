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
