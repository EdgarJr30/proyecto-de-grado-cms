import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePermissions } from '../../rbac/PermissionsContext';
import {
  getAdminReportsData,
  getAssetsReport,
  getExecutiveSummaryReport,
  getInventoryPartsReport,
  getWorkManagementReport,
} from '../../services/reportService';
import { listLocationOptions } from '../../services/locationService';
import type {
  AdminReportsData,
  AssetsReport,
  DashboardReportFilters,
  ExecutiveSummaryReport,
  InventoryPartsReport,
  WorkManagementReport,
} from '../../types/Report';
import HorizontalBarList from '../dashboard/reports/HorizontalBarList';
import KpiTile from '../dashboard/reports/KpiTile';
import ReportCard from '../dashboard/reports/ReportCard';
import ReportTable from '../dashboard/reports/ReportTable';
import type { ReportTableColumn } from '../dashboard/reports/ReportTable';
import ReportTabs from '../dashboard/reports/ReportTabs';

type TabId = 'executive' | 'work' | 'assets' | 'parts' | 'admin';

type SectionState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

type LocationOption = {
  id: number;
  name: string;
  code: string;
};

const emptySection = <T,>(): SectionState<T> => ({
  loading: false,
  error: null,
  data: null,
});

const PRESET_LABELS: Record<string, string> = {
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
  ytd: 'Año actual (YTD)',
  custom: 'Personalizado',
};

function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPresetRange(preset: '30d' | '90d' | 'ytd') {
  const now = new Date();
  const to = toInputDate(now);

  if (preset === 'ytd') {
    return {
      from: `${now.getFullYear()}-01-01`,
      to,
    };
  }

  const days = preset === '30d' ? 30 : 90;
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - days);

  return {
    from: toInputDate(fromDate),
    to,
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-DO').format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatHours(value: number) {
  return `${new Intl.NumberFormat('es-DO', {
    maximumFractionDigits: 1,
  }).format(value)} h`;
}

function buildFilters(args: {
  locationId: number | '';
  fromDate: string;
  toDate: string;
}): DashboardReportFilters {
  return {
    locationId: typeof args.locationId === 'number' ? args.locationId : undefined,
    from: args.fromDate ? `${args.fromDate}T00:00:00` : undefined,
    to: args.toDate ? `${args.toDate}T23:59:59` : undefined,
  };
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <div className="text-sm font-semibold text-rose-700">No se pudo cargar el reporte</div>
      <div className="mt-1 text-sm text-rose-600">{message}</div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
      >
        Reintentar
      </button>
    </div>
  );
}

function SectionLoading({ title }: { title: string }) {
  return (
    <ReportCard title={title} subtitle="Cargando datos...">
      <div className="space-y-3">
        <div className="h-3 rounded bg-gray-200 animate-pulse" />
        <div className="h-3 rounded bg-gray-200 animate-pulse" />
        <div className="h-3 rounded bg-gray-200 animate-pulse" />
      </div>
    </ReportCard>
  );
}

