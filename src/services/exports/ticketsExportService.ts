// src/services/exports/ticketsExportService.ts
import { supabase } from '../../lib/supabaseClient';
import type { CsvHeader, CsvRow } from '../../utils/csv';

export type Priority = 'baja' | 'media' | 'alta';
export type Status = 'Pendiente' | 'En Ejecución' | 'Finalizadas';
export const Locations = [
  'Operadora de Servicios Alimenticios',
  'Adrian Tropical 27',
  'Adrian Tropical Malecón',
  'Adrian Tropical Lincoln',
  'Adrian Tropical San Vicente',
  'Atracciones el Lago',
  'M7',
  'E. Arturo Trading',
  'Edificio Comunitario',
] as const;
export type Location = (typeof Locations)[number];

export interface WorkOrdersFilters {
  q?: string;
  status?: Status[];
  priority?: Priority[];
  location?: Location;
  assignee?: string;
  requester?: string;
  daterange?: { from?: string; to?: string };
  created_by?: string;
  is_accepted?: boolean;
}

/** Fila de la vista v_tickets_compat (incluye nuevas columnas) */
export interface TicketCompatRow {
  id: number;
  title: string;
  description: string | null;
  is_accepted: boolean;
  is_urgent: boolean;
  priority: Priority;
  requester: string | null;
  location: Location;
  assignee: string | null;
  incident_date: string | null;
  deadline_date: string | null;
  image: string | null;
  email: string | null;
  phone: string | null;
  comments: string | null;
  created_at: string;
  status: Status;
  created_by: string | null;
  assignee_id: number | null;
  is_archived: boolean;
  finalized_at: string | null;
  primary_assignee_id: number | null;
  secondary_assignee_ids: number[] | null;
  effective_assignee_id: number | null;
  updated_at: string | null;
  updated_by: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
  primary_assignee_name: string | null;
  secondary_assignees_names: string | null; // texto con comas
}

/** Orden y títulos del CSV */
const header: CsvHeader = {
  id: 'ID',
  title: 'Título',
  description: 'Descripción',
  status: 'Estado',
  is_accepted: 'Aceptado',
  is_urgent: 'Urgente',
  priority: 'Prioridad',
  requester: 'Solicitante',
  location: 'Ubicación',
  assignee: 'Técnico (legacy)',
  primary_assignee_name: 'Técnico Principal',
  secondary_assignees_names: 'Técnicos Secundarios',
  incident_date: 'Fecha Incidente',
  deadline_date: 'Fecha Límite',
  finalized_at: 'Fecha Finalización',
  created_at: 'Creado',
  updated_at: 'Actualizado',
  created_by_name: 'Creado por',
  updated_by_name: 'Actualizado por',
  email: 'Email',
  phone: 'Teléfono',
  comments: 'Comentarios',
};

function serializeRow(r: TicketCompatRow): CsvRow {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    status: r.status,
    is_accepted: r.is_accepted ? 'Sí' : 'No',
    is_urgent: r.is_urgent ? 'Sí' : 'No',
    priority: r.priority,
    requester: r.requester ?? '',
    location: r.location,
    assignee: r.assignee ?? '',

    primary_assignee_name: r.primary_assignee_name ?? '',
    secondary_assignees_names: r.secondary_assignees_names ?? '',

    incident_date: r.incident_date ?? '',
    deadline_date: r.deadline_date ?? '',
    finalized_at: r.finalized_at ?? '',

    created_at: r.created_at,
    updated_at: r.updated_at ?? '',

    created_by_name: r.created_by_name ?? '',
    updated_by_name: r.updated_by_name ?? '',

    email: r.email ?? '',
    phone: r.phone ?? '',
    comments: r.comments ?? '',
  };
}

function buildQuery(filters: WorkOrdersFilters) {
  let q = supabase
    .from('v_tickets_compat')
    .select(
      [
        'id',
        'title',
        'description',
        'is_accepted',
        'is_urgent',
        'priority',
        'requester',
        'location',
        'assignee',
        'incident_date',
        'deadline_date',
        'image',
        'email',
        'phone',
        'comments',
        'created_at',
        'status',
        'created_by',
        'assignee_id',
        'is_archived',
        'finalized_at',
        'primary_assignee_id',
        'secondary_assignee_ids',
        'effective_assignee_id',
        'updated_at',
        'updated_by',
        'created_by_name',
        'updated_by_name',
        'primary_assignee_name',
        'secondary_assignees_names',
      ].join(',')
    );

    if (typeof filters.is_accepted === 'boolean') {
    q = q.eq('is_accepted', filters.is_accepted);
  }

  if (filters.created_by) q = q.eq('created_by', filters.created_by);
  if (filters.status?.length) q = q.in('status', filters.status);
  if (filters.priority?.length) q = q.in('priority', filters.priority);
  if (filters.location) q = q.eq('location', filters.location);
  if (filters.assignee) {
    const term = `%${filters.assignee}%`;
    q = q.or(
      [
        `assignee.ilike.${term}`,
        `primary_assignee_name.ilike.${term}`,
        `created_by_name.ilike.${term}`,
        `updated_by_name.ilike.${term}`,
      ].join(',')
    );
  }
  if (filters.requester) q = q.ilike('requester', `%${filters.requester}%`);

  if (filters.daterange?.from)
    q = q.gte('created_at', `${filters.daterange.from}T00:00:00`);
  if (filters.daterange?.to)
    q = q.lte('created_at', `${filters.daterange.to}T23:59:59`);

  if (filters.q && filters.q.trim().length >= 2) {
    const term = `%${filters.q.trim()}%`;
    q = q.or(
      [
        `title.ilike.${term}`,
        `description.ilike.${term}`,
        `requester.ilike.${term}`,
        `location.ilike.${term}`,
        `status.ilike.${term}`,
        `priority.ilike.${term}`,
        `email.ilike.${term}`,
        `phone.ilike.${term}`,
        `comments.ilike.${term}`,
        `primary_assignee_name.ilike.${term}`,
        `created_by_name.ilike.${term}`,
        `updated_by_name.ilike.${term}`,
      ].join(',')
    );
  }

  return q.order('created_at', { ascending: false });
}

export async function fetchTicketsCsv(filters: WorkOrdersFilters): Promise<{
  rows: CsvRow[];
  header: CsvHeader;
}> {
  const rows: CsvRow[] = [];
  const pageSize = 2000;

  let from = 0;
  // loop de paginación
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery(filters)
      .range(from, to)
      .overrideTypes<TicketCompatRow[], { merge: false }>();
    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data.map(serializeRow));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return {
    rows,
    header,
  };
}
