import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  FileText,
  Grid2X2,
  MapPin,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  SlidersHorizontal,
  Wrench,
  X,
} from 'lucide-react';
import type {
  AssetMaintenanceLog,
  AssetManual,
  AssetStatus,
  AssetTicketView,
  AssetView,
  BigIntLike,
} from '../../../../types/Asset';
import {
  getAssetMaintenanceLog,
  getAssetManualPublicUrl,
  getAssetManualViewUrl,
  getAssetTicketsView,
  getAssets,
  listAssetManuals,
  runAssetPreventiveSchedulerNow,
} from '../../../../services/assetsService';
import { showToastError, showToastSuccess } from '../../../../notifications';
import AssetCreateForm from './AssetCreateForm';
import AssetCategoriesManager from './AssetCategoriesManager';
import AssetEditForm from './AssetEditForm';
import AnimatedDialog from '../../../ui/AnimatedDialog';

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
  if (!asset?.preventive_is_active) return 'Sin plan';

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
      tone: 'border-blue-200 bg-blue-50 text-blue-700',
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
      tone: 'border-orange-200 bg-orange-50 text-orange-700',
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

function criticalityTone(value: number) {
  if (value >= 5) return 'border-rose-200 bg-rose-50 text-rose-700';
  if (value === 4) return 'border-orange-200 bg-orange-50 text-orange-700';
  if (value === 3) return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

function CriticalityPill({ value }: { value: number }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        criticalityTone(value)
      )}
    >
      C{value} · {criticalityLabel(value)}
    </span>
  );
}

type ViewMode = 'none' | 'create' | 'edit';
type DetailTab = 'tickets' | 'maintenance';
type PreventiveFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'DUE_30' | 'OVERDUE';

const PAGE_SIZE = 10;

