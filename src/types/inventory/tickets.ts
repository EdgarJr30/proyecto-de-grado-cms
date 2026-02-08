import type { AuditFields, BigIntLike, UUID } from './common';

export type TicketPartRequestRow = AuditFields & {
  id: UUID;
  ticket_id: BigIntLike;
  part_id: UUID;
  warehouse_id: UUID;
  requested_qty: number;
  reserved_qty: number;
  issued_qty: number;
  returned_qty: number;
};

export type TicketPartRequestInsert = {
  id?: UUID;
  ticket_id: BigIntLike;
  part_id: UUID;
  warehouse_id: UUID;
  requested_qty: number;
  reserved_qty?: number;
  issued_qty?: number;
  returned_qty?: number;
};

export type TicketPartRequestUpdate = Partial<
  Omit<TicketPartRequestRow, 'id' | 'created_at' | 'created_by'>
>;
