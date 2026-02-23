export interface Ticket {
  id: string;
  title: string;
  description: string;
  is_accepted: boolean;
  is_urgent: boolean;
  priority: 'Baja' | 'Media' | 'Alta';
  status: 'Pendiente' | 'En Ejecución' | 'Finalizadas';
  requester: string;
  location_id: number | null;
  location_name?: string | null;
  assignee?: string;
  assignee_id?: number;
  incident_date: string;
  deadline_date?: string;
  image?: string;
  email?: string;
  phone?: string;
  created_at: string;
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
