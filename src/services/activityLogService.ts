import { supabase } from '../lib/supabaseClient';

export type ActivityLogItem = {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorLabel: string | null;
  actorRole: string | null;
  action: string;
  resource: string;
  entityId: string | null;
  entityLabel: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
};

export type ActivityLogFilters = {
  search?: string;
  resource?: string;
  entityId?: string;
  action?: string;
  actorUserId?: string;
  /** ISO timestamp (inclusive lower bound) */
  from?: string;
  /** ISO timestamp (inclusive upper bound) */
  to?: string;
};

type ClientErrorSource =
  | 'toast'
  | 'alert'
  | 'window.error'
  | 'unhandledrejection';

type ActivityLogRow = {
  id: string;
  occurred_at: string;
  actor_user_id: string | null;
  actor_label: string | null;
  actor_role: string | null;
  action: string;
  resource: string;
  entity_id: string | null;
  entity_label: string | null;
  summary: string | null;
  metadata: unknown;
  ip_address: string | null;
  user_agent: string | null;
  total_count: number | string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) return message;
  }
  return fallback;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/(password|passwd|pwd|token|secret|apikey|api_key|authorization)=([^&\s]+)/gi, '$1=[omitido]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[omitido]');
}

function cleanLogText(value: unknown, fallback = ''): string {
  const raw =
    typeof value === 'string'
      ? value
      : value == null
        ? fallback
        : (() => {
            try {
              return JSON.stringify(value);
            } catch {
              return String(value);
            }
          })();
  return truncate(redactSensitiveText(raw.trim() || fallback), 1200);
}

function getClientLocationMetadata(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  return {
    path: window.location.pathname,
    search: truncate(redactSensitiveText(window.location.search), 500),
  };
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mapRow(row: ActivityLogRow): ActivityLogItem {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    actorUserId: row.actor_user_id,
    actorLabel: row.actor_label,
    actorRole: row.actor_role,
    action: row.action,
    resource: row.resource,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    summary: row.summary,
    metadata: parseMetadata(row.metadata),
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
  };
}

function buildRpcParams(
  filters: ActivityLogFilters,
  limit: number,
  offset: number
) {
  return {
    p_search: filters.search?.trim() ? filters.search.trim() : null,
    p_resource: filters.resource ? filters.resource : null,
    p_entity_id: filters.entityId ? filters.entityId : null,
    p_action: filters.action ? filters.action : null,
    p_actor: filters.actorUserId ? filters.actorUserId : null,
    p_from: filters.from ? filters.from : null,
    p_to: filters.to ? filters.to : null,
    p_limit: limit,
    p_offset: offset,
  };
}

export async function listActivityLog(params: {
  filters?: ActivityLogFilters;
  offset?: number;
  limit?: number;
}): Promise<{ items: ActivityLogItem[]; total: number }> {
  const filters = params.filters ?? {};
  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.min(Math.max(1, params.limit ?? 25), 200);

  const { data, error } = await supabase.rpc(
    'list_activity_log',
    buildRpcParams(filters, limit, offset)
  );

  if (error) {
    throw new Error(getErrorMessage(error, 'No se pudo cargar la bitácora.'));
  }

  const rows = (data ?? []) as ActivityLogRow[];
  const total = rows.length > 0 ? Number(rows[0].total_count ?? 0) : 0;

  return { items: rows.map(mapRow), total };
}

/**
 * Registra un evento de app (login/logout/export). Best-effort: nunca lanza,
 * para no bloquear el flujo de negocio si el registro falla.
 */
export async function recordActivity(params: {
  action: string;
  resource: string;
  entityId?: string | null;
  entityLabel?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabase.rpc('record_activity', {
      p_action: params.action,
      p_resource: params.resource,
      p_entity_id: params.entityId ?? null,
      p_entity_label: params.entityLabel ?? null,
      p_summary: params.summary ?? null,
      p_metadata: params.metadata ?? {},
      p_user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent : null,
    });
    if (error) {
      console.warn('[activity] record_activity failed:', error.message);
    }
  } catch (e) {
    console.warn('[activity] record_activity threw:', getErrorMessage(e, ''));
  }
}

export function recordClientError(params: {
  source: ClientErrorSource;
  message: unknown;
  title?: unknown;
  stack?: unknown;
  metadata?: Record<string, unknown>;
}): void {
  const message = cleanLogText(params.message, 'Error desconocido');
  const title = params.title ? cleanLogText(params.title) : null;
  const sourceLabel =
    params.source === 'toast'
      ? 'toast de error'
      : params.source === 'alert'
        ? 'alerta de error'
        : 'error no controlado';

  void recordActivity({
    action:
      params.source === 'window.error' || params.source === 'unhandledrejection'
        ? 'client_error.unhandled'
        : 'client_error.displayed',
    resource: 'client_errors',
    entityLabel: title ?? message,
    summary: `Error de cliente registrado desde ${sourceLabel}: ${message}`,
    metadata: {
      source: params.source,
      title,
      message,
      stack: params.stack ? truncate(redactSensitiveText(String(params.stack)), 4000) : null,
      ...getClientLocationMetadata(),
      ...(params.metadata ?? {}),
    },
  });
}

export function recordAuthEvent(kind: 'login' | 'logout'): Promise<void> {
  return recordActivity({
    action: kind === 'login' ? 'auth.login' : 'auth.logout',
    resource: 'auth',
    summary:
      kind === 'login' ? 'Inicio de sesión' : 'Cierre de sesión',
  });
}

const CSV_COLUMNS: Array<{ header: string; pick: (i: ActivityLogItem) => string }> = [
  { header: 'Fecha', pick: (i) => i.occurredAt },
  { header: 'Usuario', pick: (i) => i.actorLabel ?? '' },
  { header: 'Rol', pick: (i) => i.actorRole ?? '' },
  { header: 'Acción', pick: (i) => i.action },
  { header: 'Módulo', pick: (i) => i.resource },
  { header: 'Entidad', pick: (i) => i.entityId ?? '' },
  { header: 'Descripción', pick: (i) => i.summary ?? '' },
  { header: 'Detalle', pick: (i) => JSON.stringify(i.metadata ?? {}) },
];

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function activityLogToCsv(items: ActivityLogItem[]): string {
  const header = CSV_COLUMNS.map((c) => c.header).join(',');
  const rows = items.map((item) =>
    CSV_COLUMNS.map((c) => escapeCsv(c.pick(item))).join(',')
  );
  return [header, ...rows].join('\n');
}

/**
 * Trae hasta `maxRows` filas (paginando) que cumplan los filtros, para exportar.
 * Requiere permiso logs:export (validado en el RPC). Registra el evento.
 */
export async function exportActivityLog(
  filters: ActivityLogFilters,
  maxRows = 1000
): Promise<ActivityLogItem[]> {
  const pageSize = 200;
  const collected: ActivityLogItem[] = [];

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const limit = Math.min(pageSize, maxRows - offset);
    const { items, total } = await listActivityLog({ filters, offset, limit });
    collected.push(...items);
    if (collected.length >= total || items.length < limit) break;
  }

  void recordActivity({
    action: 'activity_log.exported',
    resource: 'logs',
    summary: `Bitácora exportada (${collected.length} registros)`,
    metadata: { count: collected.length, filters },
  });

  return collected;
}
