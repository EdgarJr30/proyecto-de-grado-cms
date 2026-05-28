-- Allow every authenticated user to read their own profile row.
-- This keeps self-service profile updates from failing when the user does not
-- have administrative users:read permissions.

DROP POLICY IF EXISTS users_select_self_profile ON public.users;

CREATE POLICY users_select_self_profile
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());
