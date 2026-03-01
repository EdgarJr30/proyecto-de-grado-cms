import { Link } from 'react-router-dom';
import { usePermissions } from '../../rbac/PermissionsContext';
import {
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
  DollarSign,
  Wrench,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

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
      border: 'border-amber-200/90 dark:border-amber-500/40',
      surface:
        'bg-gradient-to-br from-amber-50/75 via-white to-white dark:from-amber-500/15 dark:via-slate-900 dark:to-slate-900',
      iconWrap: 'bg-amber-100/80 dark:bg-amber-500/20',
      icon: 'text-amber-700 dark:text-amber-300',
      chip: 'bg-amber-100/70 text-amber-800 border-amber-300/70 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/50',
      accent: 'from-amber-400 via-amber-500 to-orange-500',
      focusRing: 'focus:ring-amber-500/30',
      arrow:
        'bg-amber-100/80 text-amber-700 border-amber-300/70 hover:bg-amber-200/80 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/50 dark:hover:bg-amber-500/30',
      footer: 'border-amber-200/80 text-amber-700 dark:border-amber-500/40 dark:text-amber-300',
    };
  }
  return {
    border: 'border-slate-200/90 dark:border-slate-700',
    surface:
      'bg-gradient-to-br from-slate-50/80 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-800',
    iconWrap: 'bg-blue-50 dark:bg-blue-500/15',
    icon: 'text-blue-700 dark:text-blue-300',
    chip: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600',
    accent: 'from-blue-500 via-indigo-500 to-sky-500',
    focusRing: 'focus:ring-blue-500/30',
    arrow:
      'bg-slate-100 text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-blue-500/20 dark:hover:text-blue-200 dark:hover:border-blue-400/40',
    footer: 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
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
        'group relative block overflow-hidden rounded-2xl border shadow-sm transition-all duration-200',
        s.surface,
        s.border,
        'hover:-translate-y-0.5 hover:shadow-lg',
        'focus:outline-none focus:ring-2',
        s.focusRing
      )}
    >
      <div
        className={cx(
          'pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r',
          s.accent
        )}
      />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cx(
                'shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center shadow-sm',
                s.border,
                s.iconWrap
              )}
            >
              <Icon className={cx('h-5 w-5', s.icon)} />
            </div>

            <div className="min-w-0">
              <h3 className="text-sm md:text-base font-semibold text-slate-900 group-hover:text-slate-950 dark:text-slate-100 dark:group-hover:text-white truncate">
                {title}
              </h3>
              <p className="mt-1 text-xs md:text-sm text-slate-500 dark:text-slate-300 line-clamp-2">
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
                Módulo
              </span>
            )}

            <span
              className={cx(
                'inline-flex items-center justify-center h-8 w-8 rounded-lg border transition-colors',
                s.border,
                s.arrow
              )}
              aria-hidden="true"
            >
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>

        <div
          className={cx(
            'mt-4 border-t pt-3 flex items-center justify-between',
            s.footer
          )}
        >
          <span className="text-[11px] font-semibold tracking-wide uppercase">
            Acceso directo
          </span>
          <span className="text-xs font-medium group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
            Abrir sección
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function InventoryHomePage() {
  const { has } = usePermissions();
  const canRead = has('inventory:read');
  const prefersReducedMotion = useReducedMotion();

  const cards: InventoryNavCard[] = [
    {
      title: 'Repuestos',
      description:
        'Catálogo de repuestos, UdM, criticidad, estado y categorías.',
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
      title: 'Unidades de medida (UdM)',
      description:
        'Mantén las unidades (código/nombre) para consumo e inventario.',
      to: '/inventory/uoms',
      perm: 'inventory:read',
      icon: Ruler,
    },
    {
      title: 'Proveedores',
      description:
        'Proveedores y relación repuesto-proveedor (tiempo de entrega, cantidad mínima, precio).',
      to: '/inventory/vendors',
      perm: 'inventory:read',
      icon: Truck,
    },
    {
      title: 'Almacenes y ubicaciones',
      description:
        'Configura almacenes y ubicaciones (pasillos/estantes) para inventario.',
      to: '/inventory/warehouses',
      perm: 'inventory:read',
      icon: Warehouse,
    },
    {
      title: 'Activos',
      description: 'Inventario de activos físicos y su estado operativo.',
      to: '/inventory/assets',
      perm: ['assets:read', 'assets:full_access'],
      icon: Wrench,
    },
    {
      title: 'Disponibilidad',
      description:
        'En existencia vs reservado (vista v_available_stock) para consumo real.',
      to: '/inventory/availability',
      perm: 'inventory:read',
      icon: Layers,
    },
    {
      title: 'Stock por ubicación',
      description: 'Detalle por almacén/ubicación (vista v_stock_by_location).',
      to: '/inventory/stock-by-location',
      perm: 'inventory:read',
      icon: MapPinned,
    },
    {
      title: 'Documentos de inventario',
      description:
        'Crear y gestionar entradas/salidas/transferencias/ajustes/devoluciones (borrador/publicado).',
      to: '/inventory/docs',
      perm: 'inventory:read',
      icon: FileText,
    },
    {
      title: 'Movimientos de inventario',
      description:
        'Historial de movimientos por fecha y documento (entradas/salidas/ajustes).',
      to: '/inventory/kardex',
      perm: 'inventory:read',
      icon: ListOrdered,
    },
    {
      title: 'Políticas de reposición',
      description:
        'Políticas de reposición + sugerencias automáticas (vista v_reorder_suggestions).',
      to: '/inventory/reorder',
      perm: 'inventory:read',
      icon: Repeat,
    },
    {
      title: 'Costo',
      description: 'Control costo de consumo y reposición.',
      to: '/inventory/costos',
      perm: 'inventory:read',
      icon: DollarSign,
    },
    {
      title: 'Reservas por OT (tickets)',
      description:
        'Reservar repuestos para tickets aceptados (reserve_ticket_part).',
      to: '/inventory/reservations',
      perm: 'inventory:read',
      tone: 'warning',
      icon: ClipboardCheck,
    },
  ];

  const visibleCards = cards.filter((card) => (card.perm ? has(card.perm) : true));

  const revealProps = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 14, scale: 0.996 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: {
            duration: 0.46,
            delay,
            ease: [0.22, 1, 0.36, 1] as const,
          },
        };

  if (!canRead) {
    return (
      <div className="h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
          <div className="p-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              No tienes permisos para acceder al módulo de inventario.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        {/* Body */}
        <motion.section
          className="flex-1 min-h-0 overflow-auto bg-slate-100/60 dark:bg-slate-950 pt-6"
          {...revealProps(0.04)}
        >
          <div className="px-4 md:px-6 lg:px-8 py-6">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-4 md:p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleCards.map((card, index) => (
                  <motion.div key={card.to} {...revealProps(0.14 + index * 0.05)}>
                    <Card
                      title={card.title}
                      description={card.description}
                      to={card.to}
                      tone={card.tone}
                      Icon={card.icon ?? Boxes}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
