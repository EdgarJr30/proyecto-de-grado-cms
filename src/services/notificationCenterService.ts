import { supabase } from '../lib/supabaseClient';

export type NotificationCategory =
  | 'assignments'
  | 'comments'
  | 'status_changes'
  | 'deadlines'
  | 'admin_system';

export type NotificationFeedScope = 'all' | 'unread' | 'tickets' | 'admin';

export type NotificationItem = {
  deliveryId: string;
  eventId: string;
  eventType: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  category: NotificationCategory;
  channelMask: number;
  title: string;
  message: string;
  url: string;
  createdAt: string;
  readAt: string | null;
  seenAt: string | null;
  deliveredAt: string | null;
  payload: Record<string, unknown>;
};

export type NotificationPreferences = {
  push_enabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  quiet_hours?: {
    from?: string;
    to?: string;
  };
};

export type NotificationTestTarget = {
  userId: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
  hasPushSubscription: boolean;
  lastPushSeenAt: string | null;
};

type DeliveryRow = {
  id: string;
  event_id: string;
  channel_mask: number | null;
  read_at: string | null;
  seen_at: string | null;
  delivered_at: string | null;
  created_at: string;
  notification_events:
    | NotificationEventRow
    | NotificationEventRow[]
    | null;
};

type NotificationEventRow = {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string;
  payload: unknown;
  created_at: string;
};

type NotificationTestTargetRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  has_push_subscription: boolean;
  last_push_seen_at: string | null;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  push_enabled: false,
  categories: {
    assignments: true,
    comments: true,
    status_changes: true,
    deadlines: true,
    admin_system: true,
  },
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (isObjectRecord(value)) return value;
  return {};
}

