import { Link } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { usePermissions } from '../../rbac/PermissionsContext';
import {
  ChevronRight,
  Boxes,
  PackageSearch,
  Tags,
  Ruler,
  Truck,
  Warehouse,
  Layers,
  MapPinned,
  FileText,
  ListOrdered,
  Repeat,
  ClipboardCheck,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

type InventoryNavCard = {
  title: string;
  description: string;
  to: string;
  perm?: string | string[];
  tone?: 'default' | 'warning';
  icon?: React.ComponentType<{ className?: string }>;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function toneStyles(tone: 'default' | 'warning') {
  if (tone === 'warning') {
    return {
      border: 'border-amber-200',
      bg: 'bg-amber-50/40',
      iconWrap: 'bg-amber-100/60',
      icon: 'text-amber-700',
      chip: 'bg-amber-50 text-amber-700 border-amber-200',
      hover: 'hover:bg-amber-50/70',
    };
  }
  return {
    border: 'border-slate-200',
    bg: 'bg-white',
    iconWrap: 'bg-blue-50',
    icon: 'text-blue-700',
    chip: 'bg-slate-50 text-slate-600 border-slate-200',
    hover: 'hover:bg-slate-50/60',
  };
}

function Card({
  title,
  description,
  to,
  tone = 'default',
  Icon = Boxes,
}: {
  title: string;
  description: string;
  to: string;
  tone?: 'default' | 'warning';
  Icon?: React.ComponentType<{ className?: string }>;
}) {
  const s = toneStyles(tone);

  return (
    <Link
      to={to}
      className={cx(
        'group relative block rounded-xl border shadow-sm transition',
        'bg-white',
        s.border,
        'hover:shadow-md hover:-translate-y-[1px]',
        'focus:outline-none focus:ring-2 focus:ring-blue-500/30'
      )}
    >
      {/* subtle pastel header band */}
      <div
        className={cx(
          'h-10 rounded-t-xl border-b',
          s.border,
          s.bg,
          'transition-colors'
        )}
      />

      <div className="p-5 -mt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cx(
                'shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center',
                s.border,
                s.iconWrap
              )}
            >
              <Icon className={cx('h-5 w-5', s.icon)} />
            </div>

            <div className="min-w-0">
              <h3 className="text-sm md:text-base font-semibold text-slate-900 group-hover:text-slate-950 truncate">
                {title}
              </h3>
              <p className="mt-1 text-xs md:text-sm text-slate-500 line-clamp-2">
                {description}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {tone === 'warning' ? (
              <span
                className={cx(
                  'hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                  s.chip
                )}
                title="Requiere atención por su impacto operativo"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Operativo
              </span>
            ) : (
              <span
                className={cx(
                  'hidden sm:inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                  s.chip
                )}
              >
                Abrir
              </span>
            )}

            <span
              className={cx(
                'inline-flex items-center justify-center h-8 w-8 rounded-lg border transition',
                s.border,
                s.bg,
                s.hover
              )}
              aria-hidden="true"
            >
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-slate-700" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function InventoryHomePage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');

  const cards: InventoryNavCard[] = [
    {
      title: 'Repuestos (Parts)',
      description:
        'Catálogo de repuestos, UoM, criticidad, estado y categorías.',
      to: '/inventory/parts',
      perm: 'inventory:read',
      icon: PackageSearch,
    },
    {
      title: 'Categorías de repuestos',
      description:
        'Árbol de categorías (padre/hijo) para clasificar repuestos.',
      to: '/inventory/part-categories',
      perm: 'inventory:read',
      icon: Tags,
    },
    {
      title: 'Unidades de medida (UoM)',
      description: 'Mantén las unidades (code/name) para consumo e inventario.',
      to: '/inventory/uoms',
      perm: 'inventory:read',
      icon: Ruler,
    },
    {
      title: 'Proveedores',
      description:
        'Proveedores y relación repuesto–proveedor (lead time, moq, precio).',
      to: '/inventory/vendors',
      perm: 'inventory:read',
      icon: Truck,
    },
    {
      title: 'Almacenes y ubicaciones (Bins)',
      description:
        'Configura warehouses y bins (pasillos/estantes) para stock.',
      to: '/inventory/warehouses',
      perm: 'inventory:read',
      icon: Warehouse,
    },
    {
      title: 'Disponibilidad',
      description:
        'On hand vs reservado (vista v_available_stock) para consumo real.',
      to: '/inventory/availability',
      perm: 'inventory:read',
      icon: Layers,
    },
    {
      title: 'Stock por ubicación',
      description: 'Detalle por warehouse/bin (vista v_stock_by_location).',
      to: '/inventory/stock-by-location',
      perm: 'inventory:read',
      icon: MapPinned,
    },
    {
      title: 'Documentos de inventario',
      description:
        'Crear y gestionar RECEIPT/ISSUE/TRANSFER/ADJUSTMENT/RETURN (DRAFT/POSTED).',
      to: '/inventory/docs',
      perm: 'inventory:read',
      icon: FileText,
    },
    {
      title: 'Kárdex',
      description:
        'Movimientos por fecha y documento (vista v_inventory_kardex).',
      to: '/inventory/kardex',
      perm: 'inventory:read',
      icon: ListOrdered,
    },
    {
      title: 'Políticas de reorden',
      description:
        'Reorder policies + sugerencias automáticas (vista v_reorder_suggestions).',
      to: '/inventory/reorder',
      perm: 'inventory:read',
      icon: Repeat,
    },
    {
      title: 'Reservas por WO (tickets)',
      description:
        'Reservar repuestos para tickets aceptados (reserve_ticket_part).',
      to: '/inventory/reservations',
      perm: 'inventory:read',
      tone: 'warning',
      icon: ClipboardCheck,
    },
  ];

  if (!canRead) {
    return (
      <div className="h-screen flex bg-slate-50 text-slate-900">
        <Sidebar />
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No tienes permisos para acceder al módulo de inventario.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900">
      <Sidebar />

      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="px-4 md:px-6 lg:px-8 py-4">
            <div className="flex flex-col gap-3">
              <nav className="flex items-center gap-1.5 text-xs text-slate-500">
                <Link to="/" className="hover:text-slate-900">
                  Inicio
                </Link>
                <ChevronRight className="h-3 w-3" />
                <span className="text-slate-900 font-medium">Inventario</span>
              </nav>

              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <h1 className="text-lg md:text-xl font-bold tracking-tight">
                    Inventario
                  </h1>
                  <p className="mt-1 text-xs md:text-sm text-slate-500">
                    Acceso rápido a maestros, stock, documentos, kárdex y
                    reorden.
                  </p>
                </div>

                <span className="inline-flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 self-start">
                  <Boxes className="h-3.5 w-3.5 text-blue-700" />
                  {
                    cards.filter((c) => (c.perm ? has(c.perm) : true)).length
                  }{' '}
                  módulos
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <section className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 md:px-6 lg:px-8 py-6">
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
                    Icon={c.icon ?? Boxes}
                  />
                ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
