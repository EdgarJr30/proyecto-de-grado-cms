type TopBarBreadcrumb = {
  label: string;
  to?: string;
};

export type TopBarMeta = {
  sectionLabel: string;
  title: string;
  description?: string;
  breadcrumbs?: TopBarBreadcrumb[];
  badges?: string[];
};

type TopBarMetaRoute = Omit<TopBarMeta, 'sectionLabel'> & {
  path: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesRoute(pathPattern: string, currentPath: string) {
  if (!pathPattern.includes(':')) return pathPattern === currentPath;

  const regexSource = pathPattern
    .split('/')
    .map((chunk) => (chunk.startsWith(':') ? '[^/]+' : escapeRegExp(chunk)))
    .join('/');

  return new RegExp(`^${regexSource}$`).test(currentPath);
}

const INVENTORY_TOP_BAR_ROUTES: TopBarMetaRoute[] = [
  {
    path: '/inventario',
    title: 'Inventario',
    description:
      'Acceso rápido a maestros, stock, documentos, movimientos y reorden.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Inventario' },
    ],
    badges: ['14 módulos'],
  },
  {
    path: '/inventory/parts',
    title: 'Repuestos',
    description:
      'Catálogo de repuestos con UdM, categoría, criticidad y banderas operativas.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Repuestos' },
    ],
  },
  {
    path: '/inventory/tools',
    title: 'Herramientas',
    description:
      'Catálogo de herramientas con ubicación, estado, calibración y disponibilidad.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Herramientas' },
    ],
  },
  {
    path: '/inventory/part-categories',
    title: 'Categorías de repuestos',
    description: 'Árbol de categorías (padre/hijo) para clasificar repuestos.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Categorías de repuestos' },
    ],
  },
  {
    path: '/inventory/uoms',
    title: 'Unidades de medida',
    description: 'Catálogo base para consumo, compras e inventario.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Unidades de medida' },
    ],
  },
  {
    path: '/inventory/vendors',
    title: 'Proveedores',
    description: 'Administra proveedores y su relación con repuestos.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Proveedores' },
    ],
  },
  {
    path: '/inventory/part_vendors',
    title: 'Repuesto-Proveedor',
    description: 'Lead time, MOQ, precio, moneda y proveedor preferido.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Repuesto-Proveedor' },
    ],
  },
  {
    path: '/inventory/warehouses',
    title: 'Almacenes y ubicaciones',
    description: 'Configura almacenes base para manejar inventario y ubicaciones.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Almacenes y ubicaciones' },
    ],
  },
  {
    path: '/inventory/warehouses/:warehouseId/bins',
    title: 'Ubicaciones por almacén',
    description: 'Gestión de ubicaciones internas por almacén.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Almacenes y ubicaciones', to: '/inventory/warehouses' },
      { label: 'Ubicaciones' },
    ],
  },
  {
    path: '/inventory/availability',
    title: 'Disponibilidad',
    description: 'Vista v_available_stock (existencia, reservado y disponible).',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Disponibilidad' },
    ],
  },
  {
    path: '/inventory/assets',
    title: 'Activos',
    description: 'Inventario de activos físicos y su estado operativo.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Activos' },
    ],
  },
  {
    path: '/inventory/stock-by-location',
    title: 'Stock por ubicación',
    description: 'Vista detallada por repuesto, almacén y ubicación.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Stock por ubicación' },
    ],
  },
  {
    path: '/inventory/docs',
    title: 'Documentos de inventario',
    description:
      'Entradas, salidas, transferencias, ajustes y devoluciones con trazabilidad.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Documentos de inventario' },
    ],
  },
  {
    path: '/inventory/docs/crear',
    title: 'Crear documento de inventario',
    description: 'Selecciona el tipo de movimiento para crear un borrador.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Documentos de inventario', to: '/inventory/docs' },
      { label: 'Crear' },
    ],
  },
  {
    path: '/inventory/docs/:docId',
    title: 'Editor de documento',
    description: 'Edición, posteo y cancelación de documentos de inventario.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Documentos de inventario', to: '/inventory/docs' },
      { label: 'Editor' },
    ],
  },
  {
    path: '/inventory/reorder',
    title: 'Políticas de reposición',
    description:
      'Define mínimos/máximos y gatillos de reposición por repuesto y almacén.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Políticas de reposición' },
    ],
  },
  {
    path: '/inventory/reorder_suggestions',
    title: 'Sugerencias de reposición',
    description:
      'Vista de sugerencias calculadas según stock actual y políticas vigentes.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Sugerencias de reposición' },
    ],
  },
  {
    path: '/inventory/kardex',
    title: 'Movimientos de inventario',
    description:
      'Trazabilidad por repuesto, almacén, documento y ticket (kardex).',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Movimientos de inventario' },
    ],
  },
  {
    path: '/inventory/costos',
    title: 'Costeo promedio',
    description:
      'Costo promedio ponderado por repuesto y almacén (part_costs).',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Costeo promedio' },
    ],
  },
  {
    path: '/inventory/reservations',
    title: 'Reservas por OT',
    description:
      'Reserva, entrega, devolución y liberación de repuestos y herramientas por orden de trabajo.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Reservas por OT' },
    ],
  },
];