function resolveEventRow(row: DeliveryRow): NotificationEventRow | null {
  const raw = row.notification_events;
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

export function deriveNotificationCategory(
  eventType: string
): NotificationCategory {
  if (eventType === 'ticket.assigned' || eventType === 'ticket.unassigned') {
    return 'assignments';
  }
  if (eventType === 'ticket.comment_added') {
    return 'comments';
  }
  if (
    eventType === 'ticket.status_changed' ||
    eventType === 'ticket.accepted' ||
    eventType === 'ticket.priority_changed' ||
    eventType === 'ticket.urgent_changed' ||
    eventType === 'ticket.finalized'
  ) {
    return 'status_changes';
  }
  if (
    eventType === 'ticket.deadline_set' ||
    eventType === 'ticket.deadline_changed' ||
    eventType === 'ticket.due_soon' ||
    eventType === 'ticket.overdue'
  ) {
    return 'deadlines';
  }
  return 'admin_system';
}

function resolveNotificationUrl(
  payload: Record<string, unknown>,
  entityType: string,
  entityId: string
) {
  const payloadUrl = payload.url;
  if (typeof payloadUrl === 'string' && payloadUrl.startsWith('/')) {
    return payloadUrl;
  }
  if (entityType === 'ticket') {
    return `/tickets/${entityId}`;
  }
  return '/inicio';
}

function formatDefaultTitle(eventType: string, entityType: string, entityId: string) {
  if (entityType === 'ticket') {
    return `Ticket #${entityId}`;
  }
  return eventType;
}

function formatDefaultMessage(eventType: string) {
  switch (eventType) {
    case 'ticket.created':
      return 'Se creó un nuevo ticket.';
    case 'ticket.assigned':
      return 'Tienes una nueva asignación.';
    case 'ticket.unassigned':
      return 'Se actualizó una desasignación.';
    case 'ticket.comment_added':
      return 'Hay un nuevo comentario.';
    case 'ticket.status_changed':
      return 'El estado del ticket cambió.';
    case 'ticket.accepted':
      return 'El ticket fue aceptado.';
    case 'ticket.finalized':
      return 'El ticket fue finalizado.';
    case 'ticket.deadline_set':
      return 'Se estableció una fecha límite.';
    case 'ticket.deadline_changed':
      return 'Se actualizó la fecha límite.';
    case 'ticket.due_soon':
      return 'El ticket vencerá pronto.';
    case 'ticket.overdue':
      return 'El ticket está vencido.';
    default:
      return 'Tienes una nueva notificación.';
  }
}

function mapNotificationRow(row: DeliveryRow): NotificationItem | null {
  const event = resolveEventRow(row);
  if (!event) return null;

  const payload = parsePayload(event.payload);
  const payloadTitle = payload.title;
  const payloadMessage = payload.message;

  const title =
    typeof payloadTitle === 'string' && payloadTitle.trim().length > 0
      ? payloadTitle
      : formatDefaultTitle(event.event_type, event.entity_type, event.entity_id);

  const message =
    typeof payloadMessage === 'string' && payloadMessage.trim().length > 0
      ? payloadMessage
      : formatDefaultMessage(event.event_type);

  return {
    deliveryId: row.id,
    eventId: event.id,
    eventType: event.event_type,
    actorUserId: event.actor_user_id,
    entityType: event.entity_type,
    entityId: event.entity_id,
    category: deriveNotificationCategory(event.event_type),
    channelMask: row.channel_mask ?? 1,
    title,
    message,
    url: resolveNotificationUrl(payload, event.entity_type, event.entity_id),
    createdAt: row.created_at,
    readAt: row.read_at,
    seenAt: row.seen_at,
    deliveredAt: row.delivered_at,
    payload,
  };
}

function normalizePreferences(value: unknown): NotificationPreferences {
  if (!isObjectRecord(value)) return { ...DEFAULT_NOTIFICATION_PREFERENCES };

  const categoriesRaw = isObjectRecord(value.categories) ? value.categories : {};
  const quietHoursRaw = isObjectRecord(value.quiet_hours) ? value.quiet_hours : {};

  return {
    push_enabled:
      typeof value.push_enabled === 'boolean'
        ? value.push_enabled
        : DEFAULT_NOTIFICATION_PREFERENCES.push_enabled,
    categories: {
      assignments:
        typeof categoriesRaw.assignments === 'boolean'
          ? categoriesRaw.assignments
          : DEFAULT_NOTIFICATION_PREFERENCES.categories.assignments,
      comments:
        typeof categoriesRaw.comments === 'boolean'
          ? categoriesRaw.comments
          : DEFAULT_NOTIFICATION_PREFERENCES.categories.comments,
      status_changes:
        typeof categoriesRaw.status_changes === 'boolean'
          ? categoriesRaw.status_changes
          : DEFAULT_NOTIFICATION_PREFERENCES.categories.status_changes,
      deadlines:
        typeof categoriesRaw.deadlines === 'boolean'
          ? categoriesRaw.deadlines
          : DEFAULT_NOTIFICATION_PREFERENCES.categories.deadlines,
      admin_system:
        typeof categoriesRaw.admin_system === 'boolean'
          ? categoriesRaw.admin_system
          : DEFAULT_NOTIFICATION_PREFERENCES.categories.admin_system,
    },
    quiet_hours: {
      from:
        typeof quietHoursRaw.from === 'string' ? quietHoursRaw.from : undefined,
      to: typeof quietHoursRaw.to === 'string' ? quietHoursRaw.to : undefined,
    },
  };
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(getErrorMessage(error, 'No se pudo validar la sesión.'));
  }
  if (!user?.id) {
    throw new Error('No hay sesión activa.');
  }
  return user.id;
}

export async function listNotifications(params: {
  scope: NotificationFeedScope;
  offset?: number;
  limit?: number;
}): Promise<{ items: NotificationItem[]; total: number }> {
  const userId = await getCurrentUserId();
  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.max(1, params.limit ?? 20);

  let query = supabase
    .from('notification_deliveries')
    .select(
      `
      id,
      event_id,
      channel_mask,
      read_at,
      seen_at,
      delivered_at,
      created_at,
      notification_events!inner(
        id,
        event_type,
        actor_user_id,
        entity_type,
        entity_id,
        payload,
        created_at
      )
    `,
      { count: 'exact' }
    )
    .eq('recipient_user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.scope === 'unread') {
    query = query.is('read_at', null);
  } else if (params.scope === 'tickets') {
    query = query.like('notification_events.event_type', 'ticket.%');
  } else if (params.scope === 'admin') {
    query = query.not('notification_events.event_type', 'like', 'ticket.%');
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(getErrorMessage(error, 'No se pudo cargar notificaciones.'));
  }

  const mapped = ((data ?? []) as DeliveryRow[])
    .map((row) => mapNotificationRow(row))
    .filter((row): row is NotificationItem => Boolean(row));

  return {
    items: mapped,
    total: count ?? 0,
  };
}

