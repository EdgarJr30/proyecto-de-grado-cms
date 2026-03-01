export type NotificationFilter = 'pending' | 'read' | 'all';
export type NotificationStatus = 'unread' | 'read';
export type NotificationCategory = 'ticket' | 'sistema' | 'inventario';

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  status: NotificationStatus;
  createdAt: string;
  readAt: string | null;
};

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n-1001',
    title: 'Ticket #845 asignado',
    message: 'Se te asigno un ticket de mantenimiento preventivo en Torre Norte.',
    category: 'ticket',
    status: 'unread',
    createdAt: '2026-03-01T11:38:00.000Z',
    readAt: null,
  },
  {
    id: 'n-1002',
    title: 'Stock bajo en repuestos',
    message: 'El repuesto Filtro HVAC 20x25 tiene inventario critico.',
    category: 'inventario',
    status: 'unread',
    createdAt: '2026-02-28T16:12:00.000Z',
    readAt: null,
  },
  {
    id: 'n-1003',
    title: 'Cambio de politica de cierre',
    message: 'Administracion publico una actualizacion para tickets archivados.',
    category: 'sistema',
    status: 'read',
    createdAt: '2026-02-27T14:05:00.000Z',
    readAt: '2026-02-28T09:10:00.000Z',
  },
  {
    id: 'n-1004',
    title: 'Ticket #839 comentado',
    message: 'El tecnico dejo evidencia y solicito validacion del supervisor.',
    category: 'ticket',
    status: 'read',
    createdAt: '2026-02-25T08:42:00.000Z',
    readAt: '2026-02-25T12:01:00.000Z',
  },
];

export async function listNotificationInbox(): Promise<NotificationItem[]> {
  return MOCK_NOTIFICATIONS.map((item) => ({ ...item }));
}
