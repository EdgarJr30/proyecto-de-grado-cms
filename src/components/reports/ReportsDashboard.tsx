import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePermissions } from '../../rbac/PermissionsContext';
import {
  getAdminReportsData,
  getAssetsReport,
  getExecutiveSummaryReport,
  getInventoryPartsReport,
  getWorkManagementReport,
} from '../../services/reportService';
import {
  getReportLayoutPreferences,
  saveReportLayoutPreference,
} from '../../services/reportLayoutService';
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
import SortableKpiGrid from '../dashboard/reports/SortableKpiGrid';

type TabId = 'executive' | 'work' | 'assets' | 'parts' | 'admin';
type ReportCardGroupId =
  | 'executiveCards'
  | 'workCards'
  | 'assetsCards'
  | 'partsCards'
  | 'adminCards';

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

type KpiTone = 'default' | 'good' | 'warn' | 'danger';

type KpiConfig = {
  id: string;
  label: string;
  value: number | string;
  tone?: KpiTone;
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

const DEFAULT_KPI_ORDER: Record<TabId, string[]> = {
  executive: [
    'openWorkOrders',
    'overdueWorkOrders',
    'urgentOpen',
    'assetsOutOfService',
    'needsReorder',
    'activeAnnouncements',
    'inventoryValuation',
  ],
  work: [
    'requestBacklog',
    'workOrderBacklog',
    'urgentOpen',
    'overdueOpen',
    'unassignedOpen',
    'archived',
    'avgResolutionHours',
    'slaOnTimeRate',
  ],
  assets: [
    'totalAssets',
    'activeAssets',
    'maintenanceAssets',
    'outOfServiceAssets',
    'retiredAssets',
    'warrantyIn30Days',
    'warrantyIn60Days',
    'warrantyIn90Days',
    'maintenanceCostTotal',
    'downtimeHoursTotal',
  ],
  parts: [
    'totalParts',
    'criticalParts',
    'onHandQty',
    'reservedQty',
    'availableQty',
    'needsReorder',
    'docsDraft',
    'docsCancelled',
    'inventoryValuation',
    'consumptionCost',
  ],
  admin: [
    'roles',
    'permissions',
    'usersActive',
    'usersInactive',
    'assigneesActive',
    'assigneesWithoutUser',
    'activeAnnouncements',
    'expiringAnnouncements',
    'activeLocations',
    'activeSocieties',
  ],
};

const DEFAULT_REPORT_CARD_ORDER: Record<ReportCardGroupId, string[]> = {
  executiveCards: ['byLocation', 'bySpecialIncident', 'topConsumedParts'],
  workCards: [
    'byStatus',
    'byPriority',
    'backlogAging',
    'deadlineCompliance',
    'byTechnician',
    'byLocation',
    'bySpecialIncident',
  ],
  assetsCards: ['byStatus', 'byCriticality', 'byMaintenanceType', 'topByTickets', 'topByCost', 'topByDowntime'],
  partsCards: ['docsByStatus', 'docsByType', 'topConsumedParts', 'topReorderParts', 'reservationsByTicket'],
  adminCards: [
    'usersByRole',
    'assigneesBySection',
    'announcementsByLevel',
    'locationDemand',
    'rolePermissionMatrix',
  ],
};

const REPORT_GROUP_BY_TAB: Record<TabId, ReportCardGroupId> = {
  executive: 'executiveCards',
  work: 'workCards',
  assets: 'assetsCards',
  parts: 'partsCards',
  admin: 'adminCards',
};

const ALL_TABS: TabId[] = ['executive', 'work', 'assets', 'parts', 'admin'];
const ALL_REPORT_GROUPS: ReportCardGroupId[] = [
  'executiveCards',
  'workCards',
  'assetsCards',
  'partsCards',
  'adminCards',
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function createDefaultKpiOrderState(): Record<TabId, string[]> {
  return {
    executive: [...DEFAULT_KPI_ORDER.executive],
    work: [...DEFAULT_KPI_ORDER.work],
    assets: [...DEFAULT_KPI_ORDER.assets],
    parts: [...DEFAULT_KPI_ORDER.parts],
    admin: [...DEFAULT_KPI_ORDER.admin],
  };
}

function createDefaultReportCardOrderState(): Record<ReportCardGroupId, string[]> {
  return {
    executiveCards: [...DEFAULT_REPORT_CARD_ORDER.executiveCards],
    workCards: [...DEFAULT_REPORT_CARD_ORDER.workCards],
    assetsCards: [...DEFAULT_REPORT_CARD_ORDER.assetsCards],
    partsCards: [...DEFAULT_REPORT_CARD_ORDER.partsCards],
    adminCards: [...DEFAULT_REPORT_CARD_ORDER.adminCards],
  };
}

function normalizeOrder(defaultOrder: string[], savedOrder?: string[]): string[] {
  const available = new Set(defaultOrder);
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const id of savedOrder ?? []) {
    if (!available.has(id) || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }

  for (const id of defaultOrder) {
    if (seen.has(id)) continue;
    normalized.push(id);
  }

  return normalized;
}

function sortBySavedOrder<T extends { id: string }>(items: T[], savedOrder: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];

  for (const id of savedOrder) {
    const item = byId.get(id);
    if (!item) continue;
    ordered.push(item);
    byId.delete(id);
  }

  for (const item of byId.values()) {
    ordered.push(item);
  }

  return ordered;
}

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
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/40 dark:bg-rose-500/15">
      <div className="text-sm font-semibold text-rose-700 dark:text-rose-300">
        No se pudo cargar el reporte
      </div>
      <div className="mt-1 text-sm text-rose-600 dark:text-rose-200">{message}</div>
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
        <div className="h-3 rounded bg-gray-200 animate-pulse dark:bg-slate-700" />
        <div className="h-3 rounded bg-gray-200 animate-pulse dark:bg-slate-700" />
        <div className="h-3 rounded bg-gray-200 animate-pulse dark:bg-slate-700" />
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
  const [kpiOrderByTab, setKpiOrderByTab] = useState<Record<TabId, string[]>>(() =>
    createDefaultKpiOrderState()
  );
  const [reportCardOrderByGroup, setReportCardOrderByGroup] = useState<
    Record<ReportCardGroupId, string[]>
  >(() => createDefaultReportCardOrderState());
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [resettingLayout, setResettingLayout] = useState(false);
  const [resettingAllLayouts, setResettingAllLayouts] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

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
      { id: 'work' as const, label: 'Gestión de trabajo', visible: true },
      { id: 'assets' as const, label: 'Activos', visible: canAssets },
      { id: 'parts' as const, label: 'Inventario Repuestos', visible: canInventory },
      { id: 'admin' as const, label: 'Administración y control de acceso', visible: canAdmin },
    ];

    return all.filter((tab) => tab.visible);
  }, [canAssets, canInventory, canAdmin]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? 'executive');
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const saved = await getReportLayoutPreferences();
        if (cancelled) return;

        setKpiOrderByTab({
          executive: normalizeOrder(DEFAULT_KPI_ORDER.executive, saved.executive),
          work: normalizeOrder(DEFAULT_KPI_ORDER.work, saved.work),
          assets: normalizeOrder(DEFAULT_KPI_ORDER.assets, saved.assets),
          parts: normalizeOrder(DEFAULT_KPI_ORDER.parts, saved.parts),
          admin: normalizeOrder(DEFAULT_KPI_ORDER.admin, saved.admin),
        });
        setReportCardOrderByGroup({
          executiveCards: normalizeOrder(
            DEFAULT_REPORT_CARD_ORDER.executiveCards,
            saved.executiveCards ?? saved.executiveHighlights
          ),
          workCards: normalizeOrder(DEFAULT_REPORT_CARD_ORDER.workCards, [
            ...(saved.workCards ?? []),
            ...(saved.workAnalysis ?? []),
            ...(saved.workDetails ?? []),
          ]),
          assetsCards: normalizeOrder(DEFAULT_REPORT_CARD_ORDER.assetsCards, [
            ...(saved.assetsCards ?? []),
            ...(saved.assetsDistributions ?? []),
            ...(saved.assetsTop ?? []),
          ]),
          partsCards: normalizeOrder(DEFAULT_REPORT_CARD_ORDER.partsCards, [
            ...(saved.partsCards ?? []),
            ...(saved.partsDocuments ?? []),
            ...(saved.partsTop ?? []),
          ]),
          adminCards: normalizeOrder(DEFAULT_REPORT_CARD_ORDER.adminCards, [
            ...(saved.adminCards ?? []),
            ...(saved.adminInsights ?? []),
          ]),
        });
        setLayoutError(null);
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : 'No se pudo cargar la disposición personalizada de bloques.';
        setLayoutError(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
      const message = error instanceof Error ? error.message : 'Error cargando Gestión de trabajo';
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

  const persistKpiOrder = useCallback((tabId: TabId, nextOrder: string[]) => {
    const normalized = normalizeOrder(DEFAULT_KPI_ORDER[tabId], nextOrder);

    setKpiOrderByTab((prev) => ({
      ...prev,
      [tabId]: normalized,
    }));
    setLayoutError(null);

    void saveReportLayoutPreference(tabId, normalized).catch((error) => {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la disposición personalizada de bloques.';
      setLayoutError(message);
    });
  }, []);

  const persistReportCardOrder = useCallback((groupId: ReportCardGroupId, nextOrder: string[]) => {
    const normalized = normalizeOrder(DEFAULT_REPORT_CARD_ORDER[groupId], nextOrder);

    setReportCardOrderByGroup((prev) => ({
      ...prev,
      [groupId]: normalized,
    }));
    setLayoutError(null);

    void saveReportLayoutPreference(groupId, normalized).catch((error) => {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la disposición personalizada de bloques.';
      setLayoutError(message);
    });
  }, []);

  const resetActiveTabLayout = useCallback(async () => {
    if (resettingAllLayouts) return;

    const activeReportGroup = REPORT_GROUP_BY_TAB[activeTab];
    const defaultKpiOrder = [...DEFAULT_KPI_ORDER[activeTab]];
    const defaultReportCardOrder = [...DEFAULT_REPORT_CARD_ORDER[activeReportGroup]];

    setKpiOrderByTab((prev) => ({
      ...prev,
      [activeTab]: defaultKpiOrder,
    }));
    setReportCardOrderByGroup((prev) => ({
      ...prev,
      [activeReportGroup]: defaultReportCardOrder,
    }));
    setLayoutError(null);
    setResettingLayout(true);

    try {
      await Promise.all([
        saveReportLayoutPreference(activeTab, defaultKpiOrder),
        saveReportLayoutPreference(activeReportGroup, defaultReportCardOrder),
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo restaurar la disposición por defecto.';
      setLayoutError(message);
    } finally {
      setResettingLayout(false);
    }
  }, [activeTab, resettingAllLayouts]);

  const resetAllLayouts = useCallback(async () => {
    if (resettingLayout || resettingAllLayouts) return;

    const defaultKpis = createDefaultKpiOrderState();
    const defaultReportCards = createDefaultReportCardOrderState();

    setKpiOrderByTab(defaultKpis);
    setReportCardOrderByGroup(defaultReportCards);
    setLayoutError(null);
    setResettingAllLayouts(true);

    try {
      await Promise.all([
        ...ALL_TABS.map((tabId) =>
          saveReportLayoutPreference(tabId, [...DEFAULT_KPI_ORDER[tabId]])
        ),
        ...ALL_REPORT_GROUPS.map((groupId) =>
          saveReportLayoutPreference(groupId, [...DEFAULT_REPORT_CARD_ORDER[groupId]])
        ),
      ]);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo restaurar todas las vistas al orden por defecto.';
      setLayoutError(message);
    } finally {
      setResettingAllLayouts(false);
    }
  }, [resettingAllLayouts, resettingLayout]);

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

  const techColumns = useMemo<ReportTableColumn<WorkManagementReport['byTechnician'][number]>[]>(
    () => [
      {
        key: 'technician',
        label: 'Técnico',
        render: (row) => <span className="font-medium">{row.technician}</span>,
      },
      {
        key: 'openCount',
        label: 'OT abiertas',
        align: 'right',
        render: (row) => formatNumber(row.openCount),
      },
      {
        key: 'closedCount',
        label: 'OT cerradas',
        align: 'right',
        render: (row) => formatNumber(row.closedCount),
      },
      {
        key: 'avgResolutionHours',
        label: 'Prom. resolución',
        align: 'right',
        render: (row) => formatHours(row.avgResolutionHours),
      },
    ],
    []
  );

  const assetColumns = useMemo<ReportTableColumn<AssetsReport['topByTickets'][number]>[]>(
    () => [
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
    ],
    []
  );

  const partsColumns = useMemo<ReportTableColumn<InventoryPartsReport['topConsumedParts'][number]>[]>(
    () => [
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
    ],
    []
  );

  const roleMatrixColumns = useMemo<ReportTableColumn<AdminReportsData['rolePermissionMatrix'][number]>[]>(
    () => [
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
    ],
    []
  );

  const executiveKpis = useMemo<KpiConfig[]>(() => {
    if (!executiveState.data) return [];

    return [
      { id: 'openWorkOrders', label: 'OT abiertas', value: executiveState.data.kpis.openWorkOrders, tone: 'warn' },
      {
        id: 'overdueWorkOrders',
        label: 'OT vencidas',
        value: executiveState.data.kpis.overdueWorkOrders,
        tone: 'danger',
      },
      { id: 'urgentOpen', label: 'Urgentes abiertas', value: executiveState.data.kpis.urgentOpen, tone: 'danger' },
      {
        id: 'assetsOutOfService',
        label: 'Activos fuera de servicio',
        value: executiveState.data.kpis.assetsOutOfService,
        tone: 'warn',
      },
      {
        id: 'needsReorder',
        label: 'Repuestos por reponer',
        value: executiveState.data.kpis.needsReorder,
        tone: 'warn',
      },
      { id: 'activeAnnouncements', label: 'Anuncios activos', value: executiveState.data.kpis.activeAnnouncements },
      {
        id: 'inventoryValuation',
        label: 'Valorización inventario',
        value: formatCurrency(executiveState.data.kpis.inventoryValuation),
        tone: 'good',
      },
    ];
  }, [executiveState.data]);

  const workKpis = useMemo<KpiConfig[]>(() => {
    if (!workState.data) return [];

    return [
      {
        id: 'requestBacklog',
        label: 'Solicitudes pendientes',
        value: workState.data.kpis.requestBacklog,
        tone: 'warn',
      },
      { id: 'workOrderBacklog', label: 'Pendientes OT', value: workState.data.kpis.workOrderBacklog, tone: 'warn' },
      { id: 'urgentOpen', label: 'OT urgentes', value: workState.data.kpis.urgentOpen, tone: 'danger' },
      { id: 'overdueOpen', label: 'OT vencidas', value: workState.data.kpis.overdueOpen, tone: 'danger' },
      { id: 'unassignedOpen', label: 'OT sin asignación', value: workState.data.kpis.unassignedOpen, tone: 'warn' },
      { id: 'archived', label: 'Tickets archivados', value: workState.data.kpis.archived },
      { id: 'avgResolutionHours', label: 'Tiempo de resolución promedio', value: formatHours(workState.data.kpis.avgResolutionHours) },
      {
        id: 'slaOnTimeRate',
        label: 'SLA a tiempo',
        value: `${workState.data.kpis.slaOnTimeRate}%`,
        tone: workState.data.kpis.slaOnTimeRate >= 80 ? 'good' : 'warn',
      },
    ];
  }, [workState.data]);

  const assetsKpis = useMemo<KpiConfig[]>(() => {
    if (!assetsState.data) return [];

    return [
      { id: 'totalAssets', label: 'Activos totales', value: assetsState.data.kpis.totalAssets },
      { id: 'activeAssets', label: 'Activos activos', value: assetsState.data.kpis.activeAssets, tone: 'good' },
      { id: 'maintenanceAssets', label: 'En mantenimiento', value: assetsState.data.kpis.maintenanceAssets, tone: 'warn' },
      {
        id: 'outOfServiceAssets',
        label: 'Fuera de servicio',
        value: assetsState.data.kpis.outOfServiceAssets,
        tone: 'danger',
      },
      { id: 'retiredAssets', label: 'Retirados', value: assetsState.data.kpis.retiredAssets },
      { id: 'warrantyIn30Days', label: 'Garantía <= 30 días', value: assetsState.data.kpis.warrantyIn30Days, tone: 'warn' },
      { id: 'warrantyIn60Days', label: 'Garantía <= 60 días', value: assetsState.data.kpis.warrantyIn60Days, tone: 'warn' },
      { id: 'warrantyIn90Days', label: 'Garantía <= 90 días', value: assetsState.data.kpis.warrantyIn90Days },
      {
        id: 'maintenanceCostTotal',
        label: 'Costo total mantenimiento',
        value: formatCurrency(assetsState.data.kpis.maintenanceCostTotal),
        tone: 'good',
      },
      { id: 'downtimeHoursTotal', label: 'Inactividad total', value: formatHours(assetsState.data.kpis.downtimeHoursTotal) },
    ];
  }, [assetsState.data]);

  const partsKpis = useMemo<KpiConfig[]>(() => {
    if (!partsState.data) return [];

    return [
      { id: 'totalParts', label: 'Repuestos', value: partsState.data.kpis.totalParts },
      { id: 'criticalParts', label: 'Críticos', value: partsState.data.kpis.criticalParts, tone: 'warn' },
      { id: 'onHandQty', label: 'En existencia', value: partsState.data.kpis.onHandQty },
      { id: 'reservedQty', label: 'Reservado', value: partsState.data.kpis.reservedQty, tone: 'warn' },
      { id: 'availableQty', label: 'Disponible', value: partsState.data.kpis.availableQty, tone: 'good' },
      { id: 'needsReorder', label: 'Necesitan reposición', value: partsState.data.kpis.needsReorder, tone: 'danger' },
      { id: 'docsDraft', label: 'Docs borrador', value: partsState.data.kpis.docsDraft },
      { id: 'docsCancelled', label: 'Docs cancelados', value: partsState.data.kpis.docsCancelled, tone: 'warn' },
      {
        id: 'inventoryValuation',
        label: 'Valorización inventario',
        value: formatCurrency(partsState.data.kpis.inventoryValuation),
        tone: 'good',
      },
      { id: 'consumptionCost', label: 'Costo consumo', value: formatCurrency(partsState.data.kpis.consumptionCost) },
    ];
  }, [partsState.data]);

  const adminKpis = useMemo<KpiConfig[]>(() => {
    if (!adminState.data) return [];

    return [
      { id: 'roles', label: 'Roles', value: adminState.data.kpis.roles },
      { id: 'permissions', label: 'Permisos', value: adminState.data.kpis.permissions },
      { id: 'usersActive', label: 'Usuarios activos', value: adminState.data.kpis.usersActive, tone: 'good' },
      { id: 'usersInactive', label: 'Usuarios inactivos', value: adminState.data.kpis.usersInactive, tone: 'warn' },
      { id: 'assigneesActive', label: 'Técnicos activos', value: adminState.data.kpis.assigneesActive, tone: 'good' },
      {
        id: 'assigneesWithoutUser',
        label: 'Técnicos sin usuario',
        value: adminState.data.kpis.assigneesWithoutUser,
        tone: 'warn',
      },
      { id: 'activeAnnouncements', label: 'Anuncios activos', value: adminState.data.kpis.activeAnnouncements },
      {
        id: 'expiringAnnouncements',
        label: 'Anuncios por vencer',
        value: adminState.data.kpis.expiringAnnouncements,
        tone: 'warn',
      },
      { id: 'activeLocations', label: 'Ubicaciones activas', value: adminState.data.kpis.activeLocations },
      { id: 'activeSocieties', label: 'Sociedades activas', value: adminState.data.kpis.activeSocieties },
    ];
  }, [adminState.data]);

  const executiveReportCards = useMemo(() => {
    if (!executiveState.data) return [];

    return [
      {
        id: 'byLocation',
        content: (
          <ReportCard title="Demanda por ubicación" subtitle="Tickets visibles en el rango">
            <HorizontalBarList items={executiveState.data.byLocation} maxItems={10} />
          </ReportCard>
        ),
      },
      {
        id: 'bySpecialIncident',
        content: (
          <ReportCard title="Incidentes especiales" subtitle="Impacto por tipo de incidente">
            <HorizontalBarList
              items={executiveState.data.bySpecialIncident}
              maxItems={10}
              colorClass="bg-emerald-600"
            />
          </ReportCard>
        ),
      },
      {
        id: 'topConsumedParts',
        content: (
          <ReportCard
            title="Mayor consumo de repuestos"
            subtitle="Salidas en movimientos de inventario"
          >
            <HorizontalBarList
              items={executiveState.data.topConsumedParts}
              maxItems={10}
              colorClass="bg-amber-600"
            />
          </ReportCard>
        ),
      },
    ];
  }, [executiveState.data]);

  const workReportCards = useMemo(() => {
    if (!workState.data) return [];

    return [
      {
        id: 'byStatus',
        content: (
          <ReportCard title="Tickets por estado">
            <HorizontalBarList items={workState.data.byStatus} maxItems={10} />
          </ReportCard>
        ),
      },
      {
        id: 'byPriority',
        content: (
          <ReportCard title="Tickets por prioridad">
            <HorizontalBarList items={workState.data.byPriority} maxItems={10} colorClass="bg-orange-500" />
          </ReportCard>
        ),
      },
      {
        id: 'backlogAging',
        content: (
          <ReportCard title="Antigüedad del pendiente">
            <HorizontalBarList items={workState.data.backlogAging} colorClass="bg-rose-500" />
          </ReportCard>
        ),
      },
      {
        id: 'deadlineCompliance',
        content: (
          <ReportCard title="Cumplimiento de plazos">
            <HorizontalBarList
              items={workState.data.deadlineCompliance}
              colorClass="bg-emerald-600"
            />
          </ReportCard>
        ),
      },
      {
        id: 'byTechnician',
        content: (
          <ReportCard title="Carga y productividad por técnico">
            <ReportTable columns={techColumns} rows={workState.data.byTechnician} />
          </ReportCard>
        ),
      },
      {
        id: 'byLocation',
        content: (
          <ReportCard title="Demanda por ubicación">
            <HorizontalBarList items={workState.data.byLocation} maxItems={10} />
          </ReportCard>
        ),
      },
      {
        id: 'bySpecialIncident',
        content: (
          <ReportCard title="Incidentes especiales">
            <HorizontalBarList
              items={workState.data.bySpecialIncident}
              maxItems={10}
              colorClass="bg-violet-600"
            />
          </ReportCard>
        ),
      },
    ];
  }, [techColumns, workState.data]);

  const assetsReportCards = useMemo(() => {
    if (!assetsState.data) return [];

    return [
      {
        id: 'byStatus',
        content: (
          <ReportCard title="Estado de activos">
            <HorizontalBarList items={assetsState.data.byStatus} maxItems={10} />
          </ReportCard>
        ),
      },
      {
        id: 'byCriticality',
        content: (
          <ReportCard title="Criticidad de activos">
            <HorizontalBarList
              items={assetsState.data.byCriticality}
              maxItems={10}
              colorClass="bg-indigo-600"
            />
          </ReportCard>
        ),
      },
      {
        id: 'byMaintenanceType',
        content: (
          <ReportCard title="Tipo de mantenimiento">
            <HorizontalBarList
              items={assetsState.data.byMaintenanceType}
              maxItems={10}
              colorClass="bg-emerald-600"
            />
          </ReportCard>
        ),
      },
      {
        id: 'topByTickets',
        content: (
          <ReportCard title="Activos con más tickets">
            <ReportTable columns={assetColumns} rows={assetsState.data.topByTickets} />
          </ReportCard>
        ),
      },
      {
        id: 'topByCost',
        content: (
          <ReportCard title="Activos con mayor costo de mantenimiento">
            <ReportTable columns={assetColumns} rows={assetsState.data.topByCost} />
          </ReportCard>
        ),
      },
      {
        id: 'topByDowntime',
        content: (
          <ReportCard title="Activos con mayor inactividad (min)">
            <ReportTable columns={assetColumns} rows={assetsState.data.topByDowntime} />
          </ReportCard>
        ),
      },
    ];
  }, [assetColumns, assetsState.data]);

  const partsReportCards = useMemo(() => {
    if (!partsState.data) return [];

    return [
      {
        id: 'docsByStatus',
        content: (
          <ReportCard title="Documentos por estado">
            <HorizontalBarList items={partsState.data.docsByStatus} maxItems={10} />
          </ReportCard>
        ),
      },
      {
        id: 'docsByType',
        content: (
          <ReportCard title="Documentos por tipo">
            <HorizontalBarList
              items={partsState.data.docsByType}
              maxItems={10}
              colorClass="bg-emerald-600"
            />
          </ReportCard>
        ),
      },
      {
        id: 'topConsumedParts',
        content: (
          <ReportCard title="Mayor consumo de repuestos">
            <ReportTable columns={partsColumns} rows={partsState.data.topConsumedParts} />
          </ReportCard>
        ),
      },
      {
        id: 'topReorderParts',
        content: (
          <ReportCard title="Sugerencias de reposición">
            <ReportTable columns={partsColumns} rows={partsState.data.topReorderParts} />
          </ReportCard>
        ),
      },
      {
        id: 'reservationsByTicket',
        content: (
          <ReportCard title="Pendiente de entrega por OT">
            <ReportTable columns={partsColumns} rows={partsState.data.reservationsByTicket} />
          </ReportCard>
        ),
      },
    ];
  }, [partsColumns, partsState.data]);

  const adminReportCards = useMemo(() => {
    if (!adminState.data) return [];

    return [
      {
        id: 'usersByRole',
        content: (
          <ReportCard title="Usuarios por rol">
            <HorizontalBarList items={adminState.data.usersByRole} maxItems={12} />
          </ReportCard>
        ),
      },
      {
        id: 'assigneesBySection',
        content: (
          <ReportCard title="Técnicos por sección">
            <HorizontalBarList
              items={adminState.data.assigneesBySection}
              maxItems={12}
              colorClass="bg-emerald-600"
            />
          </ReportCard>
        ),
      },
      {
        id: 'announcementsByLevel',
        content: (
          <ReportCard title="Anuncios por nivel">
            <HorizontalBarList
              items={adminState.data.announcementsByLevel}
              maxItems={12}
              colorClass="bg-violet-600"
            />
          </ReportCard>
        ),
      },
      {
        id: 'locationDemand',
        content: (
          <ReportCard title="Demanda por ubicación">
            <HorizontalBarList
              items={adminState.data.locationDemand}
              maxItems={12}
              colorClass="bg-amber-600"
            />
          </ReportCard>
        ),
      },
      {
        id: 'rolePermissionMatrix',
        className: 'xl:col-span-2',
        content: (
          <ReportCard title="Matriz rol / usuarios / permisos">
            <ReportTable
              columns={roleMatrixColumns}
              rows={adminState.data.rolePermissionMatrix}
            />
          </ReportCard>
        ),
      },
    ];
  }, [adminState.data, roleMatrixColumns]);

  return (
    <div className="space-y-4 text-slate-900 dark:text-slate-100">
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

      <section className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
              Filtros globales
            </h2>
            <p className="mt-1 text-xs text-gray-500 md:hidden dark:text-slate-400">
              Rango: {fromDate} {'->'} {toDate} · Ubicación:{' '}
              {locationId
                ? (() => {
                    const selected = locations.find((loc) => loc.id === locationId);
                    return selected ? `${selected.code} - ${selected.name}` : 'Seleccionada';
                  })()
                : 'Todas'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen((prev) => !prev)}
            className="md:hidden rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-expanded={mobileFiltersOpen}
            aria-label="Mostrar u ocultar filtros"
          >
            {mobileFiltersOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
          </button>
        </div>

        <div className={cx('mt-4', mobileFiltersOpen ? 'block' : 'hidden', 'md:block')}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Preset de fecha
              </label>
              <select
                value={datePreset}
                onChange={(e) =>
                  applyPreset(e.target.value as '30d' | '90d' | 'ytd' | 'custom')
                }
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="30d">Últimos 30 días</option>
                <option value="90d">Últimos 90 días</option>
                <option value="ytd">Año actual (YTD)</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Desde
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setFromDate(e.target.value);
                }}
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Hasta
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setToDate(e.target.value);
                }}
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Ubicación
              </label>
              <select
                value={locationId}
                onChange={(e) => {
                  const value = e.target.value;
                  setLocationId(value ? Number(value) : '');
                }}
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Todas</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.code} - {location.name}
                  </option>
                ))}
              </select>
              {locationsError ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  {locationsError}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={() => void reloadActiveTab()}
            disabled={resettingLayout || resettingAllLayouts}
            className="w-full sm:w-auto rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refrescar {activeTabLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              void resetActiveTabLayout();
            }}
            disabled={resettingLayout || resettingAllLayouts}
            className="w-full sm:w-auto rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {resettingLayout ? 'Restaurando...' : 'Orden por defecto'}
          </button>
          <button
            type="button"
            onClick={() => {
              void resetAllLayouts();
            }}
            disabled={resettingLayout || resettingAllLayouts}
            className="w-full sm:w-auto rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
          >
            {resettingAllLayouts ? 'Reseteando todo...' : 'Resetear todo'}
          </button>
        </div>
      </section>

      <ReportTabs
        tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
        activeTab={activeTab}
        onChange={(tabId) => setActiveTab(tabId as TabId)}
      />

      <section className="rounded-2xl border border-dashed bg-blue-50/60 px-3 py-2 text-xs text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200">
        Arrastra y suelta los KPI y bloques de reportes para reordenarlos. El orden se guarda automáticamente en tu usuario.
        Puedes usar "Orden por defecto" para la pestaña actual o "Resetear todo" para restaurar todas las vistas.
        {layoutError ? (
          <div className="mt-1 text-amber-700 dark:text-amber-300">
            {layoutError}
          </div>
        ) : null}
      </section>

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
              <SortableKpiGrid
                items={sortBySavedOrder(executiveKpis, kpiOrderByTab.executive).map((kpi) => ({
                  id: kpi.id,
                  content: <KpiTile label={kpi.label} value={kpi.value} tone={kpi.tone} />,
                }))}
                onOrderChange={(nextOrder) => {
                  persistKpiOrder('executive', nextOrder);
                }}
                ariaLabel="Indicadores resumen ejecutivo"
              />

              <SortableKpiGrid
                className="grid grid-cols-1 xl:grid-cols-3 gap-4"
                items={sortBySavedOrder(
                  executiveReportCards,
                  reportCardOrderByGroup.executiveCards
                )}
                onOrderChange={(nextOrder) => {
                  persistReportCardOrder('executiveCards', nextOrder);
                }}
                ariaLabel="Bloques resumen ejecutivo"
              />
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'work' ? (
        <section className="space-y-4">
          {!workState.data && workState.loading ? <SectionLoading title="Gestión de trabajo" /> : null}

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
              <SortableKpiGrid
                items={sortBySavedOrder(workKpis, kpiOrderByTab.work).map((kpi) => ({
                  id: kpi.id,
                  content: <KpiTile label={kpi.label} value={kpi.value} tone={kpi.tone} />,
                }))}
                onOrderChange={(nextOrder) => {
                  persistKpiOrder('work', nextOrder);
                }}
                ariaLabel="Indicadores gestión de trabajo"
              />

              <SortableKpiGrid
                className="grid grid-cols-1 xl:grid-cols-2 gap-4"
                items={sortBySavedOrder(workReportCards, reportCardOrderByGroup.workCards)}
                onOrderChange={(nextOrder) => {
                  persistReportCardOrder('workCards', nextOrder);
                }}
                ariaLabel="Bloques gestión de trabajo"
              />
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
              <SortableKpiGrid
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3"
                items={sortBySavedOrder(assetsKpis, kpiOrderByTab.assets).map((kpi) => ({
                  id: kpi.id,
                  content: <KpiTile label={kpi.label} value={kpi.value} tone={kpi.tone} />,
                }))}
                onOrderChange={(nextOrder) => {
                  persistKpiOrder('assets', nextOrder);
                }}
                ariaLabel="Indicadores activos"
              />

              <SortableKpiGrid
                className="grid grid-cols-1 xl:grid-cols-3 gap-4"
                items={sortBySavedOrder(assetsReportCards, reportCardOrderByGroup.assetsCards)}
                onOrderChange={(nextOrder) => {
                  persistReportCardOrder('assetsCards', nextOrder);
                }}
                ariaLabel="Bloques activos"
              />
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
              <SortableKpiGrid
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3"
                items={sortBySavedOrder(partsKpis, kpiOrderByTab.parts).map((kpi) => ({
                  id: kpi.id,
                  content: <KpiTile label={kpi.label} value={kpi.value} tone={kpi.tone} />,
                }))}
                onOrderChange={(nextOrder) => {
                  persistKpiOrder('parts', nextOrder);
                }}
                ariaLabel="Indicadores inventario repuestos"
              />

              <SortableKpiGrid
                className="grid grid-cols-1 xl:grid-cols-3 gap-4"
                items={sortBySavedOrder(partsReportCards, reportCardOrderByGroup.partsCards)}
                onOrderChange={(nextOrder) => {
                  persistReportCardOrder('partsCards', nextOrder);
                }}
                ariaLabel="Bloques inventario repuestos"
              />
            </>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'admin' ? (
        <section className="space-y-4">
          {!adminState.data && adminState.loading ? <SectionLoading title="Administración y control de acceso" /> : null}

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
              <SortableKpiGrid
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3"
                items={sortBySavedOrder(adminKpis, kpiOrderByTab.admin).map((kpi) => ({
                  id: kpi.id,
                  content: <KpiTile label={kpi.label} value={kpi.value} tone={kpi.tone} />,
                }))}
                onOrderChange={(nextOrder) => {
                  persistKpiOrder('admin', nextOrder);
                }}
                ariaLabel="Indicadores admin y rbac"
              />

              <SortableKpiGrid
                className="grid grid-cols-1 xl:grid-cols-2 gap-4"
                items={sortBySavedOrder(adminReportCards, reportCardOrderByGroup.adminCards)}
                onOrderChange={(nextOrder) => {
                  persistReportCardOrder('adminCards', nextOrder);
                }}
                ariaLabel="Bloques admin y rbac"
              />
            </>
          ) : null}
        </section>
      ) : null}

      <footer className="pb-3 text-xs text-gray-500 dark:text-slate-400">
        Vista actual: <span className="font-medium text-gray-700 dark:text-slate-200">{activeTabLabel}</span>
      </footer>
    </div>
  );
}
