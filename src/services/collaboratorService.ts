import { supabase } from '../lib/supabaseClient';

export type Collaborator = {
  id: string;
  label: string;
  email: string | null;
};

export type CollaboratorCandidate = Collaborator;

type CollaboratorRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim().length > 0) return m;
  }
  return fallback;
}

function mapRow(r: CollaboratorRow): Collaborator {
  return {
    id: r.user_id,
    label: (r.full_name ?? '').trim() || r.email || r.user_id,
    email: r.email,
  };
}

/** ¿El usuario actual puede gestionar colaboradores del ticket? (admin o responsable) */
export async function canIManageCollaborators(ticketId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_i_manage_ticket_collaborators', {
    p_ticket_id: ticketId,
  });
  if (error) return false;
  return data === true;
}

/** Colaboradores actuales del ticket. */
export async function listTicketCollaborators(
  ticketId: number
): Promise<Collaborator[]> {
  const { data, error } = await supabase.rpc('get_ticket_collaborators', {
    p_ticket_id: ticketId,
  });
  if (error) throw new Error(getErrorMessage(error, 'No se pudieron cargar los colaboradores.'));
  return ((data ?? []) as CollaboratorRow[]).map(mapRow);
}

/** Usuarios candidatos a colaborador (excluye responsables y ya-colaboradores). */
export async function listCollaboratorCandidates(
  ticketId: number,
  search?: string
): Promise<CollaboratorCandidate[]> {
  const { data, error } = await supabase.rpc('list_collaborator_candidates', {
    p_ticket_id: ticketId,
    p_search: search?.trim() || null,
  });
  if (error) throw new Error(getErrorMessage(error, 'No se pudieron cargar los usuarios.'));
  return ((data ?? []) as CollaboratorRow[]).map(mapRow);
}

export async function addTicketCollaborator(
  ticketId: number,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc('add_ticket_collaborator', {
    p_ticket_id: ticketId,
    p_user_id: userId,
  });
  if (error) throw new Error(getErrorMessage(error, 'No se pudo agregar el colaborador.'));
}

export async function removeTicketCollaborator(
  ticketId: number,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc('remove_ticket_collaborator', {
    p_ticket_id: ticketId,
    p_user_id: userId,
  });
  if (error) throw new Error(getErrorMessage(error, 'No se pudo quitar el colaborador.'));
}
