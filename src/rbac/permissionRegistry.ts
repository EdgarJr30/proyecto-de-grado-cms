export type PermissionAction =
  | 'create'
  | 'read'
  | 'read_own'
  | 'update'
  | 'delete'
  | 'work'
  | 'import'
  | 'export'
  | 'approve'
  | 'assign'
  | 'disable'
  | 'full_access'
  | 'cancel'
  | 'manage_roles'
  | 'manage_permissions';

export type PermissionDef = {
  resource: string; // p.ej. 'tickets', 'WorkRequests', 'reports', 'users', 'assignees', 'rbac'
  action: PermissionAction;
  label: string;
  description?: string;
  is_active?: boolean;
};

const p = (
  resource: string,
  action: PermissionAction,
  label: string,
  description?: string
): PermissionDef => ({
  resource: resource.toLowerCase(),
  action,
  label,
  description,
});

//Helpers tipados para recursos y códigos de permiso
export const RESOURCES = {
  home: 'home',
  work_orders: 'work_orders',
  work_requests: 'work_requests',
  reports: 'reports',
  users: 'users',
  assignees: 'assignees',
  rbac: 'rbac',
  special_incidents: 'special_incidents',
  announcements: 'announcements',
  society: 'society',
  locations: 'locations',
  assets: 'assets',
} as const;

type Resource = (typeof RESOURCES)[keyof typeof RESOURCES];
export type PermCode = `${Resource}:${PermissionAction}`;
export const code = (resource: Resource, action: PermissionAction) =>
  `${resource}:${action}` as PermCode;

export const PERMISSIONS: PermissionDef[] = [
  // RBAC / Admin
  p(RESOURCES.rbac, 'manage_permissions', 'Sincronizar permisos'),
  p(RESOURCES.rbac, 'manage_roles', 'Gestionar roles'),

  // Home / Inicio
  p(RESOURCES.home, 'read', 'Ver inicio'),

  // Tickets / WorkOrders
  p(RESOURCES.work_orders, 'read', 'Ver OT'),
  p(RESOURCES.work_orders, 'read_own', 'Ver mis OT'),
  p(RESOURCES.work_orders, 'create', 'Crear OT'),
  p(RESOURCES.work_orders, 'full_access', 'Acceso total OT (crear/modificar)'),
  p(RESOURCES.work_orders, 'cancel', 'Cancelar OT'),
  p(RESOURCES.work_orders, 'delete', 'Eliminar OT'),

  // WorkRequests (Solicitudes)
  p(RESOURCES.work_requests, 'read', 'Ver solicitudes'),
  p(
    RESOURCES.work_requests,
    'full_access',
    'Acceso total solicitudes (aprobar/editar)'
  ),
  p(RESOURCES.work_requests, 'cancel', 'Cancelar solicitudes'),
  p(RESOURCES.work_requests, 'delete', 'Eliminar solicitudes'),

  // Reportes
  p(RESOURCES.reports, 'read', 'Ver reportes'),

  // Usuarios
  p(RESOURCES.users, 'read', 'Ver usuarios'),
  p(RESOURCES.users, 'create', 'Crear usuarios'),
  p(RESOURCES.users, 'update', 'Editar usuarios'),
  p(RESOURCES.users, 'full_access', 'Acceso total usuarios (crear/modificar)'),
  p(RESOURCES.users, 'cancel', 'Activar/Desactivar usuarios'),
  p(RESOURCES.users, 'delete', 'Eliminar usuarios'),

  // Técnicos (ASSIGNEES)
  p(RESOURCES.assignees, 'read', 'Ver técnicos'),
  p(
    RESOURCES.assignees,
    'full_access',
    'Acceso total técnicos (crear/modificar)'
  ),
  p(RESOURCES.assignees, 'cancel', 'Activar/Desactivar técnicos'),
  p(RESOURCES.assignees, 'delete', 'Eliminar técnicos'),

  // Special Incidents
  p(RESOURCES.special_incidents, 'read', 'Ver incidencias especiales'),
  p(
    RESOURCES.special_incidents,
    'full_access',
    'Acceso total incidencias especiales (crear/modificar)'
  ),
  p(
    RESOURCES.special_incidents,
    'disable',
    'Activar/Desactivar incidencias especiales'
  ),
  p(RESOURCES.special_incidents, 'delete', 'Eliminar incidencias especiales'),

  // Anuncios Globales
  p(RESOURCES.announcements, 'read', 'Ver anuncios (panel de gestión)'),
  p(RESOURCES.announcements, 'create', 'Crear anuncios'),
  p(
    RESOURCES.announcements,
    'full_access',
    'Acceso total anuncios (crear/editar/eliminar)'
  ),
  p(RESOURCES.announcements, 'disable', 'Activar/Desactivar anuncios'),
  p(RESOURCES.announcements, 'delete', 'Eliminar anuncios'),

  // Sociedad (Parametrización de empresa / branding)
  p(RESOURCES.society, 'read', 'Ver sociedades (panel de gestión)'),
  p(RESOURCES.society, 'create', 'Crear sociedades'),
  p(
    RESOURCES.society,
    'full_access',
    'Acceso total sociedades (crear/editar/eliminar)'
  ),
  p(RESOURCES.society, 'disable', 'Activar/Desactivar sociedades'),
  p(RESOURCES.society, 'delete', 'Eliminar sociedades'),

  // Locations
  p(RESOURCES.locations, 'read', 'Ver ubicaciones'),
  p(RESOURCES.locations, 'create', 'Crear ubicaciones'),
  p(RESOURCES.locations, 'update', 'Editar ubicaciones'),
  p(RESOURCES.locations, 'delete', 'Eliminar ubicaciones'),
  p(RESOURCES.locations, 'disable', 'Activar/Desactivar ubicaciones'),
  p(
    RESOURCES.locations,
    'full_access',
    'Acceso total ubicaciones (crear/modificar/eliminar)'
  ),

  // Assets (Activos)
  p(RESOURCES.assets, 'read', 'Ver activos'),
  p(RESOURCES.assets, 'create', 'Crear activos'),
  p(RESOURCES.assets, 'update', 'Editar activos'),
  p(RESOURCES.assets, 'delete', 'Eliminar activos'),
  p(RESOURCES.assets, 'disable', 'Activar/Desactivar activos'),
  p(
    RESOURCES.assets,
    'full_access',
    'Acceso total activos (crear/modificar/eliminar/asignar a tickets)'
  ),
];
