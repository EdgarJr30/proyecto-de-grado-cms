import { useEffect, useMemo, useState } from 'react';
import type {
  AssetStatus,
  AssetView,
  BigIntLike,
} from '../../../../types/Asset';
import { getAssets } from '../../../../services/assetsService';
import AssetCreateForm from './AssetCreateForm';
import AssetEditForm from './AssetEditForm';

function cx(...classes: Array<string | false | null | undefined | 0>) {
  return classes.filter(Boolean).join(' ');
}

function labelStatus(v: AssetStatus) {
  const map: Record<AssetStatus, string> = {
    OPERATIVO: 'Operativo',
    EN_MANTENIMIENTO: 'En mantenimiento',
    FUERA_DE_SERVICIO: 'Fuera de servicio',
    RETIRADO: 'Retirado',
  };
  return map[v];
}

function StatusBadge({ value }: { value: AssetStatus }) {
  const map: Record<AssetStatus, string> = {
    OPERATIVO: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EN_MANTENIMIENTO: 'bg-amber-100 text-amber-800 border-amber-200',
    FUERA_DE_SERVICIO: 'bg-rose-100 text-rose-800 border-rose-200',
    RETIRADO: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        map[value]
      )}
    >
      {labelStatus(value)}
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
  name: 'plus' | 'search' | 'close' | 'pin' | 'edit';
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
    case 'edit':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none">
          <path
            d="M16.862 4.487 19.5 7.125M7.5 16.5l3.75-.75L19.5 7.5a1.06 1.06 0 0 0 0-1.5l-1.5-1.5a1.06 1.06 0 0 0-1.5 0L8.25 12.75 7.5 16.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

type ViewMode = 'none' | 'create' | 'edit';

