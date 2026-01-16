export type TicketStatus = "Pendiente" | "En Ejecución" | "Finalizadas";

export interface ReportFilters {
  location?: string;
  assignee?: string;
  requester?: string;
  status?: TicketStatus;   // útil para filtrar cuando agrupas por otro campo
  from?: string;           // ISO: "2025-08-01T00:00:00"
  to?: string;             // ISO: "2025-08-31T23:59:59"
}

export interface CountByStatusDTO {
  status: TicketStatus;
  count: number;
}

export interface CountByFieldDTO {
  key: string;   // location | assignee | requester
  count: number;
}