export async function getUnreadNotificationsCount(): Promise<number> {
  const userId = await getCurrentUserId();

  const { count, error } = await supabase
    .from('notification_deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_user_id', userId)
    .is('read_at', null);

  if (error) {
    throw new Error(getErrorMessage(error, 'No se pudo obtener el total pendiente.'));
  }

  return count ?? 0;
}

export async function markNotificationRead(deliveryId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('notification_deliveries')
    .update({ read_at: now, seen_at: now })
    .eq('id', deliveryId)
    .eq('recipient_user_id', userId)
    .is('read_at', null);

  if (error) {
    throw new Error(getErrorMessage(error, 'No se pudo marcar como leída.'));
  }
}

export async function markNotificationUnread(deliveryId: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('notification_deliveries')
    .update({ read_at: null })
    .eq('id', deliveryId)
    .eq('recipient_user_id', userId)
    .not('read_at', 'is', null);

  if (error) {
    throw new Error(getErrorMessage(error, 'No se pudo marcar como no leída.'));
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('notification_deliveries')
    .update({ read_at: now, seen_at: now })
    .eq('recipient_user_id', userId)
    .is('read_at', null);

  if (error) {
    throw new Error(getErrorMessage(error, 'No se pudo marcar todo como leído.'));
  }
}

export async function markNotificationsSeen(deliveryIds: string[]): Promise<void> {
  if (deliveryIds.length === 0) return;

  const userId = await getCurrentUserId();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('notification_deliveries')
    .update({ seen_at: now })
    .eq('recipient_user_id', userId)
    .in('id', deliveryIds)
    .is('seen_at', null);

  if (error) {
    throw new Error(getErrorMessage(error, 'No se pudo actualizar estado de vistas.'));
  }
}

export async function getUnreadTicketCommentNotificationCounts(): Promise<
  Record<number, number>
> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('notification_deliveries')
    .select(
      `
      id,
      notification_events!inner(
        event_type,
        entity_type,
        entity_id
      )
    `
    )
    .eq('recipient_user_id', userId)
    .is('read_at', null)
    .eq('notification_events.event_type', 'ticket.comment_added')
    .eq('notification_events.entity_type', 'ticket');

  if (error) {
    throw new Error(
      getErrorMessage(error, 'No se pudieron cargar mensajes pendientes por ticket.')
    );
  }

  const counts: Record<number, number> = {};
  for (const row of (data ?? []) as DeliveryRow[]) {
    const event = resolveEventRow(row);
    const ticketId = Number(event?.entity_id ?? '');
    if (!Number.isInteger(ticketId) || ticketId <= 0) continue;
    counts[ticketId] = (counts[ticketId] ?? 0) + 1;
  }

  return counts;
}

export async function markTicketCommentNotificationsRead(
  ticketId: number
): Promise<void> {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('notification_deliveries')
    .select(
      `
      id,
      notification_events!inner(
        event_type,
        entity_type,
        entity_id
      )
    `
    )
    .eq('recipient_user_id', userId)
    .is('read_at', null)
    .eq('notification_events.event_type', 'ticket.comment_added')
    .eq('notification_events.entity_type', 'ticket')
    .eq('notification_events.entity_id', String(ticketId));

  if (error) {
    throw new Error(
      getErrorMessage(error, 'No se pudieron localizar notificaciones del ticket.')
    );
  }

  const deliveryIds = ((data ?? []) as DeliveryRow[])
    .map((row) => row.id)
    .filter((id) => typeof id === 'string' && id.length > 0);

  if (deliveryIds.length === 0) return;

  const { error: updateError } = await supabase
    .from('notification_deliveries')
    .update({ read_at: now, seen_at: now })
    .eq('recipient_user_id', userId)
    .in('id', deliveryIds)
    .is('read_at', null);

  if (updateError) {
    throw new Error(
      getErrorMessage(updateError, 'No se pudieron marcar como leídos los mensajes del ticket.')
    );
  }
}

