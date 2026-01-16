import type { JSX } from 'react';
import { Navigate } from 'react-router-dom';
import CreateTicketPage from '../../pages/CreateTicketPage';
import LoginPage from '../../pages/LoginPage';
import WorkOrdersPage from '../../pages/WorkOrdersPage';
import WorkRequestsPage from '../../pages/WorkRequestsPage';
import UserManagementPage from '../../pages/UserManagementPage';
import MyTicketsPage from '../../pages/MyTicketsPage';
import ForbiddenPage from '../../pages/ForbiddenPage';
import ReportsPage from '../../pages/ReportsPage';
import AssigneeManagementPage from '../../pages/admin/AssigneePage';
import RoleManagementPage from '../../pages/admin/RoleManagementPage';
import RoleEditPage from '../../pages/admin/RoleEditPage';
import DashboardPage from '../../pages/DashboardPage';
import AdminSettingsPage from '../../pages/admin/AdminSettingsPage';
import AdminSettingsHubPage from '../../pages/admin/AdminSettingsHubPage';
import SpecialIncidentsManagementPage from '../../pages/admin/SpecialIncidentsPage';
import AnnouncementsManagmentPage from '../../pages/admin/AnnouncementsManagementPage';
import InventoryHomePage from '../../pages/osalm/inventory/home/InventoryHomePage';
import InventoryWarehousePage from '../../pages/osalm/inventory/warehouses/InventoryWarehousePage';
import InventoryAuditWarehousePage from '../../pages/osalm/inventory/admin/InventoryAuditWarehousePage';
import InventoryAuditWarehouseReviewPage from '../../pages/osalm/inventory/admin/InventoryAuditWarehouseReviewPage';
import WarehouseItemCountPage from '../../pages/osalm/inventory/audits/WarehouseItemCountPage';
import InventoryMasterItemsPage from '../../pages/osalm/inventory/warehouses/InventoryMasterItemsPage';
import InventoryMasterItemCountSelectWarehousePage from '../../pages/osalm/inventory/warehouses/InventoryMasterItemCountSelectWarehousePage';

// Tipado de la ruta
export type AppRoute = {
  path: string;
  element: JSX.Element;
  allowPerms: string[];
  name?: string;
  icon?: JSX.Element;
  showInSidebar?: boolean;
};

const IconHome = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5 mr-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
    />
  </svg>
);

const IconWorkOrders = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5 mr-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
    />
  </svg>
);

const IconWorkRequests = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5 mr-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
    />
  </svg>
);

const IconUsers = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5 mr-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
    />
  </svg>
);

const IconProfile = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5 mr-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
    />
  </svg>
);

const IconCreate = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5 mr-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </svg>
);

const IconReports = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5 mr-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
    />
  </svg>
);

const IconAssignee = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5 mr-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
    />
  </svg>
);

const IconPermissions = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5 mr-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
  </svg>
);

const IconInventory = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth="1.5"
    stroke="currentColor"
    className="w-5 h-5 mr-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"
    />
  </svg>
);

