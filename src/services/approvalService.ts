import { supabase } from '../lib/supabaseClient';
import { uploadImageToBucket } from './storageService';

export type ApprovalProcess = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  require_evidence: boolean;
  created_at: string;
  updated_at: string;
};

export type ApprovalProcessInput = {
  name: string;
  description?: string | null;
  require_evidence?: boolean;
  is_active?: boolean;
};

export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected';

export type ApprovalRequest = {
  id: string;
  process_id: number;
  ticket_id: number;
  requester_user_id: string;
  evidence_image: string;
  note: string | null;
  status: ApprovalRequestStatus;
  approver_user_id: string | null;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim().length > 0) return m;
  }
  return fallback;
}

export function parseEvidencePaths(evidence: string | null | undefined): string[] {
  if (!evidence) return [];
  try {
    const arr = JSON.parse(evidence);
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

/* ============ Procesos (config) ============ */

export async function listApprovalProcesses(): Promise<ApprovalProcess[]> {
  const { data, error } = await supabase
    .from('approval_processes')
    .select('id, name, code, description, is_active, require_evidence, created_at, updated_at')
    .order('name', { ascending: true });

  if (error) throw new Error(getErrorMessage(error, 'No se pudieron cargar los procesos.'));
  return (data ?? []) as ApprovalProcess[];
}

export async function createApprovalProcess(
  input: ApprovalProcessInput
): Promise<ApprovalProcess> {
  // 'code' lo autogenera la BD (trigger) a partir del nombre.
  const { data, error } = await supabase
    .from('approval_processes')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      require_evidence: input.require_evidence ?? true,
      is_active: input.is_active ?? true,
    })
    .select('id, name, code, description, is_active, require_evidence, created_at, updated_at')
    .single();

  if (error) throw new Error(getErrorMessage(error, 'No se pudo crear el proceso.'));
  return data as ApprovalProcess;
}

export async function updateApprovalProcess(
  id: number,
  patch: Partial<ApprovalProcessInput>
): Promise<void> {
  const { error } = await supabase
    .from('approval_processes')
    .update({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description?.trim() || null }
        : {}),
      ...(patch.require_evidence !== undefined
        ? { require_evidence: patch.require_evidence }
        : {}),
      ...(patch.is_active !== undefined ? { is_active: patch.is_active } : {}),
    })
    .eq('id', id);

  if (error) throw new Error(getErrorMessage(error, 'No se pudo actualizar el proceso.'));
}

export async function deleteApprovalProcess(id: number): Promise<void> {
  const { error } = await supabase.from('approval_processes').delete().eq('id', id);
  if (error) throw new Error(getErrorMessage(error, 'No se pudo eliminar el proceso.'));
}

/* ============ Membresías ============ */

export async function getProcessMemberIds(
  processId: number
): Promise<{ approverIds: string[]; requesterIds: string[] }> {
  const [approvers, requesters] = await Promise.all([
    supabase.from('approval_process_approvers').select('user_id').eq('process_id', processId),
    supabase.from('approval_process_requesters').select('user_id').eq('process_id', processId),
  ]);

  if (approvers.error) throw new Error(getErrorMessage(approvers.error, 'Error al cargar aprobadores.'));
  if (requesters.error) throw new Error(getErrorMessage(requesters.error, 'Error al cargar solicitantes.'));

  return {
    approverIds: (approvers.data ?? []).map((r) => r.user_id as string),
    requesterIds: (requesters.data ?? []).map((r) => r.user_id as string),
  };
}

export async function setProcessApprovers(processId: number, userIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_process_approvers', {
    p_process_id: processId,
    p_user_ids: userIds,
  });
  if (error) throw new Error(getErrorMessage(error, 'No se pudieron guardar los aprobadores.'));
}

export async function setProcessRequesters(processId: number, userIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_process_requesters', {
    p_process_id: processId,
    p_user_ids: userIds,
  });
  if (error) throw new Error(getErrorMessage(error, 'No se pudieron guardar los solicitantes.'));
}

/* ============ Flujo de validación ============ */

/** Sube las imágenes de evidencia al bucket y devuelve los paths. */
export async function uploadApprovalEvidence(
  ticketId: number,
  files: File[]
): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const path = await uploadImageToBucket(files[i], ticketId, i);
    paths.push(path);
  }
  return paths;
}

export async function requestTicketApproval(params: {
  ticketId: number;
  evidencePaths: string[];
  note?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('request_ticket_approval', {
    p_ticket_id: params.ticketId,
    p_evidence: params.evidencePaths,
    p_note: params.note?.trim() || null,
  });
  if (error) throw new Error(getErrorMessage(error, 'No se pudo enviar a validación.'));
  return data as string;
}

export async function decideTicketApproval(params: {
  requestId: string;
  approve: boolean;
  note?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('decide_ticket_approval', {
    p_request_id: params.requestId,
    p_approve: params.approve,
    p_note: params.note?.trim() || null,
  });
  if (error) throw new Error(getErrorMessage(error, 'No se pudo registrar la decisión.'));
}

export type TicketApprover = {
  id: string;
  label: string;
  email: string | null;
};

/** ¿El usuario actual es solicitante en algún proceso de aprobación activo? */
export async function amIApprovalRequester(): Promise<boolean> {
  const { data, error } = await supabase.rpc('am_i_approval_requester');
  if (error) return false;
  return data === true;
}

/** ¿El usuario actual es aprobador de algún proceso por el que pasó el ticket? */
export async function amITicketApprover(ticketId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('am_i_ticket_approver', {
    p_ticket_id: ticketId,
  });
  if (error) return false;
  return data === true;
}

/** Aprobadores asignados a la solicitud pendiente de un ticket. */
export async function getTicketPendingApprovers(
  ticketId: number
): Promise<TicketApprover[]> {
  const { data, error } = await supabase.rpc('get_ticket_pending_approvers', {
    p_ticket_id: ticketId,
  });
  if (error) return [];
  return ((data ?? []) as Array<{ user_id: string; full_name: string | null; email: string | null }>).map(
    (r) => ({
      id: r.user_id,
      label: (r.full_name ?? '').trim() || r.email || r.user_id,
      email: r.email,
    })
  );
}

/** Última solicitud de validación del ticket (cualquier estado). */
export async function getLatestApprovalForTicket(
  ticketId: number
): Promise<ApprovalRequest | null> {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(getErrorMessage(error, 'No se pudo cargar la validación.'));
  return (data as ApprovalRequest) ?? null;
}

/** Solicitud de validación pendiente de un ticket (si existe). */
export async function getPendingApprovalForTicket(
  ticketId: number
): Promise<ApprovalRequest | null> {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('ticket_id', ticketId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(getErrorMessage(error, 'No se pudo cargar la solicitud.'));
  return (data as ApprovalRequest) ?? null;
}

/** Solicitudes pendientes visibles para el usuario (RLS limita a sus procesos). */
export async function listPendingApprovalRequests(): Promise<ApprovalRequest[]> {
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(getErrorMessage(error, 'No se pudieron cargar las solicitudes.'));
  return (data ?? []) as ApprovalRequest[];
}
