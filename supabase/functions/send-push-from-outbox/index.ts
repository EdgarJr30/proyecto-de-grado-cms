import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type ClaimedOutboxRow = {
  outbox_id: string;
  delivery_id: string;
  attempts: number;
  recipient_user_id: string;
  event_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown> | null;
  event_created_at: string;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushError = {
  statusCode?: number;
  body?: string;
  message?: string;
};

type RowResult = {
  outboxId: string;
  sent: boolean;
  reason: string | null;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT =
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:notifications@example.com';
const CRON_SECRET = Deno.env.get('PUSH_OUTBOX_CRON_SECRET') ?? '';
const MAX_ATTEMPTS = Number(Deno.env.get('PUSH_OUTBOX_MAX_ATTEMPTS') ?? '8');
const BACKOFF_BASE_SECONDS = Number(
  Deno.env.get('PUSH_OUTBOX_BACKOFF_BASE_SECONDS') ?? '15'
);
const BACKOFF_MAX_SECONDS = Number(
  Deno.env.get('PUSH_OUTBOX_BACKOFF_MAX_SECONDS') ?? '900'
);
const PROCESSING_LEASE_SECONDS = Number(
  Deno.env.get('PUSH_OUTBOX_PROCESSING_LEASE_SECONDS') ?? '120'
);
const MAX_PARALLEL_SENDS = Number(
  Deno.env.get('PUSH_OUTBOX_MAX_PARALLEL_SENDS') ?? '8'
);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos.');
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error('VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY son requeridos.');
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function getPushErrorStatus(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as PushError).statusCode;
    if (typeof statusCode === 'number') return statusCode;
  }
  return null;
}

function getPushErrorBody(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const body = (error as PushError).body;
    if (typeof body === 'string' && body.trim().length > 0) return body;

    const message = (error as PushError).message;
    if (typeof message === 'string' && message.trim().length > 0) return message;
  }
  return 'unknown_push_error';
}

function normalizeInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.trunc(value);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

function computeBackoff(attempts: number) {
  const baseSeconds = normalizeInt(BACKOFF_BASE_SECONDS, 1, 300, 15);
  const maxSeconds = normalizeInt(BACKOFF_MAX_SECONDS, baseSeconds, 3600, 900);
  const exponent = Math.max(0, Math.min(attempts - 1, 10));
  const delaySeconds = Math.min(baseSeconds * 2 ** exponent, maxSeconds);
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
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
  return '/notificaciones';
}

function resolveTitle(
  payload: Record<string, unknown>,
  eventType: string,
  entityType: string,
  entityId: string
) {
  const payloadTitle = payload.title;
  if (typeof payloadTitle === 'string' && payloadTitle.trim().length > 0) {
    return payloadTitle;
  }

  if (entityType === 'ticket') {
    return `Ticket #${entityId}`;
  }

  return eventType;
}

