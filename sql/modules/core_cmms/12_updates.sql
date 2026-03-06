
update public.tickets t
set assignee_id = a.id
from public.assignees a
where t.assignee_id is null
  and nullif(trim(t.assignee),'') is not null
  and upper(trim(t.assignee)) = upper(trim(a.name||' '||a.last_name));

  -- 15) Desactivar duplicados de secundarios dejando el más antiguo activo
UPDATE public.work_order_assignees w
   SET is_active     = false,
       unassigned_at = now(),
       updated_at    = now(),
       updated_by    = auth.uid()
 WHERE w.role = 'SECONDARY'
   AND w.is_active = true
   AND EXISTS (
     SELECT 1
     FROM public.work_order_assignees w2
     WHERE w2.work_order_id = w.work_order_id
       AND w2.assignee_id   = w.assignee_id
       AND w2.role          = w.role
       AND w2.is_active     = true
       AND (
            w2.assigned_at < w.assigned_at
         OR (w2.assigned_at = w.assigned_at AND w2.created_at < w.created_at)
       )
   );

   ALTER TABLE public.users
  ALTER COLUMN created_at
  SET DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo');

  SELECT
  id,
  created_at AS old_created_at,
  (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo' AS fixed_created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 50;

UPDATE public.users
SET created_at = (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo';