export default function AssetsBoard() {
  const [assets, setAssets] = useState<AssetView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [search, setSearch] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<BigIntLike | null>(
    null
  );

  const [modal, setModal] = useState<ViewMode>('none');

  async function reload() {
    setError('');
    setIsLoading(true);
    try {
      const list = await getAssets();
      setAssets(list);
      if (!selectedAssetId && list.length) setSelectedAssetId(list[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;

    return assets.filter((a) => {
      const hay = [
        a.code ?? '',
        a.name ?? '',
        a.serial_number ?? '',
        a.model ?? '',
        a.asset_tag ?? '',
        a.location_name ?? '',
        // ✅ incluye nombre de categoría para buscar
        (a as AssetView & { category_name?: string | null }).category_name ??
          '',
      ]
        .join(' ')
        .toLowerCase();

      return hay.includes(q);
    });
  }, [assets, search]);

  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return null;
    return assets.find((a) => String(a.id) === String(selectedAssetId)) ?? null;
  }, [assets, selectedAssetId]);

  const kpis = useMemo(() => {
    const total = assets.length;
    const oper = assets.filter((a) => a.status === 'OPERATIVO').length;
    const mant = assets.filter((a) => a.status === 'EN_MANTENIMIENTO').length;
    const fuera = assets.filter((a) => a.status === 'FUERA_DE_SERVICIO').length;
    const retir = assets.filter((a) => a.status === 'RETIRADO').length;

    return { total, oper, mant, fuera, retir };
  }, [assets]);

  // ✅ helpers de visualización (evitar — por valores falsy raros)
  const displayText = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s ? s : '—';
  };

  const selectedCategoryName =
    (selectedAsset as AssetView & { category_name?: string | null })
      ?.category_name ?? null;

  return (
    <div className="h-full min-h-0">
      {/* errores */}
      {error ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Panel izquierdo (por ahora placeholder) */}
        <aside className="min-h-0 rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-gray-900">Ubicaciones</div>
          <div className="mt-3 space-y-2">
            <div className="h-9 rounded bg-gray-100" />
            <div className="h-9 rounded bg-gray-100" />
            <div className="h-9 rounded bg-gray-100" />
          </div>

          <div className="mt-6 space-y-2 border-t pt-4">
            <div className="flex items-center justify-between rounded-lg px-2 py-2 text-sm">
              <span className="text-gray-700">Operativos</span>
              <span className="font-semibold text-gray-900">{kpis.oper}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-2 py-2 text-sm">
              <span className="text-gray-700">En Mantenimiento</span>
              <span className="font-semibold text-gray-900">{kpis.mant}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-2 py-2 text-sm">
              <span className="text-gray-700">Fuera de Servicio</span>
              <span className="font-semibold text-gray-900">{kpis.fuera}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-2 py-2 text-sm">
              <span className="text-gray-700">Retirados</span>
              <span className="font-semibold text-gray-900">{kpis.retir}</span>
            </div>
          </div>
        </aside>

        {/* Panel derecho */}
        <section className="min-h-0 overflow-hidden rounded-xl border bg-white shadow-sm">
          {/* Top bar */}
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
            <div className="text-sm font-semibold text-gray-900">
              Listado de Activos
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setModal('create')}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                <Icon name="plus" className="h-4 w-4" />
                Nuevo Activo
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 pt-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Icon name="search" className="h-4 w-4" />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar código, nombre, serie, categoría..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>
          </div>

          {/* KPIs */}
          <div className="px-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-medium text-gray-600">Total</div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {kpis.total}
                </div>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-xs font-medium text-gray-600">
                  Operativos
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {kpis.oper}
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs font-medium text-gray-600">
                  En mantenimiento
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {kpis.mant}
                </div>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                <div className="text-xs font-medium text-gray-600">
                  Fuera de servicio
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {kpis.fuera}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="text-xs font-medium text-gray-600">
                  Retirado
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {kpis.retir}
                </div>
              </div>
            </div>
          </div>

          {/* Tabla + drawer */}
          <div className="px-4 pb-4 h-[calc(100%-250px)] min-h-0">
            <div className="grid h-full min-h-0 grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
              {/* Tabla */}
              <div className="min-h-0 overflow-hidden rounded-lg border">
                <div className="h-full min-h-0 overflow-auto">
                  <table className="min-w-full table-fixed divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-28">
                          Código
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
                          Nombre
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-44">
                          Categoría
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-44">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 w-28">
                          Crit.
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-200 bg-white">
                      {isLoading ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-10 text-center text-gray-400"
                          >
                            Cargando…
                          </td>
                        </tr>
                      ) : filteredAssets.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-10 text-center text-gray-400"
                          >
                            No hay activos para mostrar.
                          </td>
                        </tr>
                      ) : (
                        filteredAssets.map((a) => {
                          const selected =
                            selectedAssetId &&
                            String(a.id) === String(selectedAssetId);

                          const categoryName =
                            (a as AssetView & { category_name?: string | null })
                              .category_name ?? null;

                          return (
                            <tr
                              key={String(a.id)}
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
                                <div className="text-sm font-medium text-indigo-700">
                                  {a.name}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {a.location_name ?? '—'}
                                </div>
                              </td>

                              {/* ✅ nombre de categoría */}
                              <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                                {categoryName ? categoryName : '—'}
                              </td>

                              <td className="px-4 py-4 whitespace-nowrap">
                                <StatusBadge value={a.status} />
                              </td>
                              <td className="px-4 py-4">
                                <CriticalityDots value={a.criticality ?? 3} />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Drawer */}
              <aside className="hidden xl:flex min-h-0 flex-col rounded-lg border bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {selectedAsset
                      ? `${selectedAsset.code} — ${selectedAsset.name}`
                      : 'Detalle'}
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

                <div className="px-4 pt-4">
                  {selectedAsset?.image_url ? (
                    <img
                      src={selectedAsset.image_url}
                      alt="Activo"
                      className="h-40 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-40 w-full rounded-lg bg-gray-100" />
                  )}
                </div>

                <div className="px-4 pt-4">
                  {selectedAsset ? (
                    <div className="flex items-center gap-2">
                      <StatusBadge value={selectedAsset.status} />
                      <span className="ml-auto inline-flex items-center gap-1 text-sm text-gray-600">
                        <Icon name="pin" className="h-4 w-4 text-gray-400" />
                        {selectedAsset.location_name ?? '—'}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Selecciona un activo.
                    </div>
                  )}
                </div>

                {/* ✅ categoría visible en drawer */}
                <div className="px-4 pt-3">
                  <div className="text-xs text-gray-500">Categoría</div>
                  <div className="text-sm font-medium text-gray-900">
                    {selectedCategoryName ?? '—'}
                  </div>
                </div>

                <div className="px-4 pt-4">
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="text-xs font-semibold text-gray-700">
                      Datos técnicos
                    </div>

                    <div className="mt-2 space-y-1 text-sm text-gray-700">
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">Modelo</span>
                        <span className="font-medium">
                          {displayText(selectedAsset?.model)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">No. Serie</span>
                        <span className="font-medium">
                          {displayText(selectedAsset?.serial_number)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">Asset tag</span>
                        <span className="font-medium">
                          {displayText(selectedAsset?.asset_tag)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-auto border-t bg-white p-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!selectedAsset}
                      onClick={() => setModal('edit')}
                      className={cx(
                        'inline-flex w-full items-center justify-center gap-2 rounded-md border bg-white px-3 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50',
                        !selectedAsset && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      <Icon name="edit" className="h-4 w-4" />
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => void reload()}
                      className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-3 py-3 text-sm font-semibold text-white hover:bg-indigo-500 shadow-sm"
                    >
                      Refrescar
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>

      {/* Modal Create */}
      {modal === 'create' && (
        <AssetCreateForm onClose={() => setModal('none')} onCreated={reload} />
      )}

      {/* Modal Edit */}
      {modal === 'edit' && selectedAsset && (
        <AssetEditForm
          asset={selectedAsset}
          onClose={() => setModal('none')}
          onUpdated={reload}
        />
      )}
    </div>
  );
}
