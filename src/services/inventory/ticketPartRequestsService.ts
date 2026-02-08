import type {
  BigIntLike,
  TicketPartRequestRow,
  UUID,
} from '../../types/inventory';
import { inv } from './inventoryClient';

export async function listTicketPartRequests(ticketId: BigIntLike) {
  const { data, error } = await inv()
    .from('ticket_part_requests')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as TicketPartRequestRow[];
}

export async function reserveTicketPart(args: {
  ticket_id: BigIntLike;
  part_id: UUID;
  warehouse_id: UUID;
  qty: number;
  allow_backorder?: boolean;
}) {
  const {
    ticket_id,
    part_id,
    warehouse_id,
    qty,
    allow_backorder = false,
  } = args;

  const { error } = await inv().rpc('reserve_ticket_part', {
    p_ticket_id: ticket_id,
    p_part_id: part_id,
    p_warehouse_id: warehouse_id,
    p_qty: qty,
    p_allow_backorder: allow_backorder,
  });

  if (error) throw error;
}
