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
    badges: ['13 módulos'],
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
      'Reserva, entrega, devolución y liberación de repuestos por orden de trabajo.',
    breadcrumbs: [
      { label: 'Inventario', to: '/inventario' },
      { label: 'Reservas por OT' },
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

  return {
    sectionLabel: 'Navegación',
    title: fallbackTitle,
  };
}