const GENERAL_TOP_BAR_ROUTES: TopBarMetaRoute[] = [
  {
    path: '/inicio',
    title: 'Inicio',
    description:
      'Resumen operativo con indicadores clave, actividad reciente y accesos rápidos.',
    breadcrumbs: [{ label: 'Inicio' }],
  },
  {
    path: '/ordenes_trabajo',
    title: 'Órdenes de Trabajo',
    description:
      'Gestiona órdenes de trabajo: creación, asignación, seguimiento y cierre.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Órdenes de Trabajo' },
    ],
  },
  {
    path: '/solicitudes',
    title: 'Solicitudes',
    description:
      'Administra solicitudes de servicio desde su registro hasta su atención.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Solicitudes' },
    ],
  },
  {
    path: '/admin_usuarios',
    title: 'Usuarios',
    description:
      'Gestión de usuarios, estados y niveles de acceso dentro de la plataforma.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Usuarios' },
    ],
  },
  {
    path: '/mi-perfil',
    title: 'Mi Perfil',
    description:
      'Consulta y actualiza tu información personal y tu actividad en la aplicación.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Mi Perfil' },
    ],
  },
  {
    path: '/admin/tecnicos',
    title: 'Técnicos',
    description:
      'Administra técnicos y su información para facilitar asignaciones operativas.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Técnicos' },
    ],
  },
  {
    path: '/crear-ticket',
    title: 'Crear Ticket',
    description:
      'Registra nuevos tickets con prioridad, contexto y datos necesarios para su atención.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Crear Ticket' },
    ],
  },
  {
    path: '/informes',
    title: 'Informes',
    description:
      'Explora reportes y métricas para análisis operativo, cumplimiento y seguimiento.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Informes' },
    ],
  },
  {
    path: '/notificaciones',
    title: 'Centro de notificaciones',
    description:
      'Revisa alertas recientes, administra estados de lectura y configura tus preferencias.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Notificaciones' },
    ],
  },
  {
    path: '/tickets/:ticketId',
    title: 'Detalle de ticket',
    description: 'Consulta el historial del ticket y registra comentarios.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Notificaciones', to: '/notificaciones' },
      { label: 'Detalle de ticket' },
    ],
  },
  {
    path: '/admin/incidencias',
    title: 'Incidencias',
    description:
      'Configura incidencias especiales para clasificar y gestionar eventos críticos.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Configuración', to: '/admin/settings' },
      { label: 'Incidencias' },
    ],
  },
  {
    path: '/admin/anuncios',
    title: 'Anuncios',
    description:
      'Publica y administra anuncios internos visibles para los usuarios del sistema.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Configuración', to: '/admin/settings' },
      { label: 'Anuncios' },
    ],
  },
  {
    path: '/admin/sociedades',
    title: 'Sociedades',
    description:
      'Gestiona sociedades y la información corporativa utilizada en la plataforma.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Configuración', to: '/admin/settings' },
      { label: 'Sociedades' },
    ],
  },
  {
    path: '/admin/settings',
    title: 'Configuración',
    description:
      'Centro de configuración general para catálogos, parámetros y opciones administrativas.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Configuración' },
    ],
  },
  {
    path: '/admin/permisos',
    title: 'Permisos y Roles',
    description:
      'Define roles y permisos para controlar accesos y acciones por tipo de usuario.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Configuración', to: '/admin/settings' },
      { label: 'Permisos y Roles' },
    ],
  },
  {
    path: '/admin/roles/:id',
    title: 'Editar rol',
    description:
      'Ajusta permisos y alcance del rol seleccionado con control detallado de accesos.',
    breadcrumbs: [
      { label: 'Inicio', to: '/inicio' },
      { label: 'Configuración', to: '/admin/settings' },
      { label: 'Permisos y Roles', to: '/admin/permisos' },
      { label: 'Editar rol' },
    ],
  },
];

export function resolveTopBarMeta(pathname: string, fallbackTitle: string): TopBarMeta {
  const inventoryMeta = INVENTORY_TOP_BAR_ROUTES.find((route) =>
    matchesRoute(route.path, pathname)
  );

  if (inventoryMeta) {
    return {
      sectionLabel: 'Inventario',
      title: inventoryMeta.title,
      description: inventoryMeta.description,
      breadcrumbs: inventoryMeta.breadcrumbs,
      badges: inventoryMeta.badges,
    };
  }

  const generalMeta = GENERAL_TOP_BAR_ROUTES.find((route) =>
    matchesRoute(route.path, pathname)
  );

  if (generalMeta) {
    return {
      sectionLabel: 'Navegación',
      title: generalMeta.title,
      description: generalMeta.description,
      breadcrumbs: generalMeta.breadcrumbs,
      badges: generalMeta.badges,
    };
  }

  return {
    sectionLabel: 'Navegación',
    title: fallbackTitle,
  };
}
