

-- 4) Vista de activos
CREATE OR REPLACE VIEW public.v_work_order_assignees_current AS
SELECT *
FROM public.work_order_assignees
WHERE is_active = true;

-- 5) Vista agregada por OT (PRIMARY + array de SECONDARY)
CREATE OR REPLACE VIEW public.v_work_order_assignees_agg AS
SELECT
  t.id AS work_order_id,
  (
    SELECT wa.assignee_id
    FROM public.work_order_assignees wa
    WHERE wa.work_order_id = t.id AND wa.is_active AND wa.role = 'PRIMARY'
    LIMIT 1
  ) AS primary_assignee_id,
  (
    SELECT array_agg(wa.assignee_id ORDER BY wa.assignee_id)
    FROM public.work_order_assignees wa
    WHERE wa.work_order_id = t.id AND wa.is_active AND wa.role = 'SECONDARY'
  ) AS secondary_assignee_ids
FROM public.tickets t;


-- 18) Re-crear vistas (por si algo cambió)
CREATE OR REPLACE VIEW public.v_work_order_assignees_agg AS
SELECT
  t.id AS work_order_id,
  (
    SELECT wa.assignee_id
    FROM public.work_order_assignees wa
    WHERE wa.work_order_id = t.id AND wa.is_active AND wa.role = 'PRIMARY'
    LIMIT 1
  ) AS primary_assignee_id,
  (
    SELECT array_agg(wa.assignee_id ORDER BY wa.assignee_id)
    FROM public.work_order_assignees wa
    WHERE wa.work_order_id = t.id AND wa.is_active AND wa.role = 'SECONDARY'
  ) AS secondary_assignee_ids
FROM public.tickets t;

CREATE OR REPLACE VIEW public.v_tickets_compat (
  id,
  title,
  description,
  is_urgent,
  priority,
  requester,
  location_id,
  assignee,
  incident_date,
  deadline_date,
  image,
  email,
  phone,
  comments,
  created_at,
  status,
  is_accepted,
  created_by,
  assignee_id,
  updated_at,
  is_archived,
  finalized_at,
  primary_assignee_id,
  secondary_assignee_ids,
  effective_assignee_id,
  updated_by,
  created_by_name,
  updated_by_name,
  primary_assignee_name,
  secondary_assignees_names,
  special_incident_id,
  special_incident_name,
  special_incident_code,
  location_name
) AS
SELECT
  t.id,
  t.title,
  t.description,
  t.is_urgent,
  t.priority,
  t.requester,
  t.location_id,
  t.assignee,
  t.incident_date,
  t.deadline_date,
  t.image,
  t.email,
  t.phone,
  t.comments,
  t.created_at,
  t.status,
  t.is_accepted,
  t.created_by,
  t.assignee_id,
  t.updated_at,
  t.is_archived,
  t.finalized_at,
  a.primary_assignee_id,
  COALESCE(a.secondary_assignee_ids, ARRAY[]::bigint[]) AS secondary_assignee_ids,
  COALESCE(a.primary_assignee_id, t.assignee_id) AS effective_assignee_id,

  t.updated_by,
  concat_ws(' ', u_created.name, u_created.last_name) AS created_by_name,
  concat_ws(' ', u_updated.name, u_updated.last_name) AS updated_by_name,
  concat_ws(' ', ap.name, ap.last_name)               AS primary_assignee_name,

  (
    SELECT STRING_AGG(concat_ws(' ', asg.name, asg.last_name), ', ')
    FROM public.work_order_assignees wa
    JOIN public.assignees asg ON asg.id = wa.assignee_id
    WHERE wa.work_order_id = t.id
      AND wa.is_active = TRUE
      AND wa.role = 'SECONDARY'::assignee_role_enum
  ) AS secondary_assignees_names,

  t.special_incident_id,
  si.name AS special_incident_name,
  si.code AS special_incident_code,
  l.name AS location_name
FROM public.tickets t
LEFT JOIN public.v_work_order_assignees_agg a
  ON a.work_order_id = t.id
LEFT JOIN public.locations l
  ON l.id = t.location_id
LEFT JOIN public.users u_created
  ON u_created.id = t.created_by
LEFT JOIN public.users u_updated
  ON u_updated.id = t.updated_by
LEFT JOIN public.assignees ap
  ON ap.id = a.primary_assignee_id
LEFT JOIN public.special_incidents si
  ON si.id = t.special_incident_id;


-- view public
create or replace view public.societies_public as
select
  id,
  name,
  logo_url,
  login_img_url,
  updated_at
from public.societies
where is_active = true
order by updated_at desc
limit 1;