// Rutas protegidas y de menú
export const APP_ROUTES: AppRoute[] = [
  {
    path: '/inicio',
    element: <DashboardPage />,
    allowPerms: ['home:read'],
    name: 'Inicio',
    icon: IconHome,
    showInSidebar: true,
  },
  {
    path: '/ordenes_trabajo',
    element: <WorkOrdersPage />,
    allowPerms: [
      'work_orders:read',
      'work_orders:full_access',
      'work_orders:cancel',
      'work_orders:delete',
    ],
    name: 'Órdenes de Trabajo',
    icon: IconWorkOrders,
    showInSidebar: true,
  },
  {
    path: '/solicitudes',
    element: <WorkRequestsPage />,
    allowPerms: [
      'work_requests:read',
      'work_requests:full_access',
      'work_requests:cancel',
      'work_requests:delete',
    ],
    name: 'Solicitudes',
    icon: IconWorkRequests,
    showInSidebar: true,
  },
  {
    path: '/admin_usuarios',
    element: <UserManagementPage />,
    allowPerms: [
      'users:read',
      'users:full_access',
      'users:cancel',
      'users:delete',
    ],
    name: 'Usuarios',
    icon: IconUsers,
    showInSidebar: true,
  },
  {
    path: '/mi-perfil',
    element: <MyTicketsPage />,
    allowPerms: ['work_orders:read_own', 'work_orders:read'],
    name: 'Mi Perfil',
    icon: IconProfile,
    showInSidebar: true,
  },
  {
    path: '/admin/tecnicos',
    element: <AssigneeManagementPage />,
    allowPerms: [
      'assignees:read',
      'assignees:full_access',
      'assignees:cancel',
      'assignees:delete',
    ],
    name: 'Técnicos',
    icon: IconAssignee,
    showInSidebar: true,
  },
  {
    path: '/crear-ticket',
    element: <CreateTicketPage />,
    allowPerms: ['work_orders:create'],
    name: 'Crear Ticket',
    icon: IconCreate,
    showInSidebar: true,
  },
  {
    path: '/informes',
    element: <ReportsPage />,
    allowPerms: ['reports:read'],
    name: 'Informes',
    icon: IconReports,
    showInSidebar: true,
  },
  {
    path: '/admin/incidencias',
    element: <SpecialIncidentsManagementPage />,
    allowPerms: [
      'special_incidents:read',
      'special_incidents:full_access',
      'special_incidents:disable',
      'special_incidents:delete',
    ],
    name: 'Incidencias',
    showInSidebar: false,
  },
  {
    path: '/admin/anuncios',
    element: <AnnouncementsManagmentPage />,
    allowPerms: [
      'announcements:read',
      'announcements:create',
      'announcements:full_access',
      'announcements:disable',
      'announcements:delete',
    ],
    name: 'Incidencias',
    showInSidebar: false,
  },

  // Administración de permisos y roles
  {
    path: '/admin/settings',
    element: <AdminSettingsHubPage />,
    allowPerms: ['rbac:manage_roles', 'rbac:manage_permissions'],
    name: 'Configuración',
    icon: IconPermissions,
    showInSidebar: true,
  },
  {
    path: '/admin/permisos',
    element: <RoleManagementPage />,
    allowPerms: ['rbac:manage_roles', 'rbac:manage_permissions'],
    name: 'Permisos y Roles',
    icon: IconPermissions,
    showInSidebar: false,
  },
  {
    path: '/admin/roles/:id',
    element: <RoleEditPage />,
    allowPerms: ['rbac:manage_roles', 'rbac:manage_permissions'],
    showInSidebar: false,
  },
  {
    path: '/admin/settings-old',
    element: <AdminSettingsPage />, // redirige a /admin/settings
    allowPerms: ['rbac:manage_roles', 'rbac:manage_permissions'],
    showInSidebar: false,
  },

  // Inventario - Conteos de inventario HOME
  {
    path: '/osalm/conteos_inventario',
    element: <InventoryHomePage />,
    allowPerms: [
      'inventory_counts:read',
      'inventory_counts:create',
      'inventory_counts:update',
      'inventory_counts:cancel',
      'inventory_counts:delete',
      'inventory_counts:full_access',
    ],
    name: 'OSALM',
    icon: IconInventory,
    showInSidebar: true,
  },

  // Almacenes
  {
    path: '/osalm/conteos_inventario/almacen/:warehouseId',
    element: <InventoryWarehousePage />,
    allowPerms: [
      'inventory_warehouses:read',
      'inventory_warehouses:create',
      'inventory_warehouses:update',
      'inventory_warehouses:cancel',
      'inventory_warehouses:delete',
      'inventory_warehouses:full_access',
    ],
    name: 'Almacenes',
    showInSidebar: false,
  },

  {
    path: '/osalm/conteos_inventario/maestra',
    element: <InventoryMasterItemsPage />,
    allowPerms: [
      'inventory_adjustments:read',
      'inventory_adjustments:create',
      'inventory_adjustments:export',
      'inventory_adjustments:approve',
      'inventory_adjustments:full_access',
    ],
    name: 'Data Maestra',
    showInSidebar: false,
  },

  {
    path: '/osalm/conteos_inventario/maestra/articulos/:itemId/conteo',
    element: <InventoryMasterItemCountSelectWarehousePage />,
    allowPerms: [
      'inventory_adjustments:read',
      'inventory_adjustments:create',
      'inventory_adjustments:export',
      'inventory_adjustments:approve',
      'inventory_adjustments:full_access',
    ],
    name: 'Data Maestra',
    showInSidebar: false,
  },

  // Conteo de artículo en almacén
  {
    path: '/osalm/conteos_inventario/almacen/:warehouseId/articulo/:warehouseItemId/:areaId?',
    element: <WarehouseItemCountPage />,
    allowPerms: [
      'inventory_counts:read',
      'inventory_counts:create',
      'inventory_counts:delete',
      'inventory_counts:update',
      'inventory_counts:cancel',
      'inventory_counts:full_access',
    ],
    name: 'Ajustes de Inventario',
    showInSidebar: false,
  },

  // Historial de auditorías por almacén
  {
    path: '/osalm/conteos_inventario/auditoria/almacenes',
    element: <InventoryAuditWarehousePage />,
    allowPerms: [
      'inventory_adjustments:read',
      'inventory_adjustments:create',
      'inventory_adjustments:export',
      'inventory_adjustments:approve',
      'inventory_adjustments:full_access',
    ],
    name: 'Historial de Auditorías por Almacén',
    showInSidebar: false,
  },

  // Ajustes de inventario por almacén
  {
    path: '/osalm/conteos_inventario/auditoria/almacenes/:inventoryCountId',
    element: <InventoryAuditWarehouseReviewPage />,
    allowPerms: [
      'inventory_adjustments:read',
      'inventory_adjustments:create',
      'inventory_adjustments:export',
      'inventory_adjustments:approve',
      'inventory_adjustments:full_access',
    ],
    name: 'Ajustes de Inventario',
    showInSidebar: false,
  },
];

// Rutas públicas / especiales que no usan RequireRole
export const PUBLIC_ROUTES = [
  { path: '/login', element: <LoginPage /> },
  { path: '/403', element: <ForbiddenPage /> },
  { path: '/', element: <Navigate to="/inicio" replace /> },
];
