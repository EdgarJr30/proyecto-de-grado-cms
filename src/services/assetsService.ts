// src/services/assetsService.ts
import { supabase } from '../lib/supabaseClient';
import type {
  Asset,
  AssetInsert,
  AssetOption,
  AssetPreventivePlanUpsertInput,
  AssetPreventiveSchedulerResult,
  AssetUpdate,
  AssetView,
  AssetStatus,
  AssetStatusHistory,
  AssetStatusHistoryInsert,
  AssetMaintenanceLog,
  AssetMaintenanceLogInsert,
  TicketAsset,
  TicketAssetInsert,
  AssetTicketView,
  BigIntLike,
} from '../types/Asset';

type SbError = { message: string };

function toId(value: BigIntLike): number {
  return typeof value === 'number' ? value : Number(value);
}

// 🔒 helpers
function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const e = error as SbError;
    if (typeof e.message === 'string') return e.message;
  }
  return 'Error desconocido';
}

function assertOk<T>(data: T | null, error: unknown, fallbackMsg: string): T {
  if (error) throw new Error(toErrorMessage(error));
  if (data === null) throw new Error(fallbackMsg);
  return data;
}

// ============ ASSETS (CRUD) ============

/** Lista de activos (recomendado: usar la vista v_assets para incluir location_name/code) */
export async function getAssets(): Promise<AssetView[]> {
  const { data, error } = await supabase
    .from('v_assets')
    .select('*')
    .order('id', { ascending: false });

  return assertOk(data, error, 'No se pudieron obtener los activos.');
}

/** Lista liviana de activos para selects y asignaciones */
export async function listAssetOptions(args: {
  includeInactive?: boolean;
  limit?: number;
} = {}): Promise<AssetOption[]> {
  const { includeInactive = true, limit = 2000 } = args;

  let query = supabase
    .from('v_assets')
    .select('id,code,name,status,is_active,location_name')
    .order('code', { ascending: true })
    .limit(limit);

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  return assertOk(data, error, 'No se pudieron obtener las opciones de activos.');
}

/** Obtener un activo por id (vista) */
export async function getAssetById(id: BigIntLike): Promise<AssetView | null> {
  const { data, error } = await supabase
    .from('v_assets')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(toErrorMessage(error));
  return data ?? null;
}

/** Crear activo (tabla assets) */
export async function createAsset(payload: AssetInsert): Promise<Asset> {
  const { data, error } = await supabase
    .from('assets')
    .insert(payload)
    .select('*')
    .single();

  return assertOk(data, error, 'No se pudo crear el activo.');
}

export async function upsertAssetPreventivePlan(
  payload: AssetPreventivePlanUpsertInput
): Promise<void> {
  const { error } = await supabase.rpc('upsert_asset_preventive_plan', {
    p_asset_id: toId(payload.asset_id),
    p_is_active: payload.is_active,
    p_frequency_value: payload.frequency_value,
    p_frequency_unit: payload.frequency_unit,
    p_start_on: payload.start_on,
    p_lead_days: payload.lead_days ?? 0,
    p_default_priority: payload.default_priority ?? 'Media',
    p_title_template: payload.title_template ?? null,
    p_instructions: payload.instructions ?? null,
    p_allow_open_work_orders: payload.allow_open_work_orders ?? false,
    p_auto_assign_assignee_id:
      payload.auto_assign_assignee_id == null
        ? null
        : toId(payload.auto_assign_assignee_id),
  });

  if (error) throw new Error(toErrorMessage(error));
}

export async function runAssetPreventiveSchedulerNow(): Promise<AssetPreventiveSchedulerResult> {
  const { data, error } = await supabase.rpc('run_asset_preventive_scheduler');
  return assertOk(
    data as AssetPreventiveSchedulerResult | null,
    error,
    'No se pudo ejecutar el scheduler preventivo.'
  );
}

/** Actualizar activo (tabla assets) */
export async function updateAsset(payload: AssetUpdate): Promise<Asset> {
  const { id, ...patch } = payload;

  const { data, error } = await supabase
    .from('assets')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  return assertOk(data, error, 'No se pudo actualizar el activo.');
}

