# Crear primer usuario admin

Este script crea o actualiza un usuario admin en:

- `auth.users` (Supabase Auth)
- `public.users`
- `public.user_roles` (rol `Administrator` por defecto)

## Requisitos

Define estas variables en el entorno:

- `SUPABASE_SERVICE_ROLE_KEY` (requerida)
- `SUPABASE_URL` (o `VITE_SUPABASE_URL`)

Puedes guardarlas en `.env.admin.local` (archivo ignorado por git).

## Uso

```bash
npm run admin:create-first -- \
  --email admin@tu-dominio.com \
  --password "TuPassword123" \
  --name "Admin" \
  --last-name "Principal"
```

Opcionales:

- `--location-id 1`
- `--role-name Administrator`
- `--no-email-confirm`

## Nota técnica

Existe la función SQL `public.create_user_in_public(...)`, pero para bootstrap del primer admin no es suficiente por sí sola porque exige permisos RBAC (`users:create` / `rbac:manage_roles`) basados en `auth.uid()`.
Este script usa `service_role` para inicializar el primer administrador sin depender de un usuario previo.
