# SQL Modules

## Estructura

- `core_cmms`: núcleo de CMMS (RBAC, tickets/WO, catálogos base, RLS, policies, seeds, storage/realtime).
- `assets`: módulo de activos fijos.
- `inventory`: reservado para inventario/repuestos.

Archivo de referencia de inventario (sin cambios de contenido):
- `sql/Inventario&RepuestosMantenimiento.sql`

## Orden recomendado de ejecución

### 1) Core CMMS
1. `sql/modules/core_cmms/00_extensions.sql`
2. `sql/modules/core_cmms/01_enums.sql`
3. `sql/modules/core_cmms/02_permission_action.sql`
4. `sql/modules/core_cmms/03_tables.sql`
5. `sql/modules/core_cmms/04_functions_triggers.sql`
6. `sql/modules/core_cmms/05_fk.sql`
7. `sql/modules/core_cmms/06_views.sql`
8. `sql/modules/core_cmms/07_indexes.sql`
9. `sql/modules/core_cmms/08_rls.sql`
10. `sql/modules/core_cmms/09_policies.sql`
11. `sql/modules/core_cmms/10_seed_admin_permissions.sql`
12. `sql/modules/core_cmms/11_seed_bootstrap.sql`
13. `sql/modules/core_cmms/12_updates.sql`
14. `sql/modules/core_cmms/13_realtime.sql`
15. `sql/modules/core_cmms/14_storage.sql`
16. `sql/modules/core_cmms/15_grants_auth.sql`
17. `sql/modules/core_cmms/16_notifications.sql`
18. `sql/modules/core_cmms/17_activity_log.sql`
19. `sql/modules/core_cmms/18_approvals.sql`
20. `sql/modules/core_cmms/19_ticket_collaborators.sql`

### 2) Assets
1. `sql/modules/assets/01_activos_fijos.sql`
2. `sql/modules/assets/02_ticket_assets_policies_patch.sql`
3. `sql/modules/assets/03_preventive_maintenance.sql`
4. `sql/modules/assets/04_asset_manuals.sql`

### 3) Inventory / Repuestos
1. `sql/Inventario&RepuestosMantenimiento.sql`

### 4) Post-SQL bitácora (tras assets/inventory)
- `17_activity_log.sql` engancha el logging genérico a las tablas core. Para
  cubrir también las tablas de `assets` e `inventory` (creadas después), ejecuta
  una vez al final: `SELECT public.refresh_activity_logging();`
- Es idempotente y omite tablas que no existan.

## Notas

- `sql/modules` es la fuente única de verdad para instalación de tenant nuevo desde cero.
- Los SQL de `supabase/migrations` para notificaciones/comentarios fueron consolidados en `core_cmms/16_notifications.sql` y limpiados para evitar duplicidad.
- La policy de escritura de roles (`rbac roles rw`) está en `core_cmms/09_policies.sql`.
- Los bloques de `CREATE TABLE` que estaban en policies fueron movidos a `03_tables.sql`.
- Las políticas de `storage.objects` fueron movidas a `14_storage.sql`.
- Se preservó la lógica funcional original; solo se reorganizaron bloques y se aplicaron ajustes de idempotencia/sintaxis.
- `Inventory / Repuestos` se mantiene como módulo independiente y no debe ejecutarse junto a `core_cmms` en la misma base si comparten objetos homónimos (por ejemplo `warehouses`, `uoms`).

## Post-SQL obligatorio (Notificaciones + Push)

Después de ejecutar `core_cmms/16_notifications.sql`, completa esta configuración en Supabase:

1. Realtime:
- Verifica que `public.notification_deliveries` y `public.ticket_comments` estén en `supabase_realtime`.
- Verifica `REPLICA IDENTITY FULL` en ambas tablas.

2. Edge Function push:
- Deploy de `supabase/functions/send-push-from-outbox`.
- Configura secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.
- Opcional: `VAPID_SUBJECT`, `PUSH_OUTBOX_CRON_SECRET`.

3. Worker de despacho:
- Configura despacho inmediato (trigger DB por `pg_net` o Database Webhook).
- Configura cron de respaldo cada 1 minuto a `send-push-from-outbox?limit=100`.

4. Frontend:
- Configura `VITE_WEB_PUSH_PUBLIC_KEY` en `.env`.

Para el paso a paso completo (headers del webhook, curl de prueba, QA móvil), usa la guía principal en [README.md](/Users/edgarperez/Documents/code/2026/ProyectoDeGrado/proyectodegrado_cms_frontend/README.md), sección `Guía completa: tenant nuevo`.