export async function getMyNotificationPreferences(): Promise<NotificationPreferences> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('prefs')
    .eq('user_id', userId)
    .maybeSingle<{ prefs: unknown }>();

  if (error) {
    throw new Error(getErrorMessage(error, 'No se pudo cargar preferencias.'));
  }

  if (!data) {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  return normalizePreferences(data.prefs);
}

export async function saveMyNotificationPreferences(
  preferences: NotificationPreferences
): Promise<NotificationPreferences> {
  const userId = await getCurrentUserId();
  const normalized = normalizePreferences(preferences);

  const { error } = await supabase.from('notification_preferences').upsert(
    {
      user_id: userId,
      prefs: normalized,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    }
  );

  if (error) {
    throw new Error(getErrorMessage(error, 'No se pudieron guardar las preferencias.'));
  }

  return normalized;
}

export async function listAdminNotificationTestTargets(
  search: string,
  limit = 25
): Promise<NotificationTestTarget[]> {
  const normalizedSearch = search.trim();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);

  const { data, error } = await supabase.rpc('admin_list_notification_targets', {
    p_search: normalizedSearch.length > 0 ? normalizedSearch : null,
    p_limit: safeLimit,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, 'No se pudieron cargar usuarios para pruebas push.')
    );
  }

  return ((data ?? []) as NotificationTestTargetRow[]).map((row) => ({
    userId: row.user_id,
    fullName:
      (row.full_name ?? '').trim().length > 0
        ? row.full_name ?? ''
        : row.email ?? row.user_id,
    email: row.email,
    isActive: row.is_active,
    hasPushSubscription: row.has_push_subscription,
    lastPushSeenAt: row.last_push_seen_at,
  }));
}

export async function sendAdminTestNotification(params: {
  recipientUserId: string;
  title: string;
  message: string;
  url?: string;
  sendPush: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc('admin_send_test_notification', {
    p_recipient_user_id: params.recipientUserId,
    p_title: params.title,
    p_message: params.message,
    p_url: params.url ?? '/notificaciones',
    p_send_push: params.sendPush,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, 'No se pudo enviar la notificación de prueba.')
    );
  }

  if (typeof data !== 'string' || data.trim().length === 0) {
    throw new Error('La respuesta del servidor no devolvió un event_id válido.');
  }

  return data;
}

export async function sendSelfTestNotification(params?: {
  title?: string;
  message?: string;
  sendPush?: boolean;
}): Promise<string> {
  const titleInput = params?.title?.trim() ?? '';
  const messageInput = params?.message?.trim() ?? '';
  const title =
    titleInput.length > 0 ? titleInput : 'Prueba de notificaciones';
  const message =
    messageInput.length > 0
      ? messageInput
      : 'Esta es una notificación de prueba para tu dispositivo.';
  const sendPush = params?.sendPush ?? true;

  const { data, error } = await supabase.rpc('send_self_test_notification', {
    p_title: title,
    p_message: message,
    p_send_push: sendPush,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, 'No se pudo enviar la notificación de prueba.')
    );
  }

  if (typeof data !== 'string' || data.trim().length === 0) {
    throw new Error('La respuesta del servidor no devolvió un event_id válido.');
  }

  return data;
}

export function subscribeToMyNotificationDeliveries(
  userId: string,
  onChange: () => void
) {
  const randomToken =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const channelName = `notification-deliveries:${userId}:${randomToken}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notification_deliveries',
        filter: `recipient_user_id=eq.${userId}`,
      },
      () => onChange()
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