/** Soft delete (is_active=false). No borra registros. */
export async function deactivateAsset(
  id: BigIntLike
): Promise<Pick<Asset, 'id' | 'is_active'>> {
  const { data, error } = await supabase
    .from('assets')
    .update({ is_active: false })
    .eq('id', id)
    .select('id,is_active')
    .single();

  return assertOk(data, error, 'No se pudo desactivar el activo.');
}

/** Reactivar (is_active=true) */
export async function activateAsset(
  id: BigIntLike
): Promise<Pick<Asset, 'id' | 'is_active'>> {
  const { data, error } = await supabase
    .from('assets')
    .update({ is_active: true })
    .eq('id', id)
    .select('id,is_active')
    .single();

  return assertOk(data, error, 'No se pudo activar el activo.');
}

/**
 * Cambiar estado del activo (status) y registrar historial.
 * Nota: aquí lo hacemos en 2 pasos (update + insert history).
 * Más adelante puedes moverlo a una RPC/trigger para hacerlo atómico.
 */
export async function changeAssetStatus(params: {
  asset_id: BigIntLike;
  to_status: AssetStatus;
  note?: string | null;
}): Promise<{ asset: Asset; history: AssetStatusHistory }> {
  // 1) leer estado actual
  const current = await getAssetById(params.asset_id);
  const from_status = current?.status ?? null;

  // 2) update asset
  const { data: asset, error: assetErr } = await supabase
    .from('assets')
    .update({ status: params.to_status })
    .eq('id', params.asset_id)
    .select('*')
    .single();

  const updatedAsset = assertOk(
    asset,
    assetErr,
    'No se pudo cambiar el estado.'
  );

  // 3) insert history
  const historyPayload: AssetStatusHistoryInsert = {
    asset_id: params.asset_id,
    from_status,
    to_status: params.to_status,
    note: params.note ?? null,
    changed_by: null,
  };

  const { data: hist, error: histErr } = await supabase
    .from('asset_status_history')
    .insert(historyPayload)
    .select('*')
    .single();

  const history = assertOk(hist, histErr, 'No se pudo registrar el historial.');

  return { asset: updatedAsset, history };
}

// ============ STATUS HISTORY ============

export async function getAssetStatusHistory(
  asset_id: BigIntLike
): Promise<AssetStatusHistory[]> {
  const { data, error } = await supabase
    .from('asset_status_history')
    .select('*')
    .eq('asset_id', asset_id)
    .order('changed_at', { ascending: false });

  return assertOk(data, error, 'No se pudo obtener el historial de estado.');
}

// ============ MAINTENANCE LOG ============

export async function getAssetMaintenanceLog(
  asset_id: BigIntLike
): Promise<AssetMaintenanceLog[]> {
  const { data, error } = await supabase
    .from('asset_maintenance_log')
    .select('*')
    .eq('asset_id', asset_id)
    .order('performed_at', { ascending: false });

  return assertOk(
    data,
    error,
    'No se pudo obtener el historial de mantenimiento.'
  );
}

export async function createAssetMaintenanceLog(
  payload: AssetMaintenanceLogInsert
): Promise<AssetMaintenanceLog> {
  const { data, error } = await supabase
    .from('asset_maintenance_log')
    .insert(payload)
    .select('*')
    .single();

  return assertOk(data, error, 'No se pudo registrar el mantenimiento.');
}