export default function AssetsBoard() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<AssetView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isRunningScheduler, setIsRunningScheduler] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'ALL'>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [preventiveFilter, setPreventiveFilter] =
    useState<PreventiveFilter>('ALL');
  const [page, setPage] = useState(1);

  const [selectedAssetId, setSelectedAssetId] = useState<BigIntLike | null>(
    null
  );

  const [modal, setModal] = useState<ViewMode>('none');
  const [activityModal, setActivityModal] = useState<DetailTab | null>(null);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [assetTickets, setAssetTickets] = useState<AssetTicketView[]>([]);
  const [maintenanceLog, setMaintenanceLog] = useState<AssetMaintenanceLog[]>(
    []
  );
  const [assetManuals, setAssetManuals] = useState<AssetManual[]>([]);
  const [manualsRefreshKey, setManualsRefreshKey] = useState(0);

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
    setPage(1);
  }, [locationFilter, preventiveFilter, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedAssets = filteredAssets.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const pageStart =
    filteredAssets.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filteredAssets.length);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
    if (!selectedAsset) setActivityModal(null);
  }, [selectedAsset]);

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

  useEffect(() => {
    if (!selectedAssetId) {
      setAssetManuals([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const manuals = await listAssetManuals(selectedAssetId);
        if (!cancelled) setAssetManuals(manuals);
      } catch {
        if (!cancelled) setAssetManuals([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedAssetId, manualsRefreshKey]);

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

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setLocationFilter('ALL');
    setPreventiveFilter('ALL');
  };

  return (
    <div className="h-full max-h-full max-w-full overflow-y-auto overflow-x-hidden bg-[#f7f9fc] px-4 py-6 text-slate-900 md:px-6 lg:px-8 dark:bg-slate-950 dark:text-slate-100">
      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-normal text-slate-950 dark:text-white">
            Activos fijos
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Gestione el inventario de activos físicos y su mantenimiento
            preventivo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setModal('create')}
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Plus className="h-5 w-5" />
            Nuevo activo
          </button>

          <button
            type="button"
            onClick={() => void handleRunPreventiveScheduler()}
            disabled={isRunningScheduler}
            className={cx(
              'inline-flex h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
              isRunningScheduler && 'cursor-not-allowed opacity-60'
            )}
            title="Ejecuta ahora la generación automática de OT preventivas"
          >
            <Play className="h-4 w-4 fill-slate-800 dark:fill-slate-100" />
            {isRunningScheduler ? 'Ejecutando' : 'Ejecutar preventivo'}
          </button>

          <AssetCategoriesManager />

          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </button>
        </div>
      </header>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))_auto]">
          <FieldShell label="Búsqueda">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Código, nombre, serie, categoría o ubicación"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-500/20"
              />
            </div>
          </FieldShell>

          <FieldShell label="Estado">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as AssetStatus | 'ALL')
              }
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-500/20"
            >
              <option value="ALL">Todos los estados</option>
              <option value="OPERATIVO">Operativo</option>
              <option value="EN_MANTENIMIENTO">En mantenimiento</option>
              <option value="FUERA_DE_SERVICIO">Fuera de servicio</option>
              <option value="RETIRADO">Retirado</option>
            </select>
          </FieldShell>

          <FieldShell label="Ubicación">
            <select
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-500/20"
            >
              <option value="ALL">Todas las ubicaciones</option>
              {locationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldShell>

          <FieldShell label="Mantenimiento preventivo">
            <select
              value={preventiveFilter}
              onChange={(event) =>
                setPreventiveFilter(event.target.value as PreventiveFilter)
              }
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-blue-500/20"
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Con plan activo</option>
              <option value="INACTIVE">Sin plan activo</option>
              <option value="DUE_30">Vence en 30 días</option>
              <option value="OVERDUE">Vencido</option>
            </select>
          </FieldShell>

          <div className="flex items-end">
            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 lg:w-auto dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={clearFilters}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Limpiar filtros
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        <MetricCard
          icon={<Grid2X2 className="h-7 w-7" />}
          label="Total"
          value={kpis.total}
          tone="blue"
        />
        <MetricCard
          icon={<CheckCircle2 className="h-7 w-7" />}
          label="Operativos"
          value={kpis.operational}
          tone="emerald"
        />
        <MetricCard
          icon={<Wrench className="h-7 w-7" />}
          label="En mantenimiento"
          value={kpis.inMaintenance}
          tone="amber"
        />
        <MetricCard
          icon={<AlertTriangle className="h-7 w-7" />}
          label="Fuera de servicio"
          value={kpis.outOfService}
          tone="rose"
        />
        <MetricCard
          icon={<CalendarDays className="h-7 w-7" />}
          label="Con plan preventivo"
          value={kpis.preventiveActive}
          tone="blue"
        />
        <MetricCard
          icon={<Clock3 className="h-7 w-7" />}
          label="Vence ≤ 30 días"
          value={kpis.due30}
          tone="orange"
        />
        <MetricCard
          icon={<CalendarX2 className="h-7 w-7" />}
          label="Vencidos"
          value={kpis.overdue}
          tone="rose"
        />
      </section>

      <section className="mt-5 grid min-w-0 max-w-full grid-cols-1 items-start gap-5 overflow-hidden min-[1500px]:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
        <div className="flex h-[36rem] max-h-[36rem] w-full min-w-0 max-w-none flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-h-14 items-center border-b border-slate-200 px-5 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-950 dark:text-white">
              Lista de activos ({filteredAssets.length})
            </h2>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-[720px] w-full table-fixed text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                <tr>
                  <th className="w-24 px-4 py-4">Código</th>
                  <th className="w-[22%] px-4 py-4">Activo</th>
                  <th className="w-[18%] px-4 py-4">Ubicación</th>
                  <th className="w-[15%] px-4 py-4">Estado</th>
                  <th className="w-[24%] px-4 py-4">Preventivo</th>
                  <th className="w-[15%] px-4 py-4">Criticidad</th>
                  <th className="w-12 px-3 py-4 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                      Cargando activos...
                    </td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                      {showEmptyByFilters
                        ? 'No hay activos que cumplan los filtros actuales.'
                        : 'No hay activos registrados.'}
                    </td>
                  </tr>
                ) : (
                  pagedAssets.map((asset) => {
                    const selected = toId(asset.id) === toId(selectedAssetId);
                    const pState = preventiveState(asset);

                    return (
                      <tr
                        key={toId(asset.id)}
                        onClick={() => {
                          setSelectedAssetId(asset.id);
                          setModal('edit');
                        }}
                        className={cx(
                          'group cursor-pointer transition hover:bg-blue-50/50 dark:hover:bg-blue-950/20',
                          selected &&
                            'bg-blue-50/70 shadow-[inset_4px_0_0_#2563eb] dark:bg-blue-950/30'
                        )}
                      >
                        <td className="whitespace-nowrap px-4 py-5 align-middle font-bold text-slate-900 dark:text-slate-100">
                          {asset.code}
                        </td>
                        <td className="px-4 py-5 align-middle">
                          <div className="truncate font-bold text-slate-950 dark:text-white">
                            {asset.name}
                          </div>
                          <div className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                            {asset.category_name ?? 'Sin categoría'}
                          </div>
                        </td>
                        <td className="px-4 py-5 align-middle text-slate-700 dark:text-slate-300">
                          <span className="inline-flex max-w-full items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-slate-500" />
                            <span className="truncate">{asset.location_name ?? '—'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-5 align-middle">
                          <StatusPill status={asset.status} />
                        </td>
                        <td className="px-4 py-5 align-middle">
                          <div className="flex flex-col gap-1.5">
                            <span
                              className={cx(
                                'inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                                pState.tone
                              )}
                            >
                              {pState.label}
                            </span>
                            {asset.preventive_is_active ? (
                              <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {preventiveFrequencyLabel(asset)} · Próx.{' '}
                                {formatDateOnly(asset.preventive_next_due_on)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-5 align-middle">
                          <CriticalityPill value={asset.criticality ?? 3} />
                        </td>
                        <td className="px-3 py-5 text-right align-middle">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedAssetId(asset.id);
                              setModal('edit');
                            }}
                            aria-label={`Editar ${asset.code}`}
                            title="Editar"
                          >
                            <MoreVertical className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>Mostrar</span>
              <span className="inline-flex h-9 min-w-14 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                {PAGE_SIZE}
              </span>
              <span>por página</span>
            </div>

            <div className="flex items-center justify-between gap-6 sm:justify-end">
              <div>
                {pageStart} - {pageEnd} de {filteredAssets.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-blue-600 px-3 text-sm font-bold text-white shadow-sm shadow-blue-600/25">
                  {currentPage}
                </span>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
                  disabled={currentPage >= totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full min-w-0 min-[1500px]:max-w-[340px]">
          <AssetDetailPanel
            asset={selectedAsset}
            tickets={assetTickets}
            maintenanceLog={maintenanceLog}
            manuals={assetManuals}
            onEdit={() => setModal('edit')}
            onOpenActivity={setActivityModal}
          />
        </div>
      </section>

      {selectedAsset && activityModal ? (
        <ActivityModal
          asset={selectedAsset}
          type={activityModal}
          tickets={assetTickets}
          maintenanceLog={maintenanceLog}
          loading={historyLoading}
          error={historyError}
          onClose={() => setActivityModal(null)}
          onOpenTicket={(ticketId) => {
            setActivityModal(null);
            navigate(`/tickets/${ticketId}`);
          }}
        />
      ) : null}

      {modal === 'create' ? (
        <AssetCreateForm onClose={() => setModal('none')} onCreated={reload} />
      ) : null}

      {modal === 'edit' && selectedAsset ? (
        <AssetEditForm
          asset={selectedAsset}
          onClose={() => setModal('none')}
          onUpdated={reload}
          onManualsChanged={() => setManualsRefreshKey((value) => value + 1)}
        />
      ) : null}
    </div>
  );
}

function FieldShell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

type MetricTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'orange';

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: MetricTone;
}) {
  const toneMap: Record<
    MetricTone,
    { frame: string; icon: string; value: string }
  > = {
    blue: {
      frame: 'bg-blue-50',
      icon: 'text-blue-600',
      value: 'text-blue-700',
    },
    emerald: {
      frame: 'bg-emerald-50',
      icon: 'text-emerald-600',
      value: 'text-slate-950 dark:text-white',
    },
    amber: {
      frame: 'bg-amber-50',
      icon: 'text-amber-600',
      value: 'text-slate-950 dark:text-white',
    },
    rose: {
      frame: 'bg-rose-50',
      icon: 'text-rose-600',
      value: 'text-rose-600',
    },
    orange: {
      frame: 'bg-orange-50',
      icon: 'text-orange-600',
      value: 'text-slate-950 dark:text-white',
    },
  };
  const current = toneMap[tone];

  return (
    <article className="flex min-h-24 items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div
        className={cx(
          'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
          current.frame,
          current.icon
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-600 dark:text-slate-400">
          {label}
        </div>
        <div className={cx('mt-1 text-2xl font-bold leading-none', current.value)}>
          {value}
        </div>
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: AssetStatus }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        statusTone(status)
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}

function AssetDetailPanel({
  asset,
  tickets,
  maintenanceLog,
  manuals,
  onEdit,
  onOpenActivity,
}: {
  asset: AssetView | null;
  tickets: AssetTicketView[];
  maintenanceLog: AssetMaintenanceLog[];
  manuals: AssetManual[];
  onEdit: () => void;
  onOpenActivity: (tab: DetailTab) => void;
}) {
  if (!asset) {
    return (
      <aside className="min-w-0 flex h-[36rem] max-h-[36rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-8 text-center text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Selecciona un activo para ver su detalle operativo.
      </aside>
    );
  }

  const preventive = preventiveState(asset);

  return (
    <aside className="min-w-0 flex h-[36rem] max-h-[36rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-slate-950 dark:text-white">
              {asset.code} · {asset.name}
            </h2>
            <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
              {asset.category_name ?? 'Sin categoría'} ·{' '}
              {asset.location_name ?? 'Sin ubicación'}
            </p>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <section>
          <SectionTitle icon={<Grid2X2 className="h-4 w-4" />}>
            Resumen técnico
          </SectionTitle>
          <div className="mt-3 space-y-3 text-sm">
            <RowLabel label="Estado" value={<StatusPill status={asset.status} />} />
            <RowLabel
              label="Criticidad"
              value={<CriticalityPill value={asset.criticality ?? 3} />}
            />
            <RowLabel label="Modelo" value={asset.model ?? '—'} />
            <RowLabel label="No. serie" value={asset.serial_number ?? '—'} />
            <RowLabel label="Asset tag" value={asset.asset_tag ?? '—'} />
            <RowLabel label="Garantía" value={formatDateOnly(asset.warranty_end_date)} />
          </div>
        </section>

        <Divider />

        <section>
          <div className="flex items-center justify-between gap-3">
            <SectionTitle icon={<CalendarDays className="h-4 w-4" />}>
              Plan preventivo
            </SectionTitle>
            <span
              className={cx(
                'inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                preventive.tone
              )}
            >
              {preventive.label}
            </span>
          </div>

          <div className="mt-3 space-y-3 text-sm">
            <RowLabel label="Frecuencia" value={preventiveFrequencyLabel(asset)} />
            <RowLabel
              label="Próxima OT"
              value={formatDateOnly(asset.preventive_next_due_on)}
            />
            <RowLabel label="Inicio" value={formatDateOnly(asset.preventive_start_on)} />
            <RowLabel
              label="Generar con anticipación"
              value={`${asset.preventive_lead_days ?? 0} día(s)`}
            />
            <RowLabel
              label="Última OT creada"
              value={formatDateTime(asset.preventive_last_generated_at)}
            />
            <RowLabel
              label="Último cierre"
              value={formatDateTime(asset.preventive_last_completed_at)}
            />
          </div>

          {asset.preventive_instructions ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              {asset.preventive_instructions}
            </div>
          ) : null}
        </section>

        <Divider />

        <section>
          <div className="flex items-center justify-between gap-3">
            <SectionTitle icon={<FileText className="h-4 w-4" />}>
              Manuales técnicos
            </SectionTitle>
            <span className="shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {manuals.length}
            </span>
          </div>

          {manuals.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Sin manuales cargados. Agrégalos desde el botón Editar.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {manuals.map((manual) => (
                <div
                  key={String(manual.id)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
                >
                  <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                  <a
                    href={getAssetManualViewUrl(manual)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-300"
                    title="Ver en línea"
                  >
                    {manual.title}
                  </a>
                  <a
                    href={getAssetManualViewUrl(manual)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                    title="Ver en línea"
                    aria-label={`Ver ${manual.title}`}
                  >
                    <Eye className="h-4 w-4" />
                  </a>
                  <a
                    href={getAssetManualPublicUrl(manual.file_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={manual.file_name ?? undefined}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
                    title="Descargar"
                    aria-label={`Descargar ${manual.title}`}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        <Divider />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-1 min-[1800px]:grid-cols-2">
          <ActivityCard
            icon={<ClipboardList className="h-5 w-5" />}
            label="Histórico"
            value={tickets.length}
            onClick={() => onOpenActivity('tickets')}
          />
          <ActivityCard
            icon={<Wrench className="h-5 w-5" />}
            label="Bitácora"
            value={maintenanceLog.length}
            onClick={() => onOpenActivity('maintenance')}
          />
        </div>
      </div>
    </aside>
  );
}

function SectionTitle({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
        {icon}
      </span>
      {children}
    </h3>
  );
}

function Divider() {
  return <div className="my-4 border-t border-slate-200 dark:border-slate-800" />;
}

function RowLabel({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="min-w-0 text-slate-500 dark:text-slate-400">{label}</span>
      <span className="max-w-[58%] truncate text-right font-semibold text-slate-800 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

function ActivityCard({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-20 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:border-blue-200 hover:bg-blue-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-blue-950/20"
    >
      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block whitespace-nowrap text-sm font-bold text-slate-800 dark:text-slate-100">
            {label}
          </span>
          <span className="mt-1 block text-2xl font-bold leading-none text-slate-950 dark:text-white">
            {value}
          </span>
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-700 dark:text-slate-300" />
    </button>
  );
}

function ActivityModal({
  asset,
  type,
  tickets,
  maintenanceLog,
  loading,
  error,
  onClose,
  onOpenTicket,
}: {
  asset: AssetView;
  type: DetailTab;
  tickets: AssetTicketView[];
  maintenanceLog: AssetMaintenanceLog[];
  loading: boolean;
  error: string;
  onClose: () => void;
  onOpenTicket: (ticketId: BigIntLike) => void;
}) {
  const isTickets = type === 'tickets';
  const title = isTickets ? 'Histórico de mantenimientos' : 'Bitácora del activo';
  const count = isTickets ? tickets.length : maintenanceLog.length;

  return (
    <AnimatedDialog
      open
      onClose={onClose}
      lockScroll
      overlayClassName="bg-slate-950/50 backdrop-blur-[2px]"
      containerClassName="fixed inset-0 flex items-start justify-center overflow-y-auto px-4 py-6 sm:py-10"
      panelClassName="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-slate-950 dark:text-white">
            {title}
          </h2>
          <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
            {asset.code} · {asset.name} · {count}{' '}
            {isTickets ? 'mantenimiento(s)' : 'registro(s)'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="Cerrar"
          title="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
        <ActivityList
          detailTab={type}
          tickets={tickets}
          maintenanceLog={maintenanceLog}
          loading={loading}
          error={error}
          onOpenTicket={onOpenTicket}
        />
      </div>
    </AnimatedDialog>
  );
}

function ActivityList({
  detailTab,
  tickets,
  maintenanceLog,
  loading,
  error,
  onOpenTicket,
}: {
  detailTab: DetailTab;
  tickets: AssetTicketView[];
  maintenanceLog: AssetMaintenanceLog[];
  loading: boolean;
  error: string;
  onOpenTicket: (ticketId: BigIntLike) => void;
}) {
  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Cargando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (detailTab === 'tickets') {
    if (tickets.length === 0) {
      return (
        <div className="mt-4 rounded-xl border border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Sin mantenimientos vinculados.
        </div>
      );
    }

    return (
      <div className="mt-4 max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
        {tickets.map((ticket) => (
          <button
            type="button"
            key={`${ticket.asset_id}-${String(ticket.id)}`}
            onClick={() => onOpenTicket(ticket.id)}
            className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-blue-50/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:border-slate-800 dark:hover:bg-blue-950/20"
          >
            <div className="min-w-0">
              <div className="flex items-start gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <span className="min-w-0 truncate">
                  #{String(ticket.id)} {ticket.title ?? 'Ticket'}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {ticket.status ?? '—'} · {formatDateTime(ticket.created_at)}
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-300">
              Ver ticket
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (maintenanceLog.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Sin mantenimientos registrados.
      </div>
    );
  }

  return (
    <div className="mt-4 max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
      {maintenanceLog.map((entry) => (
        <div
          key={String(entry.id)}
          className="border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800"
        >
          <div className="flex items-start gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
            <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span className="min-w-0 truncate">
              {entry.maintenance_type} · {entry.summary}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatDateTime(entry.performed_at)}
            {entry.ticket_id ? ` · OT #${String(entry.ticket_id)}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}
