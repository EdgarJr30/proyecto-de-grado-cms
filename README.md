# MLM (Manteniendo la Misión)

Un sistema moderno de gestión de tickets de mantenimiento, desarrollado con React y TypeScript, que incluye una interfaz de tablero Kanban para una gestión eficiente del flujo de trabajo.

## 🚀 Resumen

MLM es una aplicación web diseñada para optimizar la gestión de solicitudes de mantenimiento en múltiples ubicaciones. El sistema ofrece una interfaz Kanban intuitiva para el seguimiento de tickets desde su creación hasta su cierre.

## ✨ Funcionalidades

- **Tablero Kanban**: Gestión visual del flujo de trabajo.
- **Creación de Tickets**: Formulario completo para registrar solicitudes de mantenimiento.
- **Autenticación de Usuarios**: Inicio de sesión seguro y rutas protegidas.
- **Gestión de Prioridad**: Sistema de marcado de tickets urgentes.
- **Adjuntos de Fotos**: Permite adjuntar imágenes a las solicitudes.
- **Ubicaciones**: Selección mediante lista desplegable de las diferentes ubicaciones.
- **Fecha del Incidente**: Registro de la fecha de ocurrencia del problema.
- **Gestión de Estados**: Flujo de tres etapas (Pendiente, En Ejecución, Finalizadas).
- **Indicadores Visuales**: Etiquetas e íconos con código de colores para identificar el estado rápidamente.
- **Numeración Secuencial**: Asignación automática de número de ticket para seguimiento interno.

## ✨ Nuevas Funcionalidades

- **Búsqueda Global 🔎**: Busca tickets por título y solicitante directamente en la base de datos desde el Kanban.
- **Notificaciones con Badge ❶**: Muestra el número de nuevos tickets en la campana de notificaciones.
- **Módulo Bandeja de Entrada (WorkRequests)**:  
  - Permite aceptar tickets uno a uno o por lotes de 10.
  - Integra búsqueda global y filtrado específico por ubicación.
  - Los tickets aceptados pasan automáticamente al tablero Kanban.
  - (Funcionalidad de rechazo de tickets pendiente de implementación)
- **Tablero Kanban Mejorado**:  
  - Filtrado específico por ubicación.
  - Solo muestra tickets previamente aceptados.

## 🏢 Ubicaciones Soportadas

- Operadora de Servicios Alimenticios
- Adrian Tropical 27
- Adrian Tropical Malecón
- Adrian Tropical Lincoln
- Adrian Tropical San Vicente
- Atracciones el Lago
- M7
- E. Arturo Trading
- Edificio Comunitario

## 🛠️ Tecnologías

- **Frontend**: React 19.1.0 + TypeScript
- **Build Tool**: Vite 6.3.5
- **Estilos**: TailwindCSS 4.1.8
- **Base de Datos**: Supabase
- **Ruteo**: React Router DOM 7.6.1
- **Componentes UI**: Radix UI, Heroicons, Lucide React
- **Notificaciones**: React Toastify, SweetAlert2

## 📦 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/EdgarJr30/cilm_easy_mant.git
   cd cilm_easy_mant
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   Crea un archivo `.env` en la raíz con tus credenciales de Supabase:
   ```env
   VITE_SUPABASE_URL=tu_supabase_url
   VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
   ```

4. **Configurar la base de datos**
   Ejecuta el script SQL para crear las tablas necesarias:
   ```bash
   # Ejecuta el archivo create_database.sql desde el panel de Supabase
   ```

## 🚦 Uso

### Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:puerto

### Construir para Producción

```bash
npm run build
```

### Previsualizar Build de Producción

```bash
npm run preview
```

### Linter

```bash
npm run lint
```

## 📱 Estructura de la Aplicación

- `/login` - Autenticación de usuarios
- `/crear-ticket` - Formulario para nuevas solicitudes de mantenimiento
- `/kanban` - Tablero principal con gestión de tickets (ruta protegida)
-  `/WorkRequests` - 
- `/` - Redirecciona al tablero Kanban

## 🔐 Autenticación

La aplicación utiliza rutas protegidas para garantizar que solo los usuarios autenticados accedan al tablero principal. La creación de tickets está disponible para todos los usuarios, facilitando la solicitud de servicios.

## 🎨 Experiencia de Usuario (UI/UX)

- Diseño responsive para escritorio y móvil
- Notificaciones tipo Toast para retroalimentación al usuario
- Indicadores visuales con código de colores
- Diseño moderno y limpio usando TailwindCSS

## 📊 Base de Datos

La aplicación incluye una estructura de base de datos preconfigurada. Puedes importar el archivo `MLM.csv` para poblar datos iniciales si lo necesitas.

## 🔔 Guía completa: tenant nuevo (Notificaciones + Comentarios + Push PWA)

### 0) Pre-requisitos

- Proyecto Supabase nuevo creado (`project-ref`).
- URL y keys disponibles:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Dominio HTTPS para frontend publicado (obligatorio para Web Push real).
- Node/npm instalados.

### 1) SQL base del proyecto (tenant desde cero)

Ejecuta los módulos CMMS en orden:

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

`16_notifications.sql` ya está consolidado con:

- módulo de notificaciones completo
- comentarios normalizados (`ticket_comments`)
- outbox + dedupe + retries
- admin test tools
- unread toggle
- RPC de comentarios
- fail-safe en trigger de comentarios
- hardening de seguridad (bloqueo de `create_notification_event` directo a clientes)

### 2) Realtime / WebSockets

Confirma en Supabase que estas tablas estén en `supabase_realtime`:

