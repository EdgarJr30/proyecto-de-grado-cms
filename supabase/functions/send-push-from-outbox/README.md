# send-push-from-outbox

Procesa filas del `public.notification_outbox`, envía Web Push con VAPID y actualiza estado/reintentos.

## Qué cambió para baja latencia

- Soporte `outbox_id` para procesar una fila específica inmediatamente.
- Claim transaccional (vía `claim_notification_outbox_batch`) para evitar doble envío con múltiples workers.
- Estado `processing` con lease (si un worker cae, otra ejecución puede retomar).
- Retry correcto: vuelve a `pending` con backoff hasta `MAX_ATTEMPTS`; luego pasa a `error`.
- Envío paralelo controlado para soportar múltiples usuarios/eventos al mismo tiempo.

## Variables requeridas

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

## Variables opcionales

- `VAPID_SUBJECT` (default: `mailto:notifications@example.com`)
- `PUSH_OUTBOX_CRON_SECRET` (si se define, exige header `x-cron-secret`)
- `PUSH_OUTBOX_MAX_ATTEMPTS` (default: `8`)
- `PUSH_OUTBOX_BACKOFF_BASE_SECONDS` (default: `15`)
- `PUSH_OUTBOX_BACKOFF_MAX_SECONDS` (default: `900`)
- `PUSH_OUTBOX_PROCESSING_LEASE_SECONDS` (default: `120`)
- `PUSH_OUTBOX_MAX_PARALLEL_SENDS` (default: `8`)

## Uso manual

Batch:

```bash
curl -X POST \
  "https://<project-ref>.functions.supabase.co/send-push-from-outbox?limit=100" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "x-cron-secret: <PUSH_OUTBOX_CRON_SECRET>"
```

Inmediato por fila:

```bash
curl -X POST \
  "https://<project-ref>.functions.supabase.co/send-push-from-outbox?outbox_id=<uuid>&limit=1" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "x-cron-secret: <PUSH_OUTBOX_CRON_SECRET>"
```

## Programación recomendada

- Mantener cron de respaldo cada 1 minuto.
- Activar despacho instantáneo desde DB trigger (migración `202603012030_push_outbox_realtime_dispatch.sql`).
- Modelo recomendado: trigger inmediato + cron de respaldo (no solo cron).
