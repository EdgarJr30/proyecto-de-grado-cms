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

  // === Inventario ===
  inventory_items: 'inventory_items',
  inventory_warehouses: 'inventory_warehouses',
  inventory_uoms: 'inventory_uoms',
  inventory_baskets: 'inventory_baskets',
  inventory_counts: 'inventory_counts',
  inventory_operations: 'inventory_operations',
  inventory_adjustments: 'inventory_adjustments',
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

  // === Inventario: Catálogo de artículos ===
  p(RESOURCES.inventory_items, 'read', 'Ver catálogo de artículos'),
  p(RESOURCES.inventory_items, 'create', 'Crear artículos'),
  p(RESOURCES.inventory_items, 'update', 'Editar artículos'),
  p(RESOURCES.inventory_items, 'delete', 'Eliminar artículos'),
  p(
    RESOURCES.inventory_items,
    'full_access',
    'Acceso total catálogo de artículos (crear/modificar/eliminar)'
  ),

  // === Inventario: Almacenes ===
  p(RESOURCES.inventory_warehouses, 'read', 'Ver almacenes'),
  p(RESOURCES.inventory_warehouses, 'create', 'Crear almacenes'),
  p(RESOURCES.inventory_warehouses, 'update', 'Editar almacenes'),
  p(RESOURCES.inventory_warehouses, 'delete', 'Eliminar almacenes'),
  p(
    RESOURCES.inventory_warehouses,
    'full_access',
    'Acceso total almacenes (crear/modificar/eliminar)'
  ),

  // === Inventario: UoMs ===
  p(RESOURCES.inventory_uoms, 'read', 'Ver unidades de medida'),
  p(RESOURCES.inventory_uoms, 'create', 'Crear unidades de medida'),
  p(RESOURCES.inventory_uoms, 'update', 'Editar unidades de medida'),
  p(RESOURCES.inventory_uoms, 'delete', 'Eliminar unidades de medida'),
  p(
    RESOURCES.inventory_uoms,
    'full_access',
    'Acceso total unidades de medida (crear/modificar/eliminar)'
  ),

  // === Inventario: Baskets (canastos) ===
  p(RESOURCES.inventory_baskets, 'read', 'Ver canastos de pesaje'),
  p(RESOURCES.inventory_baskets, 'create', 'Crear canastos de pesaje'),
  p(RESOURCES.inventory_baskets, 'update', 'Editar canastos de pesaje'),
  p(RESOURCES.inventory_baskets, 'delete', 'Eliminar canastos de pesaje'),
  p(
    RESOURCES.inventory_baskets,
    'full_access',
    'Acceso total canastos de pesaje (crear/modificar/eliminar)'
  ),

  // === Inventario: Conteos físicos (cabecera) ===
  p(RESOURCES.inventory_counts, 'read', 'Ver jornadas de conteo'),
  p(RESOURCES.inventory_counts, 'create', 'Crear jornadas de conteo'),
  p(RESOURCES.inventory_counts, 'update', 'Editar jornadas de conteo'),
  p(RESOURCES.inventory_counts, 'cancel', 'Cancelar/cerrar jornadas de conteo'),
  p(RESOURCES.inventory_counts, 'delete', 'Eliminar jornadas de conteo'),
  p(
    RESOURCES.inventory_counts,
    'full_access',
    'Acceso total jornadas de conteo (crear/modificar/cerrar/eliminar)'
  ),

  // === Inventario: Operaciones de conteo (disparos desde dispositivos) ===
  p(RESOURCES.inventory_operations, 'read', 'Ver operaciones crudas de conteo'),
  p(RESOURCES.inventory_operations, 'work', 'Registrar conteos (operaciones)'),
  p(RESOURCES.inventory_operations, 'delete', 'Eliminar operaciones de conteo'),
  p(
    RESOURCES.inventory_operations,
    'full_access',
    'Acceso total operaciones de conteo (leer/registrar/eliminar)'
  ),

  // === Inventario: Ajustes calculados ===
  p(RESOURCES.inventory_adjustments, 'read', 'Ver ajustes de inventario'),
  p(RESOURCES.inventory_adjustments, 'create', 'Crear ajustes de inventario'),
  p(
    RESOURCES.inventory_adjustments,
    'export',
    'Exportar ajustes de inventario'
  ),
  p(
    RESOURCES.inventory_adjustments,
    'approve',
    'Aprobar ajustes de inventario'
  ),
  p(
    RESOURCES.inventory_adjustments,
    'full_access',
    'Acceso total ajustes de inventario (crear/aprobar/eliminar)'
  ),
];
