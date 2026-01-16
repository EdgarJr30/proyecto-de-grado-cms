// services/emailService.ts
import type { Ticket } from "../types/Ticket";

// Solo los campos que espera el backend
export type TicketEmailData = Pick<Ticket, "title" | "description" | "requester" | "email" | "location" | "incident_date">;

export async function sendTicketEmail(ticketData: TicketEmailData) {
  const endpoint = "http://localhost:3001/send-ticket-email";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ticketData)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Error enviando correo");
  }
  return await res.json();
}
