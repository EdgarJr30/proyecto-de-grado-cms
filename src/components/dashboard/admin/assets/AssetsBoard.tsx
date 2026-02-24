import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AssetMaintenanceLog,
  AssetStatus,
  AssetTicketView,
  AssetView,
  BigIntLike,
} from '../../../../types/Asset';
import {
  getAssetMaintenanceLog,
  getAssetTicketsView,
  getAssets,
  runAssetPreventiveSchedulerNow,
} from '../../../../services/assetsService';
import { showToastError, showToastSuccess } from '../../../../notifications';
import AssetCreateForm from './AssetCreateForm';
import AssetEditForm from './AssetEditForm';

function cx(...classes: Array<string | false | null | undefined | 0>) {
  return classes.filter(Boolean).join(' ');
}

function toId(value: BigIntLike | null | undefined): string {
  if (value == null) return '';
  return String(value);
}

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetweenToday(value: string | null | undefined): number | null {
  const date = parseDateOnly(value);
  if (!date) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = date.getTime() - today.getTime();
  return Math.floor(diff / 86_400_000);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = parseDateOnly(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function statusLabel(value: AssetStatus) {
  const map: Record<AssetStatus, string> = {
    OPERATIVO: 'Operativo',
    EN_MANTENIMIENTO: 'En mantenimiento',
    FUERA_DE_SERVICIO: 'Fuera de servicio',
    RETIRADO: 'Retirado',
  };
  return map[value];
}

function statusTone(value: AssetStatus) {
  const map: Record<AssetStatus, string> = {
    OPERATIVO: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    EN_MANTENIMIENTO: 'border-amber-200 bg-amber-50 text-amber-700',
    FUERA_DE_SERVICIO: 'border-rose-200 bg-rose-50 text-rose-700',
    RETIRADO: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  return map[value];
}

function preventiveFrequencyLabel(asset: AssetView | null) {
  if (!asset?.preventive_is_active) return 'Desactivado';

  const every = asset.preventive_frequency_value ?? 1;
  const unit = asset.preventive_frequency_unit ?? 'MONTH';

  const labels: Record<string, string> = {
    DAY: every === 1 ? 'día' : 'días',
    WEEK: every === 1 ? 'semana' : 'semanas',
    MONTH: every === 1 ? 'mes' : 'meses',
    YEAR: every === 1 ? 'año' : 'años',
  };

  return `Cada ${every} ${labels[unit] ?? unit.toLowerCase()}`;
}

function preventiveState(asset: AssetView | null): {
  label: string;
  tone: string;
} {
  if (!asset?.preventive_is_active) {
    return {
      label: 'Sin plan activo',
      tone: 'border-slate-200 bg-slate-100 text-slate-700',
    };
  }

  const days = daysBetweenToday(asset.preventive_next_due_on);

  if (days == null) {
    return {
      label: 'Plan activo',
      tone: 'border-sky-200 bg-sky-50 text-sky-700',
    };
  }

  if (days < 0) {
    return {
      label: `Vencido (${Math.abs(days)} día(s))`,
      tone: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }

  if (days <= 30) {
    return {
      label: `Próximo (${days} día(s))`,
      tone: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  return {
    label: 'Programado',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
}

function criticalityLabel(value: number) {
  if (value >= 5) return 'Crítica';
  if (value === 4) return 'Alta';
  if (value === 3) return 'Media';
  if (value === 2) return 'Baja';
  return 'Muy baja';
}

function CriticalityPill({ value }: { value: number }) {
  const tone =
    value >= 5
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : value === 4
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : value === 3
          ? 'border-sky-200 bg-sky-50 text-sky-700'
          : 'border-slate-200 bg-slate-100 text-slate-700';

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        tone
      )}
    >
      C{value} · {criticalityLabel(value)}
    </span>
  );
}

type ViewMode = 'none' | 'create' | 'edit';
type DetailTab = 'tickets' | 'maintenance';
type PreventiveFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'DUE_30' | 'OVERDUE';

export default function AssetsBoard() {
  const [assets, setAssets] = useState<AssetView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isRunningScheduler, setIsRunningScheduler] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'ALL'>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [preventiveFilter, setPreventiveFilter] =
    useState<PreventiveFilter>('ALL');

  const [selectedAssetId, setSelectedAssetId] = useState<BigIntLike | null>(
    null
  );

  const [modal, setModal] = useState<ViewMode>('none');
  const [detailTab, setDetailTab] = useState<DetailTab>('tickets');

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [assetTickets, setAssetTickets] = useState<AssetTicketView[]>([]);
  const [maintenanceLog, setMaintenanceLog] = useState<AssetMaintenanceLog[]>(
    []
  );

  async function reload() {
    setError('');
    setIsLoading(true);

    try {
      const list = await getAssets();
      setAssets(list);

      if (list.length === 0) {
        setSelectedAssetId(null);
        return;
      }

      const selectedId = toId(selectedAssetId);
      const selectedExists = list.some((asset) => toId(asset.id) === selectedId);
      if (!selectedId || !selectedExists) {
        setSelectedAssetId(list[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRunPreventiveScheduler() {
    if (isRunningScheduler) return;

    setIsRunningScheduler(true);
    try {
      const result = await runAssetPreventiveSchedulerNow();

      if (result.status === 'skipped_lock') {
        showToastError(
          'El scheduler preventivo ya está en ejecución. Intenta nuevamente en unos segundos.'
        );
        return;
      }

      const generated = result.generated ?? 0;
      const skippedOpen = result.skipped_open_work_order ?? 0;
      const skippedDuplicate = result.skipped_duplicate ?? 0;
      const runDate = result.run_date ?? 'sin fecha';

      showToastSuccess(
        `Scheduler preventivo ejecutado (${runDate}). Generadas: ${generated}, omitidas por OT abierta: ${skippedOpen}, duplicadas: ${skippedDuplicate}.`
      );

      await reload();
    } catch (err: unknown) {
      showToastError(
        err instanceof Error
          ? err.message
          : 'No se pudo ejecutar el scheduler preventivo.'
      );
    } finally {
      setIsRunningScheduler(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locationOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const asset of assets) {
      const key = asset.location_name?.trim();
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, key);
      }
    }

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();

    return assets.filter((asset) => {
      if (statusFilter !== 'ALL' && asset.status !== statusFilter) return false;
      if (locationFilter !== 'ALL' && asset.location_name !== locationFilter) {
        return false;
      }

      if (preventiveFilter === 'ACTIVE' && !asset.preventive_is_active) {
        return false;
      }

      if (preventiveFilter === 'INACTIVE' && asset.preventive_is_active) {
        return false;
      }

      if (preventiveFilter === 'DUE_30') {
        const days = daysBetweenToday(asset.preventive_next_due_on);
        if (!asset.preventive_is_active || days == null || days < 0 || days > 30) {
          return false;
        }
      }

      if (preventiveFilter === 'OVERDUE') {
        const days = daysBetweenToday(asset.preventive_next_due_on);
        if (!asset.preventive_is_active || days == null || days >= 0) {
          return false;
        }
      }

      if (!q) return true;

      const haystack = [
        asset.code,
        asset.name,
        asset.model ?? '',
        asset.serial_number ?? '',
        asset.asset_tag ?? '',
        asset.location_name ?? '',
        asset.category_name ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [assets, locationFilter, preventiveFilter, search, statusFilter]);

  useEffect(() => {
    if (filteredAssets.length === 0) {
      setSelectedAssetId(null);
      return;
    }

    const currentId = toId(selectedAssetId);
    const exists = filteredAssets.some((asset) => toId(asset.id) === currentId);

    if (!currentId || !exists) {
      setSelectedAssetId(filteredAssets[0].id);
    }
  }, [filteredAssets, selectedAssetId]);

  const selectedAsset = useMemo(() => {
    if (!selectedAssetId) return null;
    const id = toId(selectedAssetId);
    return filteredAssets.find((asset) => toId(asset.id) === id) ?? null;
  }, [filteredAssets, selectedAssetId]);

  useEffect(() => {
    if (!selectedAssetId) {
      setAssetTickets([]);
      setMaintenanceLog([]);
      setHistoryError('');
      return;
    }

    let cancelled = false;

    (async () => {
      setHistoryLoading(true);
      setHistoryError('');

      try {
        const [tickets, logs] = await Promise.all([
          getAssetTicketsView(selectedAssetId),
          getAssetMaintenanceLog(selectedAssetId),
        ]);

        if (cancelled) return;

        setAssetTickets(tickets);
        setMaintenanceLog(logs);
      } catch (err: unknown) {
        if (cancelled) return;

        setHistoryError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar el historial del activo.'
        );
        setAssetTickets([]);
        setMaintenanceLog([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedAssetId]);

  const kpis = useMemo(() => {
    const total = filteredAssets.length;
    const operational = filteredAssets.filter((a) => a.status === 'OPERATIVO').length;
    const inMaintenance = filteredAssets.filter(
      (a) => a.status === 'EN_MANTENIMIENTO'
    ).length;
    const outOfService = filteredAssets.filter(
      (a) => a.status === 'FUERA_DE_SERVICIO'
    ).length;
    const preventiveActive = filteredAssets.filter(
      (a) => a.preventive_is_active
    ).length;

    const due30 = filteredAssets.filter((a) => {
      const days = daysBetweenToday(a.preventive_next_due_on);
      return Boolean(a.preventive_is_active) && days != null && days >= 0 && days <= 30;
    }).length;

    const overdue = filteredAssets.filter((a) => {
      const days = daysBetweenToday(a.preventive_next_due_on);
      return Boolean(a.preventive_is_active) && days != null && days < 0;
    }).length;

    return {
      total,
      operational,
      inMaintenance,
      outOfService,
      preventiveActive,
      due30,
      overdue,
    };
  }, [filteredAssets]);

  const showEmptyByFilters =
    search.trim().length > 0 ||
    statusFilter !== 'ALL' ||
    locationFilter !== 'ALL' ||
    preventiveFilter !== 'ALL';

  return (
    <div className="h-full min-h-0 p-1 sm:p-2">
      {error ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-sm">
        <header className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Maestro de activos
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Vista operacional estilo ERP: consulta, prioriza y gestiona
                mantenimiento preventivo por equipo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleRunPreventiveScheduler()}
                disabled={isRunningScheduler}
                className={cx(
                  'rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100',
                  isRunningScheduler && 'cursor-not-allowed opacity-60'
                )}
                title="Ejecuta ahora la generación automática de OT preventivas"
              >
                {isRunningScheduler
                  ? 'Ejecutando preventivo...'
                  : 'Ejecutar preventivo ahora'}
              </button>
              <button
                type="button"
                onClick={() => setModal('create')}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                Nuevo activo
              </button>
              <button
                type="button"
                disabled={!selectedAsset}
                onClick={() => setModal('edit')}
                className={cx(
                  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50',
                  !selectedAsset && 'cursor-not-allowed opacity-50'
                )}
              >
                Editar seleccionado
              </button>
              <button
                type="button"
                onClick={() => void reload()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Refrescar
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Buscar
              </label>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Código, nombre, serie, categoría o ubicación"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Estado
              </label>
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as AssetStatus | 'ALL')
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="ALL">Todos los estados</option>
                <option value="OPERATIVO">Operativo</option>
                <option value="EN_MANTENIMIENTO">En mantenimiento</option>
                <option value="FUERA_DE_SERVICIO">Fuera de servicio</option>
                <option value="RETIRADO">Retirado</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ubicación
              </label>
              <select
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="ALL">Todas las ubicaciones</option>
                {locationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Mantenimiento preventivo
              </label>
              <select
                value={preventiveFilter}
                onChange={(event) =>
                  setPreventiveFilter(event.target.value as PreventiveFilter)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="ALL">Todos</option>
                <option value="ACTIVE">Con plan activo</option>
                <option value="INACTIVE">Sin plan activo</option>
                <option value="DUE_30">Vence en 30 días</option>
                <option value="OVERDUE">Vencido</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-500">
              Mostrando <span className="font-semibold text-slate-700">{filteredAssets.length}</span>{' '}
              activo(s) de {assets.length}
            </div>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setLocationFilter('ALL');
                setPreventiveFilter('ALL');
              }}
            >
              Limpiar filtros
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:grid-cols-4 xl:grid-cols-7 sm:px-5">
          <KpiCard label="Total" value={kpis.total} tone="slate" />
          <KpiCard label="Operativos" value={kpis.operational} tone="emerald" />
          <KpiCard
            label="En mantenimiento"
            value={kpis.inMaintenance}
            tone="amber"
          />
          <KpiCard
            label="Fuera de servicio"
            value={kpis.outOfService}
            tone="rose"
          />
          <KpiCard
            label="Plan preventivo"
            value={kpis.preventiveActive}
            tone="indigo"
          />
          <KpiCard label="Vence ≤ 30d" value={kpis.due30} tone="orange" />
          <KpiCard label="Vencidos" value={kpis.overdue} tone="rose" />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 xl:grid-cols-[1fr_370px] sm:p-5">
          <div className="min-h-0 overflow-hidden rounded-xl border border-slate-200">
            <div className="h-full min-h-0 overflow-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Código
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Activo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ubicación
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Preventivo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Criticidad
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                        Cargando activos...
                      </td>
                    </tr>
                  ) : filteredAssets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                        {showEmptyByFilters
                          ? 'No hay activos que cumplan los filtros actuales.'
                          : 'No hay activos registrados.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAssets.map((asset) => {
                      const selected = toId(asset.id) === toId(selectedAssetId);
                      const pState = preventiveState(asset);

                      return (
                        <tr
                          key={toId(asset.id)}
                          onClick={() => setSelectedAssetId(asset.id)}
                          className={cx(
                            'cursor-pointer transition hover:bg-indigo-50/40',
                            selected && 'bg-indigo-50/70'
                          )}
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                            {asset.code}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{asset.name}</div>
                            <div className="text-xs text-slate-500">
                              {asset.category_name ?? 'Sin categoría'}
                              {asset.model ? ` · ${asset.model}` : ''}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                            {asset.location_name ?? '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={cx(
                                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                                statusTone(asset.status)
                              )}
                            >
                              {statusLabel(asset.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span
                                className={cx(
                                  'inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                                  pState.tone
                                )}
                              >
                                {pState.label}
                              </span>
                              {asset.preventive_is_active ? (
                                <span className="text-xs text-slate-500">
                                  {preventiveFrequencyLabel(asset)} · Próx.{' '}
                                  {formatDateOnly(asset.preventive_next_due_on)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <CriticalityPill value={asset.criticality ?? 3} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {!selectedAsset ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
                Selecciona un activo para ver su detalle operativo.
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {selectedAsset.code} · {selectedAsset.name}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500">
                        {selectedAsset.category_name ?? 'Sin categoría'} ·{' '}
                        {selectedAsset.location_name ?? 'Sin ubicación'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModal('edit')}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Editar
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Resumen técnico
                    </h4>
                    <div className="mt-2 space-y-2 text-xs text-slate-700">
                      <RowLabel
                        label="Estado"
                        value={
                          <span
                            className={cx(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                              statusTone(selectedAsset.status)
                            )}
                          >
                            {statusLabel(selectedAsset.status)}
                          </span>
                        }
                      />
                      <RowLabel
                        label="Criticidad"
                        value={<CriticalityPill value={selectedAsset.criticality ?? 3} />}
                      />
                      <RowLabel label="Modelo" value={selectedAsset.model ?? '—'} />
                      <RowLabel
                        label="No. serie"
                        value={selectedAsset.serial_number ?? '—'}
                      />
                      <RowLabel
                        label="Asset tag"
                        value={selectedAsset.asset_tag ?? '—'}
                      />
                      <RowLabel
                        label="Garantía"
                        value={formatDateOnly(selectedAsset.warranty_end_date)}
                      />
                    </div>
                  </section>

                  <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        Plan preventivo
                      </h4>
                      <span
                        className={cx(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          preventiveState(selectedAsset).tone
                        )}
                      >
                        {preventiveState(selectedAsset).label}
                      </span>
                    </div>

                    <div className="mt-2 space-y-2 text-xs text-slate-700">
                      <RowLabel
                        label="Frecuencia"
                        value={preventiveFrequencyLabel(selectedAsset)}
                      />
                      <RowLabel
                        label="Próxima OT"
                        value={formatDateOnly(selectedAsset.preventive_next_due_on)}
                      />
                      <RowLabel
                        label="Inicio"
                        value={formatDateOnly(selectedAsset.preventive_start_on)}
                      />
                      <RowLabel
                        label="Generar con anticipación"
                        value={`${selectedAsset.preventive_lead_days ?? 0} día(s)`}
                      />
                      <RowLabel
                        label="Última OT creada"
                        value={formatDateTime(selectedAsset.preventive_last_generated_at)}
                      />
                      <RowLabel
                        label="Último cierre"
                        value={formatDateTime(selectedAsset.preventive_last_completed_at)}
                      />
                    </div>

                    {selectedAsset.preventive_instructions ? (
                      <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-600">
                        {selectedAsset.preventive_instructions}
                      </div>
                    ) : null}
                  </section>

                  <section className="mt-3 rounded-lg border border-slate-200 bg-white">
                    <div className="flex border-b border-slate-200 p-1">
                      <button
                        type="button"
                        onClick={() => setDetailTab('tickets')}
                        className={cx(
                          'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition',
                          detailTab === 'tickets'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        )}
                      >
                        Tickets ({assetTickets.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTab('maintenance')}
                        className={cx(
                          'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition',
                          detailTab === 'maintenance'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 hover:bg-slate-50'
                        )}
                      >
                        Bitácora ({maintenanceLog.length})
                      </button>
                    </div>

                    {historyLoading ? (
                      <div className="px-3 py-5 text-xs text-slate-500">Cargando...</div>
                    ) : historyError ? (
                      <div className="px-3 py-5 text-xs text-rose-600">{historyError}</div>
                    ) : detailTab === 'tickets' ? (
                      assetTickets.length === 0 ? (
                        <div className="px-3 py-5 text-xs text-slate-500">
                          Sin tickets vinculados.
                        </div>
                      ) : (
                        <div className="max-h-60 overflow-auto divide-y divide-slate-100">
                          {assetTickets.map((ticket) => (
                            <div
                              key={`${ticket.asset_id}-${String(ticket.id)}`}
                              className="px-3 py-2"
                            >
                              <div className="text-xs font-semibold text-slate-900">
                                #{String(ticket.id)} {ticket.title ?? 'Ticket'}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-500">
                                {ticket.status ?? '—'} · {formatDateTime(ticket.created_at)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : maintenanceLog.length === 0 ? (
                      <div className="px-3 py-5 text-xs text-slate-500">
                        Sin mantenimientos registrados.
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-auto divide-y divide-slate-100">
                        {maintenanceLog.map((entry) => (
                          <div key={String(entry.id)} className="px-3 py-2">
                            <div className="text-xs font-semibold text-slate-900">
                              {entry.maintenance_type} · {entry.summary}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              {formatDateTime(entry.performed_at)}
                              {entry.ticket_id
                                ? ` · OT #${String(entry.ticket_id)}`
                                : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      {modal === 'create' ? (
        <AssetCreateForm onClose={() => setModal('none')} onCreated={reload} />
      ) : null}

      {modal === 'edit' && selectedAsset ? (
        <AssetEditForm
          asset={selectedAsset}
          onClose={() => setModal('none')}
          onUpdated={reload}
        />
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'orange';
}) {
  const toneMap: Record<typeof tone, string> = {
    slate: 'border-slate-200 bg-white text-slate-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    orange: 'border-orange-200 bg-orange-50 text-orange-800',
  };

  return (
    <div className={cx('rounded-lg border px-3 py-2.5', toneMap[tone])}>
      <div className="text-[11px] font-semibold uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-xl font-bold leading-none">{value}</div>
    </div>
  );
}

function RowLabel({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}