- `public.notification_deliveries`
- `public.ticket_comments`

Y con `REPLICA IDENTITY FULL`:

- `public.notification_deliveries`
- `public.ticket_comments`

El SQL de notificaciones ya intenta configurarlo automáticamente.

### 3) Edge Function push worker

Función:

- `supabase/functions/send-push-from-outbox`

Generar VAPID:

```bash
npx web-push generate-vapid-keys --json
```

Secrets requeridos en Supabase Functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

Opcionales:

- `VAPID_SUBJECT` (ej: `mailto:tu-correo@dominio.com`)
- `PUSH_OUTBOX_CRON_SECRET`
- `PUSH_OUTBOX_MAX_ATTEMPTS`
- `PUSH_OUTBOX_BACKOFF_BASE_SECONDS`
- `PUSH_OUTBOX_BACKOFF_MAX_SECONDS`
- `PUSH_OUTBOX_PROCESSING_LEASE_SECONDS`
- `PUSH_OUTBOX_MAX_PARALLEL_SENDS`

Deploy:

```bash
npx supabase@latest functions deploy send-push-from-outbox --project-ref <project-ref>
```

### 4) Worker inmediato + cron de respaldo

Recomendado: **ambos**.

#### Opción A (preferida): trigger DB inmediato por `pg_net`

Configurar settings DB:

```sql
ALTER DATABASE postgres
SET app.settings.push_outbox_worker_url = 'https://<project-ref>.functions.supabase.co/send-push-from-outbox';

ALTER DATABASE postgres
SET app.settings.push_outbox_service_jwt = '<SUPABASE_SERVICE_ROLE_KEY>';

ALTER DATABASE postgres
SET app.settings.push_outbox_cron_secret = '<PUSH_OUTBOX_CRON_SECRET>';
```

Si tu rol no permite `ALTER DATABASE` (`permission denied to set parameter`), usa webhook manual.

#### Opción B: Database Webhook inmediato (fallback)

Crear webhook:

- Tabla: `public.notification_outbox`
- Evento: `INSERT`
- Método: `POST`
- URL: `https://<project-ref>.functions.supabase.co/send-push-from-outbox?limit=1`
- Headers:
  - `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
  - `apikey: <SUPABASE_SERVICE_ROLE_KEY>`
  - `x-cron-secret: <PUSH_OUTBOX_CRON_SECRET>`
  - `Content-Type: application/json`

#### Cron de respaldo (siempre recomendado)

Cada 1 minuto:

- Endpoint: `POST /send-push-from-outbox?limit=100`
- Headers:
  - `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
  - `apikey: <SUPABASE_SERVICE_ROLE_KEY>`
  - `x-cron-secret: <PUSH_OUTBOX_CRON_SECRET>`

Ejemplo cron externo:

```cron
* * * * * curl -sS -X POST "https://<project-ref>.functions.supabase.co/send-push-from-outbox?limit=100" -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" -H "apikey: <SUPABASE_SERVICE_ROLE_KEY>" -H "x-cron-secret: <PUSH_OUTBOX_CRON_SECRET>" -H "Content-Type: application/json" -d '{}' >> /tmp/send-push-from-outbox.log 2>&1
```

### 5) Frontend (env + build)

Configura `.env`:

```env
VITE_SUPABASE_URL=<supabase-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
VITE_WEB_PUSH_PUBLIC_KEY=<vapid-public-key>
```

Build/deploy:

```bash
npm install
npm run build
```

### 6) Pruebas E2E obligatorias

Script de humo:

```bash
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
TEST_RECIPIENT_USER_ID=<uuid> \
TEST_ACTOR_USER_ID=<uuid-opcional> \
node scripts/notifications-smoke.mjs
```

Prueba UI:

1. Ir a `/notificaciones`.
2. Validar campana (conteo, listado, marcar leída/no leída por click y swipe).
3. Validar “Prueba Admin” (solo permisos `users:full_access` o `rbac:manage_permissions`).
4. Click en notificación de ticket debe navegar a `/tickets/:ticketId`.
5. Agregar comentario en:
   - modal de Solicitudes
   - detalle `/tickets/:ticketId`
   y validar que persiste y dispara `ticket.comment_added`.

Prueba push:

1. Activar “Push en este dispositivo”.
2. Enviar prueba a sí mismo.
3. Verificar outbox:
   - pasa de `pending/processing` a `sent` en segundos.

### 7) iOS / Android / Desktop

- Android: Chrome + permiso concedido.
- iOS: Safari + app instalada en pantalla de inicio (PWA) + permiso concedido.
- macOS/Windows: permiso del navegador/sistema operativo habilitado.

### 8) Consultas rápidas de verificación (post-deploy)

```sql
-- privilegios críticos
select
  has_function_privilege('authenticated','public.create_notification_event(text,uuid,text,text,jsonb,uuid[],integer)','EXECUTE') as auth_can_create_event,
  has_function_privilege('service_role','public.create_notification_event(text,uuid,text,text,jsonb,uuid[],integer)','EXECUTE') as service_can_create_event,
  has_function_privilege('authenticated','public.send_self_test_notification(text,text,boolean)','EXECUTE') as auth_can_self_test;
```

```sql
-- estado outbox
select status, count(*) from public.notification_outbox group by status order by status;
```

```sql
-- últimas entregas push
select id, status, attempts, last_error, created_at, next_attempt_at, sent_at
from public.notification_outbox
order by created_at desc
limit 20;
```

## 📄 Licencia

Este proyecto es privado y propietario.

---

Desarrollado con ❤️ para una gestión de mantenimiento eficiente
