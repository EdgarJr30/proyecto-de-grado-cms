#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_RECIPIENT_USER_ID = process.env.TEST_RECIPIENT_USER_ID;
const TEST_ACTOR_USER_ID = process.env.TEST_ACTOR_USER_ID ?? null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TEST_RECIPIENT_USER_ID) {
  console.error(
    'Missing env vars. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_RECIPIENT_USER_ID'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const payload = {
    ticket_id: '99999',
    title: 'Smoke test',
    message: 'Evento de prueba desde script local',
    url: '/tickets/99999',
    notify_actor: false,
  };

  const { data: eventId, error: eventError } = await supabase.rpc(
    'create_notification_event',
    {
      p_event_type: 'ticket.status_changed',
      p_actor: TEST_ACTOR_USER_ID,
      p_entity_type: 'ticket',
      p_entity_id: '99999',
      p_payload: payload,
      p_recipient_user_ids: [TEST_RECIPIENT_USER_ID],
      p_channel_mask: 3,
    }
  );

  if (eventError) {
    console.error('create_notification_event failed:', eventError.message);
    process.exit(1);
  }

  const { data: deliveries, error: deliveryError } = await supabase
    .from('notification_deliveries')
    .select('id, event_id, recipient_user_id, channel_mask, read_at, seen_at, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (deliveryError) {
    console.error('delivery query failed:', deliveryError.message);
    process.exit(1);
  }

  const { data: outboxRows, error: outboxError } = await supabase
    .from('notification_outbox')
    .select('id, delivery_id, status, attempts, next_attempt_at, last_error')
    .in(
      'delivery_id',
      (deliveries ?? []).map((d) => d.id)
    );

  if (outboxError) {
    console.error('outbox query failed:', outboxError.message);
    process.exit(1);
  }

  console.log('Notification event created:', eventId);
  console.log('Deliveries:', deliveries ?? []);
  console.log('Outbox rows:', outboxRows ?? []);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Unexpected error:', message);
  process.exit(1);
});
