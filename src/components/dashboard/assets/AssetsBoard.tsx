import { useMemo, useState } from 'react';

type AssetStatus = 'Operativo' | 'En Mantenimiento' | 'Fuera de Servicio';

type Asset = {
  id: number;
  code: string;
  name: string;
  category: string;
  locationLabel: string;
  status: AssetStatus;
  criticality: 1 | 2 | 3 | 4 | 5;
  nextMaintenance: string;
  costYTD: number;
  responsibleInitials: string;
};

type LocationNode = {
  id: string;
  label: string;
  children?: LocationNode[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function currency(value: number) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value.toLocaleString()}`;
  }
}

function StatusBadge({ value }: { value: AssetStatus }) {
  const map: Record<AssetStatus, string> = {
    Operativo: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'En Mantenimiento': 'bg-amber-100 text-amber-800 border-amber-200',
    'Fuera de Servicio': 'bg-rose-100 text-rose-800 border-rose-200',
  };

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        map[value]
      )}
    >
      {value}
    </span>
  );
}

function CriticalityDots({ value }: { value: number }) {
  const dots = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1">
      {dots.map((d) => (
        <span
          key={d}
          className={cx(
            'h-2.5 w-2.5 rounded-full',
            d <= value ? 'bg-amber-500' : 'bg-gray-200'
          )}
        />
      ))}
    </div>
  );
}

function Icon({
  name,
  className,
}: {
  name:
    | 'plus'
    | 'wrench'
    | 'import'
    | 'export'
    | 'search'
    | 'pin'
    | 'close'
    | 'chev'
    | 'bell'
    | 'upload';
  className?: string;
}) {
  const cls = cx('h-5 w-5', className);
  switch (name) {
    case 'plus':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'wrench':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M21 7.5a5.5 5.5 0 0 1-7.6 5.1L7 19l-2 2-2-2 2-2 6.4-6.4A5.5 5.5 0 0 1 16.5 3l-2.2 2.2 2.3 2.3L21 7.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'import':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3v10m0 0 3-3m-3 3-3-3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 14v5h16v-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'export':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 21V11m0 0 3 3m-3-3-3 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 10V5h16v5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'search':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M16.5 16.5 21 21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'pin':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M12 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
    case 'close':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M6 6l12 12M18 6 6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'chev':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'bell':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M15 17H9m9-2V11a6 6 0 1 0-12 0v4l-2 2h16l-2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10 19a2 2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'upload':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 16V4m0 0 4 4M12 4 8 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M4 20h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'info' | 'danger' | 'warning';
}) {
  const tones: Record<typeof tone, string> = {
    neutral: 'bg-gray-50 border-gray-200',
    success: 'bg-emerald-50 border-emerald-200',
    info: 'bg-sky-50 border-sky-200',
    danger: 'bg-rose-50 border-rose-200',
    warning: 'bg-amber-50 border-amber-200',
  };

  return (
    <div className={cx('rounded-lg border p-4', tones[tone])}>
      <div className="text-xs font-medium text-gray-600">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function LocationTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: LocationNode[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      {nodes.map((n) => (
        <LocationTreeNode
          key={n.id}
          node={n}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function LocationTreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: LocationNode;
  depth: number;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = Boolean(node.children?.length);
  const isSelected = selectedId === node.id;

  return (
    <div>
      <button
        type="button"
        className={cx(
          'w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-800 hover:bg-gray-50',
          isSelected && 'bg-indigo-50 text-indigo-700'
        )}
        style={{ paddingLeft: 10 + depth * 14 }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <span
            className={cx(
              'inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100',
              isSelected && 'text-indigo-700'
            )}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            title={open ? 'Colapsar' : 'Expandir'}
          >
            <span className={cx('transition', open ? 'rotate-90' : '')}>
              <Icon name="chev" className="h-4 w-4" />
            </span>
          </span>
        ) : (
          <span className="inline-flex h-6 w-6" />
        )}

        <span className="truncate">{node.label}</span>
      </button>

      {hasChildren && open ? (
        <div className="mt-1">
          {node.children!.map((c) => (
            <LocationTreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AssetsBoard() {
  const locations: LocationNode[] = useMemo(
    () => [
      {
        id: 'planta',
        label: 'Planta Principal',
        children: [
          {
            id: 'edif-a',
            label: 'Edificio A',
            children: [
              { id: 'piso-1', label: 'Piso 1' },
              { id: 'piso-2', label: 'Piso 2' },
              { id: 'sala-bombas', label: 'Sala de Bombas' },
            ],
          },
          { id: 'edif-b', label: 'Edificio B' },
        ],
      },
      { id: 'almacen', label: 'Almacén Central' },
      { id: 'oficina', label: 'Oficina Corporativa' },
    ],
    []
  );

  const [selectedLocationId, setSelectedLocationId] = useState('planta');
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(1);

  const assets: Asset[] = useMemo(
    () => [
      {
        id: 1,
        code: 'AC-102',
        name: 'Unidad de Aire Acondicionado',
        category: 'HVAC',
        locationLabel: 'Edificio A - Piso 1',
        status: 'Operativo',
        criticality: 3,
        nextMaintenance: '16/05/2024',
        costYTD: 18500,
        responsibleInitials: 'JG',
      },
      {
        id: 2,
        code: 'GEN-01',
        name: 'Generador Diesel',
        category: 'Energía',
        locationLabel: 'Edificio A - Piso 1',
        status: 'En Mantenimiento',
        criticality: 4,
        nextMaintenance: '13/05/2023',
        costYTD: 49300,
        responsibleInitials: 'AP',
      },
      {
        id: 3,
        code: 'BOM-05',
        name: 'Bomba de Agua',
        category: 'Hidráulica',
        locationLabel: 'Piso 1',
        status: 'Operativo',
        criticality: 2,
        nextMaintenance: '12/05/2024',
        costYTD: 27500,
        responsibleInitials: 'MR',
      },
      {
        id: 4,
        code: 'ELEC-07',
        name: 'Tablero Eléctrico',
        category: 'Eléctrico',
        locationLabel: 'Piso 1',
        status: 'En Mantenimiento',
        criticality: 5,
        nextMaintenance: '25/05/2024',
        costYTD: 47000,
        responsibleInitials: 'LC',
      },
      {
        id: 5,
        code: 'CCTV-03',
        name: 'Cámara de Seguridad',
        category: 'Seguridad',
        locationLabel: 'Piso 1',
        status: 'Fuera de Servicio',
        criticality: 3,
        nextMaintenance: '03/11/2024',
        costYTD: 31500,
        responsibleInitials: 'PT',
      },
    ],
    []
  );

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) ?? assets[0],
    [assets, selectedAssetId]
  );

  const leftSummary = useMemo(
    () => [
      { label: 'Operativos', value: 12, tone: 'success' as const },
      { label: 'En Mantenimiento', value: 4, tone: 'warning' as const },
      { label: 'Fuera de Servicio', value: 2, tone: 'danger' as const },
      { label: 'Con Alertas', value: 3, tone: 'info' as const },
    ],
    []
  );

  return (
    <div className="h-full min-h-0">
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Panel izquierdo: Ubicaciones */}
        <aside className="min-h-0 rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Ubicaciones</div>

          <div className="mt-3">
            <LocationTree
              nodes={locations}
              selectedId={selectedLocationId}
              onSelect={(id) => setSelectedLocationId(id)}
            />
          </div>

          <div className="mt-6 space-y-2 border-t pt-4">
            {leftSummary.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between rounded-lg px-2 py-2 text-sm"
              >
                <span className="text-gray-700">{s.label}</span>
                <span className="font-semibold text-gray-900">{s.value}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Panel derecho: KPIs + acciones + tabla + drawer */}
        <section className="min-h-0 overflow-hidden rounded-xl border bg-white shadow-sm">
          {/* Top bar: título + acciones */}
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <div className="text-sm font-semibold text-gray-900">
              Listado de Activos
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                <Icon name="plus" className="h-4 w-4" />
                Nuevo Activo
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600/10 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-600/15"
              >
                <Icon name="wrench" className="h-4 w-4" />
                Registrar Mantenimiento
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Icon name="import" className="h-4 w-4" />
                Importar
              </button>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Icon name="export" className="h-4 w-4" />
                Exportar
              </button>
            </div>
          </div>

          {/* Barra de búsqueda (mock) */}
          <div className="px-4 pt-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Icon name="search" className="h-4 w-4" />
              </span>
              <input
                placeholder="Buscar código, nombre, serie..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>

          {/* KPIs */}
          <div className="px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <KpiCard label="Total Activos" value="34" tone="neutral" />
              <KpiCard label="Operativos" value="22" tone="success" />
              <KpiCard label="En Mantenimiento" value="4" tone="warning" />
              <KpiCard label="Fuera de Servicio" value="5" tone="danger" />
              <KpiCard label="Próximos Vencimientos" value="3" tone="info" />
            </div>
          </div>

          {/* Layout tabla + drawer */}
          <div className="px-4 pb-4 h-[calc(100%-250px)] min-h-0">
            <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
              {/* Tabla */}
              <div className="min-h-0 overflow-hidden rounded-lg border">
                <div className="h-full min-h-0 overflow-auto">
                  <table className="min-w-full table-fixed divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-24">
                          Código
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                          Nombre
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-36">
                          Categoría
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-40">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-28">
                          Criticidad
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-32">
                          Próximo Mantto.
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-28">
                          Costo YTD
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-24">
                          Resp.
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200 bg-white">
                      {assets.map((a) => {
                        const selected = a.id === selectedAssetId;
                        return (
                          <tr
                            key={a.id}
                            className={cx(
                              'hover:bg-gray-50 transition cursor-pointer',
                              selected && 'bg-indigo-50'
                            )}
                            onClick={() => setSelectedAssetId(a.id)}
                          >
                            <td className="px-4 py-4 text-sm font-semibold text-gray-900 whitespace-nowrap">
                              {a.code}
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm font-medium text-indigo-700 hover:text-indigo-600">
                                {a.name}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {a.locationLabel}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                              {a.category}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <StatusBadge value={a.status} />
                            </td>
                            <td className="px-4 py-4">
                              <CriticalityDots value={a.criticality} />
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                              {a.nextMaintenance}
                            </td>
                            <td className="px-4 py-4 text-sm font-semibold text-gray-900 whitespace-nowrap">
                              {currency(a.costYTD)}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-end">
                                <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-700">
                                  {a.responsibleInitials}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación (mock) */}
                <div className="flex items-center justify-end gap-2 border-t bg-white px-4 py-3">
                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-gray-200 text-gray-700 font-medium hover:bg-gray-300"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-500"
                  >
                    Siguiente
                  </button>
                </div>
              </div>

              {/* Drawer lateral (mock siempre visible en xl+) */}
              <aside className="hidden xl:flex min-h-0 flex-col rounded-lg border bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {selectedAsset?.code} {selectedAsset?.name}
                  </div>
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700"
                    title="Cerrar"
                    onClick={() => setSelectedAssetId(null)}
                  >
                    <Icon name="close" className="h-5 w-5" />
                  </button>
                </div>

                {/* Imagen placeholder */}
                <div className="px-4 pt-4">
                  <div className="h-40 w-full rounded-lg bg-gray-100 overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200" />
                  </div>
                </div>

                {/* Estado + ubicación */}
                <div className="px-4 pt-4">
                  <div className="flex items-center gap-2">
                    <StatusBadge value={selectedAsset?.status ?? 'Operativo'} />
                    <span className="ml-auto inline-flex items-center gap-1 text-sm text-gray-600">
                      <Icon name="pin" className="h-4 w-4 text-gray-400" />
                      {selectedAsset?.locationLabel}
                    </span>
                  </div>
                </div>

                {/* Datos técnicos (mock) */}
                <div className="px-4 pt-4">
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="text-xs font-semibold text-gray-700">
                      Datos técnicos
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-gray-700">
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">Modelo</span>
                        <span className="font-medium">LG ZXS-24K</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">No. Serie</span>
                        <span className="font-medium">12345-AC102</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">Próximo Mantto</span>
                        <span className="font-medium">
                          {selectedAsset?.nextMaintenance}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs (mock) */}
                <div className="px-4 pt-4">
                  <div className="flex items-center gap-2">
                    {['Técnico', 'Historial', 'Costos', 'Tickets'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={cx(
                          'rounded-md border px-3 py-1.5 text-sm font-medium',
                          t === 'Técnico'
                            ? 'bg-white text-gray-900'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contenido tab (mock) */}
                <div className="px-4 pt-4 flex-1 min-h-0 overflow-auto">
                  <div className="space-y-3">
                    <div className="h-16 rounded-lg bg-gray-100" />
                    <div className="h-16 rounded-lg bg-gray-100" />
                    <div className="h-16 rounded-lg bg-gray-100" />
                  </div>
                </div>

                {/* CTA */}
                <div className="border-t bg-white p-4">
                  <button
                    type="button"
                    className="w-full rounded-md bg-indigo-600 px-3 py-3 text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm"
                  >
                    Crear Ticket
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