/** Registra una entrada de mantenimiento al vincular activo+ticket (si no existe ya). */
export async function ensureMaintenanceLogForTicketAsset(params: {
  asset_id: BigIntLike;
  ticket_id: BigIntLike;
  ticket_title?: string | null;
  ticket_status?: string | null;
  requester?: string | null;
}): Promise<AssetMaintenanceLog | null> {
  const assetId = toId(params.asset_id);
  const ticketId = toId(params.ticket_id);

  const { data: existing, error: existingError } = await supabase
    .from('asset_maintenance_log')
    .select('id')
    .eq('asset_id', assetId)
    .eq('ticket_id', ticketId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(toErrorMessage(existingError));
  }

  if (existing?.id) return null;

  const title = (params.ticket_title ?? '').trim();
  const requester = (params.requester ?? '').trim();
  const status = (params.ticket_status ?? '').trim();

  const summary = title
    ? `OT #${ticketId} - ${title}`
    : `OT #${ticketId} vinculada al activo`;

  const details = [
    `Vinculación automática desde ticket #${ticketId}.`,
    requester ? `Solicitante: ${requester}.` : null,
    status ? `Estado del ticket: ${status}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return createAssetMaintenanceLog({
    asset_id: assetId,
    ticket_id: ticketId,
    maintenance_type: 'CORRECTIVO',
    summary,
    details: details || null,
    performed_at: new Date().toISOString(),
    performed_by: null,
    labor_cost: 0,
    parts_cost: 0,
    other_cost: 0,
    downtime_minutes: 0,
    created_by: null,
  });
}

// (Opcional) eliminar log de mantenimiento
export async function deleteAssetMaintenanceLog(id: BigIntLike): Promise<void> {
  const { error } = await supabase
    .from('asset_maintenance_log')
    .delete()
    .eq('id', id);
  if (error) throw new Error(toErrorMessage(error));
}

// ============ TICKET-ASSETS (many-to-many) ============

export async function getTicketAssetsByTicketId(
  ticket_id: BigIntLike
): Promise<TicketAsset[]> {
  const { data, error } = await supabase
    .from('ticket_assets')
    .select('*')
    .eq('ticket_id', ticket_id);

  return assertOk(
    data,
    error,
    'No se pudieron obtener los activos del ticket.'
  );
}

export async function getTicketAssetsByAssetId(
  asset_id: BigIntLike
): Promise<TicketAsset[]> {
  const { data, error } = await supabase
    .from('ticket_assets')
    .select('*')
    .eq('asset_id', asset_id);

  return assertOk(
    data,
    error,
    'No se pudieron obtener los tickets del activo.'
  );
}

/** Vista: tickets asociados a un activo (trae t.* + location_name) */
export async function getAssetTicketsView(
  asset_id: BigIntLike
): Promise<AssetTicketView[]> {
  const { data, error } = await supabase
    .from('v_asset_tickets')
    .select('*')
    .eq('asset_id', asset_id)
    .order('id', { ascending: false });

  return assertOk(
    data,
    error,
    'No se pudieron obtener los tickets del activo.'
  );
}

export async function linkAssetToTicket(
  payload: TicketAssetInsert
): Promise<TicketAsset> {
  const { data, error } = await supabase
    .from('ticket_assets')
    .insert(payload)
    .select('*')
    .single();

  return assertOk(data, error, 'No se pudo asociar el activo al ticket.');
}

export async function unlinkAssetFromTicket(params: {
  ticket_id: BigIntLike;
  asset_id: BigIntLike;
}): Promise<void> {
  const { error } = await supabase
    .from('ticket_assets')
    .delete()
    .eq('ticket_id', params.ticket_id)
    .eq('asset_id', params.asset_id);

  if (error) throw new Error(toErrorMessage(error));
}

/**
 * Setear activo primario en un ticket:
 * - pone is_primary=false a todos los activos del ticket
 * - pone is_primary=true al asset_id indicado
 */
export async function setPrimaryAssetForTicket(params: {
  ticket_id: BigIntLike;
  asset_id: BigIntLike;
}): Promise<void> {
  // 1) reset all
  const { error: resetErr } = await supabase
    .from('ticket_assets')
    .update({ is_primary: false })
    .eq('ticket_id', params.ticket_id);

  if (resetErr) throw new Error(toErrorMessage(resetErr));

  // 2) set selected
  const { error: setErr } = await supabase
    .from('ticket_assets')
    .update({ is_primary: true })
    .eq('ticket_id', params.ticket_id)
    .eq('asset_id', params.asset_id);

  if (setErr) throw new Error(toErrorMessage(setErr));
}