function resolveBody(payload: Record<string, unknown>, eventType: string) {
  const payloadMessage = payload.message;
  if (typeof payloadMessage === 'string' && payloadMessage.trim().length > 0) {
    return payloadMessage;
  }

  switch (eventType) {
    case 'ticket.assigned':
      return 'Tienes una nueva asignación.';
    case 'ticket.comment_added':
      return 'Se agregó un nuevo comentario.';
    case 'ticket.overdue':
      return 'Este ticket está vencido.';
    case 'ticket.due_soon':
      return 'Este ticket vencerá pronto.';
    default:
      return 'Tienes una nueva notificación.';
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function markOutboxSent(
  outboxId: string,
  attempts: number,
  lastError: string | null
) {
  const { error } = await supabase
    .from('notification_outbox')
    .update({
      status: 'sent',
      attempts,
      last_error: lastError,
      sent_at: new Date().toISOString(),
      next_attempt_at: new Date().toISOString(),
    })
    .eq('id', outboxId);

  if (error) {
    throw new Error(
      getErrorMessage(error, 'No se pudo actualizar outbox a sent.')
    );
  }
}

async function markOutboxRetryOrError(
  outboxId: string,
  attempts: number,
  lastError: string
) {
  const safeMaxAttempts = normalizeInt(MAX_ATTEMPTS, 1, 20, 8);
  const isFinalError = attempts >= safeMaxAttempts;

  const { error } = await supabase
    .from('notification_outbox')
    .update({
      status: isFinalError ? 'error' : 'pending',
      attempts,
      last_error: lastError,
      next_attempt_at: isFinalError
        ? new Date().toISOString()
        : computeBackoff(attempts),
      sent_at: null,
    })
    .eq('id', outboxId);

  if (error) {
    throw new Error(
      getErrorMessage(error, 'No se pudo actualizar outbox a retry/error.')
    );
  }
}

async function clearExpiredSubscriptions(endpoints: string[]) {
  if (endpoints.length === 0) return;

  const uniqueEndpoints = Array.from(new Set(endpoints));

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .in('endpoint', uniqueEndpoints);

  if (error) {
    throw new Error(
      getErrorMessage(error, 'No se pudieron limpiar suscripciones expiradas.')
    );
  }
}

async function claimOutboxRows(limit: number, outboxId?: string) {
  const safeLimit = normalizeInt(limit, 1, 250, 100);
  const leaseSeconds = normalizeInt(PROCESSING_LEASE_SECONDS, 15, 900, 120);

  const { data, error } = await supabase.rpc('claim_notification_outbox_batch', {
    p_limit: outboxId ? 1 : safeLimit,
    p_outbox_id: outboxId ?? null,
    p_processing_timeout_seconds: leaseSeconds,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, 'No se pudieron reclamar filas de notification_outbox.')
    );
  }

  return (data ?? []) as unknown as ClaimedOutboxRow[];
}

async function fetchSubscriptions(userId: string) {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (error) {
    throw new Error(
      getErrorMessage(error, 'No se pudieron cargar suscripciones push.')
    );
  }

  return (data ?? []) as unknown as PushSubscriptionRow[];
}

async function sendPushForOutboxRow(row: ClaimedOutboxRow): Promise<RowResult> {
  const outboxId = row.outbox_id;
  const attempts = row.attempts + 1;

  const subscriptions = await fetchSubscriptions(row.recipient_user_id);
  if (subscriptions.length === 0) {
    await markOutboxSent(outboxId, attempts, 'no_subscriptions');
    return { outboxId, sent: false, reason: 'no_subscriptions' };
  }

  const payload = row.payload ?? {};
  const title = resolveTitle(payload, row.event_type, row.entity_type, row.entity_id);
  const body = resolveBody(payload, row.event_type);
  const url = resolveNotificationUrl(payload, row.entity_type, row.entity_id);

  const pushPayload = JSON.stringify({
    title,
    body,
    url,
    tag: `${row.event_type}:${row.delivery_id}`,
    data: {
      event_id: row.event_id,
      delivery_id: row.delivery_id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
    },
  });

  const settled = await Promise.allSettled(
    subscriptions.map((subscription) =>
      webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        pushPayload,
        { TTL: 60 }
      )
    )
  );

  let delivered = false;
  const errors: string[] = [];
  const expiredEndpoints: string[] = [];

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      delivered = true;
      return;
    }

    const subscription = subscriptions[index];
    const status = getPushErrorStatus(result.reason);
    const bodyError = getPushErrorBody(result.reason);
    errors.push(
      `endpoint=${subscription.endpoint} status=${status ?? 'na'} ${bodyError}`
    );

    if (status === 404 || status === 410) {
      expiredEndpoints.push(subscription.endpoint);
    }
  });

  if (expiredEndpoints.length > 0) {
    await clearExpiredSubscriptions(expiredEndpoints);
  }

  if (delivered) {
    await markOutboxSent(
      outboxId,
      attempts,
      errors.length > 0 ? errors.join(' | ') : null
    );
    return { outboxId, sent: true, reason: null };
  }

  const reason = errors.join(' | ') || 'push_send_failed';
  await markOutboxRetryOrError(outboxId, attempts, reason);
  return { outboxId, sent: false, reason: 'push_send_failed' };
}

async function processRows(rows: ClaimedOutboxRow[], parallelism: number) {
  const maxParallel = normalizeInt(parallelism, 1, 25, 8);
  const queue = [...rows];
  const results: RowResult[] = [];

  const workers = Array.from(
    { length: Math.min(maxParallel, queue.length) },
    async () => {
      while (queue.length > 0) {
        const row = queue.shift();
        if (!row) continue;

        try {
          const result = await sendPushForOutboxRow(row);
          results.push(result);
        } catch (error: unknown) {
          const attempts = row.attempts + 1;
          const message = getErrorMessage(
            error,
            'Unexpected error processing notification outbox row.'
          );
          await markOutboxRetryOrError(row.outbox_id, attempts, message);
          results.push({ outboxId: row.outbox_id, sent: false, reason: message });
        }
      }
    }
  );

  await Promise.all(workers);
  return results;
}

Deno.serve(async (request: Request) => {
  const corsHeaders = buildCorsHeaders();

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (CRON_SECRET) {
    const headerSecret = request.headers.get('x-cron-secret');
    if (headerSecret !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const url = new URL(request.url);
  const requestedOutboxIdRaw = (url.searchParams.get('outbox_id') ?? '').trim();
  const requestedOutboxId =
    requestedOutboxIdRaw.length > 0 ? requestedOutboxIdRaw : undefined;

  if (requestedOutboxId && !isUuid(requestedOutboxId)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid outbox_id format.' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const limitQuery = Number(url.searchParams.get('limit') ?? '100');
  const limit = normalizeInt(limitQuery, 1, 250, 100);

  try {
    const claimedRows = await claimOutboxRows(
      requestedOutboxId ? 1 : limit,
      requestedOutboxId
    );

    if (claimedRows.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          mode: requestedOutboxId ? 'single' : 'batch',
          outbox_id: requestedOutboxId ?? null,
          claimed: 0,
          processed: 0,
          sent: 0,
          failed: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const results = await processRows(claimedRows, MAX_PARALLEL_SENDS);

    const processed = results.length;
    const sent = results.filter((row) => row.sent).length;
    const failed = processed - sent;

    return new Response(
      JSON.stringify({
        ok: true,
        mode: requestedOutboxId ? 'single' : 'batch',
        outbox_id: requestedOutboxId ?? null,
        claimed: claimedRows.length,
        processed,
        sent,
        failed,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: getErrorMessage(error, 'Unexpected error processing outbox.'),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