export default function ReportsDashboard() {
  const permissions = usePermissions();

  const canAssets = permissions.has(['assets:read', 'assets:full_access']);
  const canInventory = permissions.has(['inventory:read', 'inventory:full_access']);
  const canAdmin = permissions.has([
    'users:read',
    'users:full_access',
    'rbac:manage_permissions',
    'rbac:manage_roles',
    'announcements:read',
    'announcements:full_access',
  ]);

  const initialRange = getPresetRange('90d');
  const [datePreset, setDatePreset] = useState<'30d' | '90d' | 'ytd' | 'custom'>('90d');
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [locationId, setLocationId] = useState<number | ''>('');

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>('executive');

  const [executiveState, setExecutiveState] =
    useState<SectionState<ExecutiveSummaryReport>>(emptySection());
  const [workState, setWorkState] = useState<SectionState<WorkManagementReport>>(emptySection());
  const [assetsState, setAssetsState] = useState<SectionState<AssetsReport>>(emptySection());
  const [partsState, setPartsState] =
    useState<SectionState<InventoryPartsReport>>(emptySection());
  const [adminState, setAdminState] = useState<SectionState<AdminReportsData>>(emptySection());

  const filters = useMemo(
    () =>
      buildFilters({
        locationId,
        fromDate,
        toDate,
      }),
    [locationId, fromDate, toDate]
  );

  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  const tabs = useMemo(() => {
    const all = [
      { id: 'executive' as const, label: 'Resumen Ejecutivo', visible: true },
      { id: 'work' as const, label: 'Work Management', visible: true },
      { id: 'assets' as const, label: 'Activos', visible: canAssets },
      { id: 'parts' as const, label: 'Inventario Repuestos', visible: canInventory },
      { id: 'admin' as const, label: 'Admin & RBAC', visible: canAdmin },
    ];

    return all.filter((tab) => tab.visible);
  }, [canAssets, canInventory, canAdmin]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? 'executive');
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    void (async () => {
      try {
        setLocationsError(null);
        const data = await listLocationOptions();
        setLocations(data.map((row) => ({ id: row.id, name: row.name, code: row.code })));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error cargando ubicaciones';
        setLocationsError(message);
      }
    })();
  }, []);

  const loadExecutive = useCallback(async () => {
    setExecutiveState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await getExecutiveSummaryReport(filters);
      setExecutiveState({ data, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error cargando resumen ejecutivo';
      setExecutiveState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [filters]);

  const loadWork = useCallback(async () => {
    setWorkState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await getWorkManagementReport(filters);
      setWorkState({ data, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error cargando Work Management';
      setWorkState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [filters]);

  const loadAssets = useCallback(async () => {
    setAssetsState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await getAssetsReport(filters);
      setAssetsState({ data, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error cargando reportes de activos';
      setAssetsState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [filters]);

  const loadParts = useCallback(async () => {
    setPartsState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await getInventoryPartsReport(filters);
      setPartsState({ data, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error cargando reportes de repuestos';
      setPartsState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [filters]);

  const loadAdmin = useCallback(async () => {
    setAdminState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await getAdminReportsData(filters);
      setAdminState({ data, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error cargando reportes admin';
      setAdminState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [filters]);

  const reloadActiveTab = useCallback(async () => {
    if (activeTab === 'executive') {
      await loadExecutive();
      return;
    }
    if (activeTab === 'work') {
      await loadWork();
      return;
    }
    if (activeTab === 'assets') {
      await loadAssets();
      return;
    }
    if (activeTab === 'parts') {
      await loadParts();
      return;
    }
    await loadAdmin();
  }, [activeTab, loadAdmin, loadAssets, loadExecutive, loadParts, loadWork]);

  useEffect(() => {
    void reloadActiveTab();
  }, [activeTab, filterKey, reloadActiveTab]);

  function applyPreset(nextPreset: '30d' | '90d' | 'ytd' | 'custom') {
    setDatePreset(nextPreset);

    if (nextPreset === 'custom') return;

    const range = getPresetRange(nextPreset);
    setFromDate(range.from);
    setToDate(range.to);
  }

  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? '';

  const techColumns: ReportTableColumn<WorkManagementReport['byTechnician'][number]>[] = [
    {
      key: 'technician',
      label: 'Técnico',
      render: (row) => <span className="font-medium">{row.technician}</span>,
    },
    {
      key: 'openCount',
      label: 'WO abiertas',
      align: 'right',
      render: (row) => formatNumber(row.openCount),
    },
    {
      key: 'closedCount',
      label: 'WO cerradas',
      align: 'right',
      render: (row) => formatNumber(row.closedCount),
    },
    {
      key: 'avgResolutionHours',
      label: 'Prom. resolución',
      align: 'right',
      render: (row) => formatHours(row.avgResolutionHours),
    },
  ];

  const assetColumns: ReportTableColumn<AssetsReport['topByTickets'][number]>[] = [
    {
      key: 'asset',
      label: 'Activo',
      render: (row) => (
        <div>
          <div className="font-medium">{row.code}</div>
          <div className="text-xs text-gray-500">{row.name}</div>
        </div>
      ),
    },
    {
      key: 'value',
      label: 'Valor',
      align: 'right',
      render: (row) => formatNumber(row.value),
    },
  ];

  const partsColumns: ReportTableColumn<InventoryPartsReport['topConsumedParts'][number]>[] = [
    {
      key: 'part',
      label: 'Repuesto',
      render: (row) => (
        <div>
          <div className="font-medium">{row.code}</div>
          <div className="text-xs text-gray-500">{row.name}</div>
        </div>
      ),
    },
    {
      key: 'warehouse',
      label: 'Almacén',
      render: (row) => row.warehouse ?? '—',
    },
    {
      key: 'value',
      label: 'Valor',
      align: 'right',
      render: (row) => formatNumber(row.value),
    },
  ];

  const roleMatrixColumns: ReportTableColumn<AdminReportsData['rolePermissionMatrix'][number]>[] = [
    {
      key: 'roleName',
      label: 'Rol',
      render: (row) => row.roleName,
    },
    {
      key: 'users',
      label: 'Usuarios',
      align: 'right',
      render: (row) => formatNumber(row.users),
    },
    {
      key: 'permissions',
      label: 'Permisos',
      align: 'right',
      render: (row) => formatNumber(row.permissions),
    },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border bg-gradient-to-r from-blue-700 via-sky-700 to-teal-700 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-blue-100">CMMS Intelligence</p>
            <h1 className="mt-2 text-2xl md:text-3xl font-bold">Centro de Reportes</h1>
            <p className="mt-2 max-w-3xl text-sm md:text-base text-blue-100/95">
              Panel integral para gerencia y operación: órdenes de trabajo, activos, inventario,
              y control administrativo con filtros globales.
            </p>
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs md:text-sm">
            <div className="text-blue-100">Rango activo</div>
            <div className="mt-1 font-semibold text-white">{PRESET_LABELS[datePreset]}</div>
            <div className="mt-1 text-blue-100">
              {fromDate} {'->'} {toDate}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Preset de fecha
            </label>
            <select
              value={datePreset}
              onChange={(e) =>
                applyPreset(e.target.value as '30d' | '90d' | 'ytd' | 'custom')
              }
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            >
              <option value="30d">Últimos 30 días</option>
              <option value="90d">Últimos 90 días</option>
              <option value="ytd">Año actual (YTD)</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Desde
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setDatePreset('custom');
                setFromDate(e.target.value);
              }}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Hasta
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setDatePreset('custom');
                setToDate(e.target.value);
              }}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Ubicación
            </label>
            <select
              value={locationId}
              onChange={(e) => {
                const value = e.target.value;
                setLocationId(value ? Number(value) : '');
              }}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} - {location.name}
                </option>
              ))}
            </select>
            {locationsError ? (
              <p className="mt-1 text-xs text-amber-700">{locationsError}</p>
            ) : null}
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void reloadActiveTab()}
              className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Refrescar {activeTabLabel}
            </button>
          </div>
        </div>
      </section>

      <ReportTabs
        tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as TabId)}
      />

      {activeTab === 'executive' ? (
        <section className="space-y-4">
          {!executiveState.data && executiveState.loading ? (
            <SectionLoading title="Resumen Ejecutivo" />
          ) : null}

          {executiveState.error && !executiveState.data ? (
            <SectionError
              message={executiveState.error}
              onRetry={() => {
                void loadExecutive();
              }}
            />
          ) : null}

          {executiveState.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <KpiTile label="WO abiertas" value={executiveState.data.kpis.openWorkOrders} tone="warn" />
                <KpiTile
                  label="WO vencidas"
                  value={executiveState.data.kpis.overdueWorkOrders}
                  tone="danger"
                />
                <KpiTile label="Urgentes abiertas" value={executiveState.data.kpis.urgentOpen} tone="danger" />
                <KpiTile
                  label="Activos fuera de servicio"
                  value={executiveState.data.kpis.assetsOutOfService}
                  tone="warn"
                />
                <KpiTile label="Repuestos a reorden" value={executiveState.data.kpis.needsReorder} tone="warn" />
                <KpiTile label="Anuncios activos" value={executiveState.data.kpis.activeAnnouncements} />
                <KpiTile
                  label="Valorización inventario"
                  value={formatCurrency(executiveState.data.kpis.inventoryValuation)}
                  tone="good"
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <ReportCard
                  title="Demanda por ubicación"
                  subtitle="Tickets visibles en el rango"
                >
                  <HorizontalBarList items={executiveState.data.byLocation} maxItems={10} />
                </ReportCard>

                <ReportCard
                  title="Incidentes especiales"
                  subtitle="Impacto por tipo de incidente"
                >
                  <HorizontalBarList
                    items={executiveState.data.bySpecialIncident}
                    maxItems={10}
                    colorClass="bg-emerald-600"
                  />
                </ReportCard>

                <ReportCard
                  title="Top consumo de repuestos"
                  subtitle="Salidas (OUT) en kardex"
                >
                  <HorizontalBarList
                    items={executiveState.data.topConsumedParts}
                    maxItems={10}
                    colorClass="bg-amber-600"
                  />
                </ReportCard>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'work' ? (
        <section className="space-y-4">
          {!workState.data && workState.loading ? <SectionLoading title="Work Management" /> : null}

          {workState.error && !workState.data ? (
            <SectionError
              message={workState.error}
              onRetry={() => {
                void loadWork();
              }}
            />
          ) : null}

          {workState.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <KpiTile label="Backlog solicitudes" value={workState.data.kpis.requestBacklog} tone="warn" />
                <KpiTile label="Backlog WO" value={workState.data.kpis.workOrderBacklog} tone="warn" />
                <KpiTile label="WO urgentes" value={workState.data.kpis.urgentOpen} tone="danger" />
                <KpiTile label="WO vencidas" value={workState.data.kpis.overdueOpen} tone="danger" />
                <KpiTile label="WO sin asignación" value={workState.data.kpis.unassignedOpen} tone="warn" />
                <KpiTile label="Tickets archivados" value={workState.data.kpis.archived} />
                <KpiTile
                  label="Lead time promedio"
                  value={formatHours(workState.data.kpis.avgResolutionHours)}
                />
                <KpiTile
                  label="SLA a tiempo"
                  value={`${workState.data.kpis.slaOnTimeRate}%`}
                  tone={workState.data.kpis.slaOnTimeRate >= 80 ? 'good' : 'warn'}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ReportCard title="Tickets por estado">
                  <HorizontalBarList items={workState.data.byStatus} maxItems={10} />
                </ReportCard>

                <ReportCard title="Tickets por prioridad">
                  <HorizontalBarList items={workState.data.byPriority} maxItems={10} colorClass="bg-orange-500" />
                </ReportCard>

                <ReportCard title="Aging del backlog">
                  <HorizontalBarList items={workState.data.backlogAging} colorClass="bg-rose-500" />
                </ReportCard>

                <ReportCard title="Cumplimiento de deadline">
                  <HorizontalBarList
                    items={workState.data.deadlineCompliance}
                    colorClass="bg-emerald-600"
                  />
                </ReportCard>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ReportCard title="Carga y productividad por técnico">
                  <ReportTable columns={techColumns} rows={workState.data.byTechnician} />
                </ReportCard>

                <div className="space-y-4">
                  <ReportCard title="Demanda por ubicación">
                    <HorizontalBarList items={workState.data.byLocation} maxItems={10} />
                  </ReportCard>
                  <ReportCard title="Incidentes especiales">
                    <HorizontalBarList
                      items={workState.data.bySpecialIncident}
                      maxItems={10}
                      colorClass="bg-violet-600"
                    />
                  </ReportCard>
                </div>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'assets' ? (
        <section className="space-y-4">
          {!assetsState.data && assetsState.loading ? <SectionLoading title="Activos" /> : null}

          {assetsState.error && !assetsState.data ? (
            <SectionError
              message={assetsState.error}
              onRetry={() => {
                void loadAssets();
              }}
            />
          ) : null}

          {assetsState.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                <KpiTile label="Activos totales" value={assetsState.data.kpis.totalAssets} />
                <KpiTile label="Activos activos" value={assetsState.data.kpis.activeAssets} tone="good" />
                <KpiTile
                  label="En mantenimiento"
                  value={assetsState.data.kpis.maintenanceAssets}
                  tone="warn"
                />
                <KpiTile
                  label="Fuera de servicio"
                  value={assetsState.data.kpis.outOfServiceAssets}
                  tone="danger"
                />
                <KpiTile label="Retirados" value={assetsState.data.kpis.retiredAssets} />
                <KpiTile label="Garantía <= 30 días" value={assetsState.data.kpis.warrantyIn30Days} tone="warn" />
                <KpiTile label="Garantía <= 60 días" value={assetsState.data.kpis.warrantyIn60Days} tone="warn" />
                <KpiTile label="Garantía <= 90 días" value={assetsState.data.kpis.warrantyIn90Days} />
                <KpiTile
                  label="Costo total mantenimiento"
                  value={formatCurrency(assetsState.data.kpis.maintenanceCostTotal)}
                  tone="good"
                />
                <KpiTile
                  label="Downtime total"
                  value={formatHours(assetsState.data.kpis.downtimeHoursTotal)}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <ReportCard title="Estado de activos">
                  <HorizontalBarList items={assetsState.data.byStatus} maxItems={10} />
                </ReportCard>

                <ReportCard title="Criticidad de activos">
                  <HorizontalBarList
                    items={assetsState.data.byCriticality}
                    maxItems={10}
                    colorClass="bg-indigo-600"
                  />
                </ReportCard>

                <ReportCard title="Tipo de mantenimiento">
                  <HorizontalBarList
                    items={assetsState.data.byMaintenanceType}
                    maxItems={10}
                    colorClass="bg-emerald-600"
                  />
                </ReportCard>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <ReportCard title="Top activos por tickets">
                  <ReportTable columns={assetColumns} rows={assetsState.data.topByTickets} />
                </ReportCard>

                <ReportCard title="Top activos por costo mantenimiento">
                  <ReportTable
                    columns={assetColumns}
                    rows={assetsState.data.topByCost}
                  />
                </ReportCard>

                <ReportCard title="Top activos por downtime (min)">
                  <ReportTable
                    columns={assetColumns}
                    rows={assetsState.data.topByDowntime}
                  />
                </ReportCard>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'parts' ? (
        <section className="space-y-4">
          {!partsState.data && partsState.loading ? (
            <SectionLoading title="Inventario Repuestos" />
          ) : null}

          {partsState.error && !partsState.data ? (
            <SectionError
              message={partsState.error}
              onRetry={() => {
                void loadParts();
              }}
            />
          ) : null}

          {partsState.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                <KpiTile label="Repuestos" value={partsState.data.kpis.totalParts} />
                <KpiTile label="Críticos" value={partsState.data.kpis.criticalParts} tone="warn" />
                <KpiTile label="On hand" value={partsState.data.kpis.onHandQty} />
                <KpiTile label="Reservado" value={partsState.data.kpis.reservedQty} tone="warn" />
                <KpiTile label="Disponible" value={partsState.data.kpis.availableQty} tone="good" />
                <KpiTile label="Necesitan reorder" value={partsState.data.kpis.needsReorder} tone="danger" />
                <KpiTile label="Docs DRAFT" value={partsState.data.kpis.docsDraft} />
                <KpiTile label="Docs CANCELLED" value={partsState.data.kpis.docsCancelled} tone="warn" />
                <KpiTile
                  label="Valorización inventario"
                  value={formatCurrency(partsState.data.kpis.inventoryValuation)}
                  tone="good"
                />
                <KpiTile
                  label="Costo consumo"
                  value={formatCurrency(partsState.data.kpis.consumptionCost)}
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ReportCard title="Documentos por estado">
                  <HorizontalBarList items={partsState.data.docsByStatus} maxItems={10} />
                </ReportCard>

                <ReportCard title="Documentos por tipo">
                  <HorizontalBarList
                    items={partsState.data.docsByType}
                    maxItems={10}
                    colorClass="bg-emerald-600"
                  />
                </ReportCard>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <ReportCard title="Top consumo de repuestos">
                  <ReportTable columns={partsColumns} rows={partsState.data.topConsumedParts} />
                </ReportCard>

                <ReportCard title="Sugerencias de reorden">
                  <ReportTable columns={partsColumns} rows={partsState.data.topReorderParts} />
                </ReportCard>

                <ReportCard title="Pendiente de entrega por WO">
                  <ReportTable
                    columns={partsColumns}
                    rows={partsState.data.reservationsByTicket}
                  />
                </ReportCard>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'admin' ? (
        <section className="space-y-4">
          {!adminState.data && adminState.loading ? <SectionLoading title="Admin & RBAC" /> : null}

          {adminState.error && !adminState.data ? (
            <SectionError
              message={adminState.error}
              onRetry={() => {
                void loadAdmin();
              }}
            />
          ) : null}

          {adminState.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                <KpiTile label="Roles" value={adminState.data.kpis.roles} />
                <KpiTile label="Permisos" value={adminState.data.kpis.permissions} />
                <KpiTile label="Usuarios activos" value={adminState.data.kpis.usersActive} tone="good" />
                <KpiTile label="Usuarios inactivos" value={adminState.data.kpis.usersInactive} tone="warn" />
                <KpiTile
                  label="Técnicos activos"
                  value={adminState.data.kpis.assigneesActive}
                  tone="good"
                />
                <KpiTile
                  label="Técnicos sin usuario"
                  value={adminState.data.kpis.assigneesWithoutUser}
                  tone="warn"
                />
                <KpiTile
                  label="Anuncios activos"
                  value={adminState.data.kpis.activeAnnouncements}
                />
                <KpiTile
                  label="Anuncios por vencer"
                  value={adminState.data.kpis.expiringAnnouncements}
                  tone="warn"
                />
                <KpiTile label="Ubicaciones activas" value={adminState.data.kpis.activeLocations} />
                <KpiTile label="Sociedades activas" value={adminState.data.kpis.activeSocieties} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ReportCard title="Usuarios por rol">
                  <HorizontalBarList items={adminState.data.usersByRole} maxItems={12} />
                </ReportCard>

                <ReportCard title="Técnicos por sección">
                  <HorizontalBarList
                    items={adminState.data.assigneesBySection}
                    maxItems={12}
                    colorClass="bg-emerald-600"
                  />
                </ReportCard>

                <ReportCard title="Anuncios por nivel">
                  <HorizontalBarList
                    items={adminState.data.announcementsByLevel}
                    maxItems={12}
                    colorClass="bg-violet-600"
                  />
                </ReportCard>

                <ReportCard title="Demanda por ubicación">
                  <HorizontalBarList
                    items={adminState.data.locationDemand}
                    maxItems={12}
                    colorClass="bg-amber-600"
                  />
                </ReportCard>
              </div>

              <ReportCard title="Matriz rol / usuarios / permisos">
                <ReportTable
                  columns={roleMatrixColumns}
                  rows={adminState.data.rolePermissionMatrix}
                />
              </ReportCard>
            </>
          ) : null}
        </section>
      ) : null}

      <footer className="pb-3 text-xs text-gray-500">
        Vista actual: <span className="font-medium text-gray-700">{activeTabLabel}</span>
      </footer>
    </div>
  );
}
