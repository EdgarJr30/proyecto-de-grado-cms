import { Link } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { usePermissions } from '../../rbac/PermissionsContext';

type InventoryNavCard = {
  title: string;
  description: string;
  to: string;
  perm?: string | string[];
  tone?: 'default' | 'warning';
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function Card({
  title,
  description,
  to,
  tone = 'default',
}: {
  title: string;
  description: string;
  to: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <Link
      to={to}
      className={cx(
        'group block rounded-2xl border bg-white p-5 shadow-sm transition',
        'hover:shadow-md hover:-translate-y-[1px]',
        tone === 'warning' && 'border-amber-200 bg-amber-50/30'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-gray-950">
            {title}
          </h3>
          <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
        <span className="shrink-0 rounded-full border px-3 py-1 text-xs text-gray-600 bg-gray-50">
          Abrir
        </span>
      </div>
    </Link>
  );
}

export default function InventoryHomePage() {
  const { has } = usePermissions();

  const cards: InventoryNavCard[] = [
    {
      title: 'Repuestos (Parts)',
      description:
        'Catálogo de repuestos, UoM, criticidad, estado y categorías.',
      to: '/inventory/parts',
      perm: 'inventory:read',
    },
    {
      title: 'Categorías de repuestos',
      description:
        'Árbol de categorías (padre/hijo) para clasificar repuestos.',
      to: '/inventory/part-categories',
      perm: 'inventory:read',
    },
    {
      title: 'Unidades de medida (UoM)',
      description: 'Mantén las unidades (code/name) para consumo e inventario.',
      to: '/inventory/uoms',
      perm: 'inventory:read',
    },
    {
      title: 'Proveedores',
      description:
        'Proveedores y relación repuesto–proveedor (lead time, moq, precio).',
      to: '/inventory/vendors',
      perm: 'inventory:read',
    },
    {
      title: 'Almacenes y ubicaciones (Bins)',
      description:
        'Configura warehouses y bins (pasillos/estantes) para stock.',
      to: '/inventory/warehouses',
      perm: 'inventory:read',
    },
    {
      title: 'Disponibilidad',
      description:
        'On hand vs reservado (vista v_available_stock) para consumo real.',
      to: '/inventory/availability',
      perm: 'inventory:read',
    },
    {
      title: 'Stock por ubicación',
      description: 'Detalle por warehouse/bin (vista v_stock_by_location).',
      to: '/inventory/stock-by-location',
      perm: 'inventory:read',
    },
    {
      title: 'Documentos de inventario',
      description:
        'Crear y gestionar RECEIPT/ISSUE/TRANSFER/ADJUSTMENT/RETURN (DRAFT/POSTED).',
      to: '/inventory/docs',
      perm: 'inventory:read',
    },
    {
      title: 'Kárdex',
      description:
        'Movimientos por fecha y documento (vista v_inventory_kardex).',
      to: '/inventory/kardex',
      perm: 'inventory:read',
    },
    {
      title: 'Sugerencias de reorden',
      description:
        'Reorder policies + sugerencias automáticas (vista v_reorder_suggestions).',
      to: '/inventory/reorder',
      perm: 'inventory:read',
    },
    {
      title: 'Reservas por WO (tickets)',
      description:
        'Reservar repuestos para tickets aceptados (reserve_ticket_part).',
      to: '/inventory/reservations',
      perm: 'inventory:read',
      tone: 'warning',
    },
  ];

  const canRead = has('inventory:read');

  if (!canRead) {
    return (
      <div className="h-screen flex bg-gray-100">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-700">
              No tienes permisos para acceder al módulo de inventario.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />

      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <header className="px-4 md:px-6 lg:px-8 pb-0 pt-4 md:pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-bold">Inventario</h2>
            <p className="text-sm text-gray-600">
              Acceso rápido a maestros, stock, documentos, kárdex y reorden.
            </p>
          </div>
        </header>

        <section className="px-4 md:px-6 lg:px-8 py-6 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cards
              .filter((c) => (c.perm ? has(c.perm) : true))
              .map((c) => (
                <Card
                  key={c.to}
                  title={c.title}
                  description={c.description}
                  to={c.to}
                  tone={c.tone}
                />
              ))}
          </div>
        </section>
      </main>
    </div>
  );
}
