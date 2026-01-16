// src/utils/toTicketUpdate.ts
import type { Ticket, WorkOrder } from '../types/Ticket';

const TICKET_KEYS: (keyof Ticket)[] = [
  'id','title','description','is_accepted','is_urgent','priority','status',
  'requester','location','assignee','assignee_id','incident_date','deadline_date',
  'image','email','phone','created_at','comments','is_archived','finalized_at'
];

export function toTicketUpdate(input: Partial<WorkOrder>): Partial<Ticket> {
  // Buffer de escritura con claves exactas y valores desconocidos (no any)
  const out: Partial<Record<keyof Ticket, unknown>> = {};

  for (const k of TICKET_KEYS) {
    const v = input[k];
    if (v !== undefined && v !== null) {
      out[k] = v; // ok: unknown es asignable y mantenemos las claves controladas
    }
  }

  // El shape ya coincide con Partial<Ticket>; hacemos el cast estructural aquí.
  return out as Partial<Ticket>;
}
