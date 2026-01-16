export interface Ticket {
  id: string;
  title: string;
  description: string;
  is_accepted: boolean;
  is_urgent: boolean;
  priority: "baja" | "media" | "alta";
  status:
    | "Pendiente"
    | "En Ejecución"
    | "Finalizadas";
  requester: string;
  location: string;
  assignee?: string;
  assignee_id?: number;
  incident_date: string;
  deadline_date?: string; // ISO date string
  image?: string; // base64
  email?: string;
  phone?: string;
  created_at: string; // ISO date string
  comments?: string;
  is_archived: boolean;
  finalized_at?: string | null;
  special_incident_id?: number | null;
  special_incident_name?: string | null;
  special_incident_code?: string | null;
}

export type WorkOrderExtras = {
  primary_assignee_id?: number | null;
  secondary_assignee_ids?: number[] | null;
  effective_assignee_id?: number | null;
};

export type WorkOrder = Ticket & WorkOrderExtras;

export const Locations = [
  "Operadora de Servicios Alimenticios",
  "Adrian Tropical 27",
  "Adrian Tropical Malecón",
  "Adrian Tropical Lincoln",
  "Adrian Tropical San Vicente",
  "Atracciones el Lago",
  "M7",
  "E. Arturo Trading",
  "Edificio Comunitario",
];