-- Permite crear/editar/eliminar roles a usuarios con permiso rbac:manage_roles.
-- Sin esta policy, INSERT/UPDATE/DELETE sobre public.roles falla por RLS.

DROP POLICY IF EXISTS "rbac roles rw" ON public.roles;

CREATE POLICY "rbac roles rw"
ON public.roles
FOR ALL
USING (public.me_has_permission('rbac:manage_roles'))
WITH CHECK (public.me_has_permission('rbac:manage_roles'));
