-- =========[ PERMISOS SEED / ROL ADMIN ]=========
DO $$
DECLARE
  v_admin_role_id int;
BEGIN
  INSERT INTO public.roles(name, description, is_system)
  SELECT 'Administrator','Acceso total', true
  WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE name='Administrator');

  SELECT id INTO v_admin_role_id FROM public.roles WHERE name='Administrator' LIMIT 1;

  WITH perms_src(resource, action, code, label, description) AS (
    VALUES
      ('rbac','manage_permissions','rbac:manage_permissions','Sincronizar permisos','Puede sincronizar y administrar permisos'),
      ('rbac','manage_roles','rbac:manage_roles','Gestionar roles','Puede crear/editar roles y asignar permisos'),
      ('work_orders','read','work_orders:read','Ver OT',NULL),
      ('work_orders','read_own','work_orders:read_own','Ver mis OT',NULL),
      ('work_orders','create','work_orders:create','Crear OT',NULL),
      ('work_orders','update','work_orders:update','Editar OT',NULL),
      ('work_orders','delete','work_orders:delete','Eliminar OT',NULL),
      ('work_orders','work','work_orders:work','Trabajar OT',NULL),
      ('work_orders','approve','work_orders:approve','Aprobar/Rechazar OT',NULL),
      ('work_orders','full_access','work_orders:full_access','Acceso total OT',NULL),
      ('work_orders','cancel','work_orders:cancel','Cancelar OT',NULL),
      ('work_requests','read','work_requests:read','Ver solicitudes',NULL),
      ('work_requests','create','work_requests:create','Crear solicitudes',NULL),
      ('work_requests','update','work_requests:update','Editar solicitudes',NULL),
      ('work_requests','delete','work_requests:delete','Eliminar solicitudes',NULL),
      ('work_requests','work','work_requests:work','Trabajar solicitudes',NULL),
      ('work_requests','approve','work_requests:approve','Aprobar/Rechazar solicitudes',NULL),
      ('work_requests','full_access','work_requests:full_access','Acceso total solicitudes',NULL),
      ('work_requests','cancel','work_requests:cancel','Cancelar solicitudes',NULL),
      ('reports','read','reports:read','Ver reportes',NULL),
      ('users','read','users:read','Ver usuarios',NULL),
      ('users','create','users:create','Crear usuarios',NULL),
      ('users','update','users:update','Editar usuarios',NULL),
      ('users','delete','users:delete','Eliminar usuarios',NULL),
      ('users','full_access','users:full_access','Acceso total usuarios',NULL),
      ('users','cancel','users:cancel','Activar/Desactivar usuarios',NULL),
      ('assignees','read','assignees:read','Ver técnicos',NULL),
      ('assignees','create','assignees:create','Crear técnicos',NULL),
      ('assignees','update','assignees:update','Editar técnicos',NULL),
      ('assignees','delete','assignees:delete','Eliminar técnicos',NULL),
      ('assignees','full_access','assignees:full_access','Acceso total técnicos',NULL),
      ('assignees','cancel','assignees:cancel','Activar/Desactivar técnicos',NULL),
      ('home','read','home:read','Dashboard/Home',NULL),
      ('locations','read','locations:read','Ver ubicaciones',NULL),
      ('locations','create','locations:create','Crear ubicaciones',NULL),
      ('locations','update','locations:update','Editar ubicaciones',NULL),
      ('locations','delete','locations:delete','Eliminar ubicaciones',NULL),
      ('locations','disable','locations:disable','Activar/Desactivar ubicaciones',NULL),
      ('locations','full_access','locations:full_access','Acceso total ubicaciones',NULL),
      ('special_incidents','read','special_incidents:read','Ver incidencias especiales',NULL),
      ('special_incidents','full_access','special_incidents:full_access','Acceso total incidencias especiales',NULL),
      ('special_incidents','disable','special_incidents:disable','Activar/Desactivar incidencias especiales',NULL),
      ('special_incidents','delete','special_incidents:delete','Eliminar incidencias especiales',NULL),
      ('announcements','read','announcements:read','Ver anuncios (panel de gestión)',NULL),
      ('announcements','create','announcements:create','Crear anuncios',NULL),
      ('announcements','full_access','announcements:full_access','Acceso total anuncios',NULL),
      ('announcements','disable','announcements:disable','Activar/Desactivar anuncios',NULL),
      ('announcements','delete','announcements:delete','Eliminar anuncios',NULL),
      ('society','read','society:read','Ver sociedades (panel de gestión)',NULL),
      ('society','create','society:create','Crear sociedades',NULL),
      ('society','full_access','society:full_access','Acceso total sociedades',NULL),
      ('society','disable','society:disable','Activar/Desactivar sociedades',NULL),
      ('society','delete','society:delete','Eliminar sociedades',NULL),
      ('assets','read','assets:read','Ver activos',NULL),
      ('assets','create','assets:create','Crear activos',NULL),
      ('assets','update','assets:update','Editar activos',NULL),
      ('assets','delete','assets:delete','Eliminar activos',NULL),
      ('assets','disable','assets:disable','Activar/Desactivar activos',NULL),
      ('assets','full_access','assets:full_access','Acceso total activos',NULL),
      ('inventory','read','inventory:read','Ver inventario',NULL),
      ('inventory','create','inventory:create','Crear documentos de inventario',NULL),
      ('inventory','update','inventory:update','Editar documentos de inventario',NULL),
      ('inventory','delete','inventory:delete','Eliminar documentos/líneas de inventario',NULL),
      ('inventory','approve','inventory:approve','Publicar documentos de inventario',NULL),
      ('inventory','cancel','inventory:cancel','Cancelar documentos de inventario',NULL),
      ('inventory','work','inventory:work','Reservar repuestos para OT',NULL),
      ('inventory','full_access','inventory:full_access','Acceso total inventario',NULL),
      ('logs','read','logs:read','Ver bitácora de actividad','Acceso de solo lectura a la bitácora de auditoría'),
      ('logs','export','logs:export','Exportar bitácora de actividad','Permite exportar la bitácora de auditoría'),
      ('approvals','read','approvals:read','Ver procesos de aprobación','Acceso de lectura al módulo de aprobaciones'),
      ('approvals','create','approvals:create','Crear procesos de aprobación',NULL),
      ('approvals','full_access','approvals:full_access','Acceso total a procesos de aprobación','Crear/editar procesos y administrar aprobadores y solicitantes')
  )
  INSERT INTO public.permissions(id, resource, action, code, label, description, is_active, created_at)
  SELECT gen_random_uuid(), s.resource, s.action::permission_action, s.code, s.label, s.description, TRUE, NOW()
  FROM perms_src s
  ON CONFLICT (code) DO UPDATE SET
    resource=EXCLUDED.resource, action=EXCLUDED.action, label=EXCLUDED.label,
    description=EXCLUDED.description, is_active=TRUE;

  INSERT INTO public.role_permissions(role_id, permission_id)
  SELECT v_admin_role_id, p.id FROM public.permissions p
  ON CONFLICT DO NOTHING;
END$$;
