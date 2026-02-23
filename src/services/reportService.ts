import type { PostgrestError } from '@supabase/supabase-js';
import type { ChartData } from 'chart.js';
import { supabase } from '../lib/supabaseClient';
import type {
  AdminReportsData,
  AdminRoleMatrixRow,
  AssetTopRow,
  AssetsReport,
  CountByFieldDTO,
  CountByStatusDTO,
  DashboardReportFilters,
  ExecutiveSummaryReport,
  InventoryPartsReport,
  PartRankingRow,
  ReportBucket,
  ReportFilters,
  SectionMeta,
  TicketStatus,
  WorkManagementReport,
  WorkTechnicianRow,
} from '../types/Report';

export type BarChartData = ChartData<'bar', number[], string>;

const STATUS_ORDER: TicketStatus[] = [
  'Pendiente',
  'En Ejecución',
  'Finalizadas',
];

const TOP_DEFAULT = 8;
const TOP_TABLE = 10;

type RowsResponse<T> = Promise<{
  data: T[] | null;
  error: PostgrestError | null;
}>;

type RangeQuery<T> = {
  gte: (column: string, value: string) => T;
  lte: (column: string, value: string) => T;
};

type EqQuery<T> = {
  eq: (column: string, value: unknown) => T;
};

type TicketReportRow = {
  id: number;
  status: string | null;
  is_accepted: boolean | null;
  is_urgent: boolean | null;
  priority: string | null;
  location_id: number | null;
  assignee: string | null;
  primary_assignee_name?: string | null;
  effective_assignee_id?: number | null;
  requester: string | null;
  created_at: string | null;
  finalized_at: string | null;
  deadline_date: string | null;
  is_archived: boolean | null;
  special_incident_id?: number | null;
  special_incident_name?: string | null;
  created_by_name?: string | null;
};

type AssetRow = {
  id: number;
  code: string;
  name: string;
  status: string | null;
  criticality: number | null;
  is_active: boolean | null;
  warranty_end_date: string | null;
  location_id: number | null;
  location_name: string | null;
};

type TicketAssetRow = {
  ticket_id: number | string;
  asset_id: number | string;
};

type AssetMaintenanceRow = {
  asset_id: number | string;
  maintenance_type: string | null;
  labor_cost: unknown;
  parts_cost: unknown;
  other_cost: unknown;
  downtime_minutes: unknown;
  performed_at: string | null;
};

type PartStockSummaryRow = {
  part_id: string;
  code: string;
  name: string;
  is_active: boolean;
  criticality: string | null;
  total_qty: unknown;
};

type AvailableStockRow = {
  part_id: string;
  part_code: string;
  part_name: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  on_hand_qty: unknown;
  reserved_qty: unknown;
  available_qty: unknown;
};

type ReorderSuggestionRow = {
  part_id: string;
  part_code: string;
  part_name: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  on_hand_qty: unknown;
  suggested_min_replenish: unknown;
  needs_reorder: boolean;
};

type InventoryDocRowLite = {
  id: string;
  doc_type: string;
  status: string;
  cancelled_at: string | null;
  created_at: string | null;
  posted_at: string | null;
  ticket_id: number | string | null;
};

type KardexRowLite = {
  part_code: string;
  part_name: string;
  qty_delta: unknown;
  unit_cost: unknown;
  movement_side: string | null;
  doc_type: string;
  occurred_at: string | null;
  ticket_id: number | string | null;
};

type TicketPartRequestLite = {
  ticket_id: number | string;
  requested_qty: unknown;
  reserved_qty: unknown;
  issued_qty: unknown;
  returned_qty: unknown;
  created_at: string | null;
};

type StockOnHandLite = {
  part_id: string;
  warehouse_id: string;
  qty: unknown;
};

type PartCostLite = {
  part_id: string;
  warehouse_id: string;
  avg_unit_cost: unknown;
};

type RoleLite = {
  id: number;
  name: string;
};

type PermissionLite = {
  id: string;
};

type RolePermissionLite = {
  role_id: number;
  permission_id: string;
};

type UserLite = {
  id: string;
  is_active: boolean | null;
  rol_id: number | null;
  location_id: number | null;
};

type UserRoleLite = {
  user_id: string;
  role_id: number;
};

type AssigneeLite = {
  section: string | null;
  is_active: boolean | null;
  user_id: string | null;
};

type AnnouncementLite = {
  id: number;
  level: string | null;
  is_active: boolean | null;
  starts_at: string | null;
  ends_at: string | null;
};

type LocationLite = {
  id: number;
  name: string;
  is_active: boolean | null;
};

type SocietyLite = {
  id: number;
  is_active: boolean | null;
};

type TicketLocationLite = {
  location_id: number | null;
};

type SpecialIncidentLite = {
  id: number;
  name: string;
};

function nowIso() {
  return new Date().toISOString();
}

function makeMeta(rowCount: number): SectionMeta {
  return {
    generatedAt: nowIso(),
    rowCount,
  };
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function coalesceLabel(value: string | number | null | undefined, fallback: string) {
  if (value === null || value === undefined) return fallback;
  const txt = String(value).trim();
  return txt.length > 0 ? txt : fallback;
}

function resolveRequesterName(
  requester: string | null | undefined,
  createdByName: string | null | undefined
): string | null {
  const byCreator =
    typeof createdByName === 'string' ? createdByName.trim() : '';
  if (byCreator) return byCreator;
  const byRequester = typeof requester === 'string' ? requester.trim() : '';
  return byRequester || null;
}

function isFinalized(status: string | null | undefined) {
  return (status ?? '').trim().toLowerCase() === 'finalizadas';
}

function hoursBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return null;
  const diff = (end.getTime() - start.getTime()) / 36e5;
  return diff >= 0 ? diff : null;
}

function endOfDayFromDateString(dateValue: string | null | undefined): Date | null {
  if (!dateValue) return null;
  const base = new Date(`${dateValue}T23:59:59`);
  if (!Number.isNaN(base.getTime())) return base;
  const fallback = new Date(dateValue);
  if (Number.isNaN(fallback.getTime())) return null;
  fallback.setHours(23, 59, 59, 999);
  return fallback;
}

function daysOpen(from: string | null | undefined, now: Date): number {
  const created = toDate(from);
  if (!created) return 0;
  const diff = now.getTime() - created.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / 86_400_000);
}

function applyDateRange<T extends RangeQuery<T>>(
  query: T,
  filters: DashboardReportFilters,
  dateColumn: string
): T {
  let q = query;
  if (filters.from) q = q.gte(dateColumn, filters.from);
  if (filters.to) q = q.lte(dateColumn, filters.to);
  return q;
}

function applyLocationFilter<T extends EqQuery<T>>(
  query: T,
  filters: DashboardReportFilters,
  column = 'location_id'
): T {
  if (typeof filters.locationId !== 'number') return query;
  return query.eq(column, filters.locationId);
}

function toBuckets(map: Map<string, number>, limit = TOP_DEFAULT): ReportBucket[] {
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function addMapCount(map: Map<string, number>, key: string, increment = 1) {
  map.set(key, (map.get(key) ?? 0) + increment);
}

function mapToOrderedStatusBuckets(statusMap: Map<string, number>): ReportBucket[] {
  const known = STATUS_ORDER.map((status) => ({
    label: status,
    value: statusMap.get(status) ?? 0,
  }));

  const unknown = Array.from(statusMap.entries())
    .filter(([status]) => !STATUS_ORDER.includes(status as TicketStatus))
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return [...known, ...unknown];
}

function parseLocationId(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeFilters(
  filters?: ReportFilters | DashboardReportFilters
): DashboardReportFilters {
  if (!filters) return {};

  const from = filters.from;
  const to = filters.to;

  let locationId: number | undefined;

  if ('locationId' in filters && typeof filters.locationId === 'number') {
    locationId = filters.locationId;
  }

  if (!locationId && 'location_id' in filters) {
    locationId = parseLocationId(filters.location_id);
  }

  return {
    from,
    to,
    locationId,
  };
}

async function fetchLocationMap(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from('locations')
    .select('id,name')
    .in('id', ids);

  if (error) return map;

  for (const row of (data ?? []) as Array<{ id: number; name: string }>) {
    map.set(row.id, row.name);
  }

  return map;
}

async function fetchSpecialIncidentMap(ids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from('special_incidents')
    .select('id,name')
    .in('id', ids);

  if (error) return map;

  for (const row of (data ?? []) as SpecialIncidentLite[]) {
    map.set(row.id, row.name);
  }

  return map;
}

async function listTicketRows(
  filters: DashboardReportFilters
): Promise<TicketReportRow[]> {
  let viewQuery = supabase.from('v_tickets_compat').select(
    `
      id,
      status,
      is_accepted,
      is_urgent,
      priority,
      location_id,
      assignee,
      primary_assignee_name,
      effective_assignee_id,
      requester,
      created_by_name,
      created_at,
      finalized_at,
      deadline_date,
      is_archived,
      special_incident_id,
      special_incident_name
    `
  );

  viewQuery = applyLocationFilter(viewQuery, filters);
  viewQuery = applyDateRange(viewQuery, filters, 'created_at');

  const { data: fromView, error: viewError } = await viewQuery;

  if (!viewError) {
    return ((fromView ?? []) as TicketReportRow[]).map((row) => ({
      ...row,
      requester: resolveRequesterName(row.requester, row.created_by_name),
    }));
  }

  let tableQuery = supabase.from('tickets').select(
    `
      id,
      status,
      is_accepted,
      is_urgent,
      priority,
      location_id,
      assignee,
      assignee_id,
      requester,
      created_at,
      finalized_at,
      deadline_date,
      is_archived,
      special_incident_id
    `
  );

  tableQuery = applyLocationFilter(tableQuery, filters);
  tableQuery = applyDateRange(tableQuery, filters, 'created_at');

  const { data, error } = await tableQuery;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    id: number;
    status: string | null;
    is_accepted: boolean | null;
    is_urgent: boolean | null;
    priority: string | null;
    location_id: number | null;
    assignee: string | null;
    assignee_id: number | null;
    requester: string | null;
    created_at: string | null;
    finalized_at: string | null;
    deadline_date: string | null;
    is_archived: boolean | null;
    special_incident_id: number | null;
  }>;

  return rows.map((row) => ({
    ...row,
    requester: resolveRequesterName(row.requester, null),
    primary_assignee_name: row.assignee,
    effective_assignee_id: row.assignee_id,
    special_incident_name: null,
  }));
}

async function listInventoryValuationParts(): Promise<{
  totalValuation: number;
}> {
  const [stockRes, costRes] = await Promise.all([
    supabase.from('stock_on_hand').select('part_id,warehouse_id,qty').limit(10000),
    supabase
      .from('part_costs')
      .select('part_id,warehouse_id,avg_unit_cost')
      .limit(10000),
  ]);

  if (stockRes.error) throw new Error(stockRes.error.message);
  if (costRes.error) throw new Error(costRes.error.message);

  const stock = (stockRes.data ?? []) as StockOnHandLite[];
  const costs = (costRes.data ?? []) as PartCostLite[];

  const costMap = new Map<string, number>();
  for (const row of costs) {
    costMap.set(`${row.part_id}|${row.warehouse_id}`, toNumber(row.avg_unit_cost));
  }

  let totalValuation = 0;
  for (const row of stock) {
    const qty = toNumber(row.qty);
    if (qty <= 0) continue;
    const avg = costMap.get(`${row.part_id}|${row.warehouse_id}`) ?? 0;
    totalValuation += qty * avg;
  }

  return { totalValuation: round(totalValuation) };
}

/* =========================================================================
 * Compatibilidad: funciones existentes usadas por componentes antiguos
 * ========================================================================= */

function buildBaseSelect(columns: string) {
  const cols = `is_accepted, ${columns}`;
  return supabase.from('tickets').select(cols);
}

function applyLegacyFilters<T>(
  query: ReturnType<typeof buildBaseSelect>,
  filters?: ReportFilters
): RowsResponse<T> {
  let q = query.eq('is_accepted', true);

  if (filters?.location_id) q = q.eq('location_id', filters.location_id);
  if (filters?.assignee) q = q.eq('assignee', filters.assignee);
  if (filters?.requester) q = q.eq('requester', filters.requester);
  if (filters?.status) q = q.eq('status', filters.status);

  if (filters?.from) q = q.gte('created_at', filters.from);
  if (filters?.to) q = q.lte('created_at', filters.to);

  return q as unknown as RowsResponse<T>;
}

export async function getCountByStatus(
  filters?: ReportFilters
): Promise<CountByStatusDTO[]> {
  const { data, error } = await applyLegacyFilters<TicketReportRow>(
    buildBaseSelect('status, created_at'),
    filters
  );
  if (error) throw new Error(error.message);

  const counts = new Map<TicketStatus, number>(STATUS_ORDER.map((s) => [s, 0]));

  for (const row of data ?? []) {
    const normalized = (row.status ?? '').trim();
    if (
      normalized === 'Pendiente' ||
      normalized === 'En Ejecución' ||
      normalized === 'Finalizadas'
    ) {
      const asStatus = normalized as TicketStatus;
      counts.set(asStatus, (counts.get(asStatus) ?? 0) + 1);
    }
  }

  return STATUS_ORDER.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

export async function getCountByField(
  field: 'location_id' | 'assignee' | 'requester',
  filters?: ReportFilters
): Promise<CountByFieldDTO[]> {
  const { data, error } = await applyLegacyFilters<Pick<TicketReportRow, typeof field>>(
    buildBaseSelect(`${field}, created_at`),
    filters
  );

  if (error) throw new Error(error.message);

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const key = coalesceLabel(row[field], '(Sin valor)');
    addMapCount(map, key);
  }

  return toBuckets(map, 100).map((item) => ({
    key: item.label,
    count: item.value,
  }));
}

export function toBarChartFromStatus(
  dto: CountByStatusDTO[],
  datasetLabel = 'Tickets aceptados'
): BarChartData {
  return {
    labels: dto.map((d) => d.status),
    datasets: [
      {
        label: datasetLabel,
        data: dto.map((d) => d.count),
        backgroundColor: ['#1d4ed8', '#f59e0b', '#10b981'],
        borderColor: ['#1d4ed8', '#f59e0b', '#10b981'],
        borderWidth: 1,
      },
    ],
  };
}

export function toBarChartFromField(
  dto: CountByFieldDTO[],
  datasetLabel = 'Tickets aceptados'
): BarChartData {
  return {
    labels: dto.map((d) => d.key),
    datasets: [
      {
        label: datasetLabel,
        data: dto.map((d) => d.count),
        backgroundColor: '#1d4ed8',
        borderColor: '#1d4ed8',
        borderWidth: 1,
      },
    ],
  };
}

/* =========================================================================
 * Reportes nuevos
 * ========================================================================= */

export async function getExecutiveSummaryReport(
  rawFilters?: DashboardReportFilters | ReportFilters
): Promise<ExecutiveSummaryReport> {
  const filters = normalizeFilters(rawFilters);

  const [
    tickets,
    assetsRes,
    reorderRes,
    announcementsRes,
    valuation,
    kardexRes,
  ] = await Promise.all([
    listTicketRows(filters),
    supabase
      .from('v_assets')
      .select('status')
      .limit(10000),
    supabase
      .from('v_reorder_suggestions')
      .select('needs_reorder')
      .limit(10000),
    supabase
      .from('announcements')
      .select('is_active,starts_at,ends_at')
      .limit(1000),
    listInventoryValuationParts(),
    applyDateRange(
      supabase
        .from('v_inventory_kardex')
        .select('part_code,part_name,qty_delta,movement_side,occurred_at')
        .limit(5000),
      filters,
      'occurred_at'
    ),
  ]);

  if (assetsRes.error) throw new Error(assetsRes.error.message);
  if (reorderRes.error) throw new Error(reorderRes.error.message);
  if (announcementsRes.error) throw new Error(announcementsRes.error.message);
  if (kardexRes.error) throw new Error(kardexRes.error.message);

  const assets = (assetsRes.data ?? []) as Array<{ status: string | null }>;
  const reorders = (reorderRes.data ?? []) as Array<{ needs_reorder: boolean }>;
  const announcements = (announcementsRes.data ?? []) as Array<{
    is_active: boolean | null;
    starts_at: string | null;
    ends_at: string | null;
  }>;
  const kardex = (kardexRes.data ?? []) as Array<{
    part_code: string;
    part_name: string;
    qty_delta: unknown;
    movement_side: string | null;
    occurred_at: string | null;
  }>;

  const now = new Date();

  const openWorkOrders = tickets.filter(
    (t) => asBool(t.is_accepted) && !asBool(t.is_archived) && !isFinalized(t.status)
  ).length;

  const overdueWorkOrders = tickets.filter((t) => {
    if (!asBool(t.is_accepted) || asBool(t.is_archived) || isFinalized(t.status)) {
      return false;
    }

    const deadline = endOfDayFromDateString(t.deadline_date);
    return Boolean(deadline && deadline.getTime() < now.getTime());
  }).length;

  const urgentOpen = tickets.filter(
    (t) =>
      asBool(t.is_accepted) &&
      !asBool(t.is_archived) &&
      !isFinalized(t.status) &&
      asBool(t.is_urgent)
  ).length;

  const assetsOutOfService = assets.filter(
    (a) => (a.status ?? '').toUpperCase() === 'FUERA_DE_SERVICIO'
  ).length;

  const needsReorder = reorders.filter((r) => r.needs_reorder).length;

  const activeAnnouncements = announcements.filter((a) => {
    if (!asBool(a.is_active)) return false;
    const starts = toDate(a.starts_at);
    const ends = toDate(a.ends_at);
    if (starts && starts.getTime() > now.getTime()) return false;
    if (ends && ends.getTime() < now.getTime()) return false;
    return true;
  }).length;

  const locationIds = Array.from(
    new Set(
      tickets
        .map((t) => t.location_id)
        .filter((id): id is number => typeof id === 'number')
    )
  );
  const locationMap = await fetchLocationMap(locationIds);

  const byLocationMap = new Map<string, number>();
  const byIncidentMap = new Map<string, number>();

  for (const row of tickets) {
    if (asBool(row.is_archived)) continue;

    const locLabel =
      typeof row.location_id === 'number'
        ? locationMap.get(row.location_id) ?? 'Sin ubicación'
        : 'Sin ubicación';

    addMapCount(byLocationMap, locLabel);

    const incidentLabel = coalesceLabel(row.special_incident_name, 'Sin incidente');
    addMapCount(byIncidentMap, incidentLabel);
  }

  const consumedMap = new Map<string, number>();
  for (const row of kardex) {
    const qty = toNumber(row.qty_delta);
    const isOut = row.movement_side === 'OUT' || qty < 0;
    if (!isOut) continue;

    const key = `${coalesceLabel(row.part_code, 'N/D')} — ${coalesceLabel(row.part_name, 'Sin nombre')}`;
    addMapCount(consumedMap, key, Math.abs(qty));
  }

  return {
    meta: makeMeta(tickets.length),
    kpis: {
      openWorkOrders,
      overdueWorkOrders,
      urgentOpen,
      assetsOutOfService,
      needsReorder,
      activeAnnouncements,
      inventoryValuation: valuation.totalValuation,
    },
    byLocation: toBuckets(byLocationMap),
    bySpecialIncident: toBuckets(byIncidentMap),
    topConsumedParts: toBuckets(consumedMap),
  };
}

export async function getWorkManagementReport(
  rawFilters?: DashboardReportFilters | ReportFilters
): Promise<WorkManagementReport> {
  const filters = normalizeFilters(rawFilters);
  const rows = await listTicketRows(filters);

  const locationIds = Array.from(
    new Set(
      rows
        .map((row) => row.location_id)
        .filter((id): id is number => typeof id === 'number')
    )
  );

  const incidentIds = Array.from(
    new Set(
      rows
        .map((row) => row.special_incident_id)
        .filter((id): id is number => typeof id === 'number')
    )
  );

  const [locationMap, incidentMap] = await Promise.all([
    fetchLocationMap(locationIds),
    fetchSpecialIncidentMap(incidentIds),
  ]);

  const now = new Date();

  const byStatusMap = new Map<string, number>();
  const byPriorityMap = new Map<string, number>();
  const byLocationMap = new Map<string, number>();
  const byIncidentMap = new Map<string, number>();

  const agingMap = new Map<string, number>([
    ['0-2 días', 0],
    ['3-7 días', 0],
    ['8-15 días', 0],
    ['16-30 días', 0],
    ['30+ días', 0],
  ]);

  const deadlineBuckets = new Map<string, number>([
    ['A tiempo', 0],
    ['Tarde', 0],
    ['Abierta vencida', 0],
    ['Sin deadline', 0],
    ['Abierta dentro de plazo', 0],
  ]);

  const technicianMap = new Map<
    string,
    { openCount: number; closedCount: number; resolvedHours: number; resolvedRows: number }
  >();

  let requestBacklog = 0;
  let workOrderBacklog = 0;
  let urgentOpen = 0;
  let overdueOpen = 0;
  let unassignedOpen = 0;
  let archived = 0;

  let closedResolutionHours = 0;
  let closedResolutionRows = 0;

  for (const row of rows) {
    const accepted = asBool(row.is_accepted);
    const isArchived = asBool(row.is_archived);
    const finalized = isFinalized(row.status);

    if (isArchived) {
      archived += 1;
      continue;
    }

    if (!accepted) {
      if (!finalized) requestBacklog += 1;
    } else {
      const statusLabel = coalesceLabel(row.status, 'Sin estado');
      addMapCount(byStatusMap, statusLabel);

      const priorityLabel = coalesceLabel(row.priority, 'Sin prioridad');
      addMapCount(byPriorityMap, priorityLabel);

      if (!finalized) {
        workOrderBacklog += 1;

        if (asBool(row.is_urgent)) urgentOpen += 1;
        if (typeof row.effective_assignee_id !== 'number') unassignedOpen += 1;

        const ageDays = daysOpen(row.created_at, now);
        if (ageDays <= 2) addMapCount(agingMap, '0-2 días');
        else if (ageDays <= 7) addMapCount(agingMap, '3-7 días');
        else if (ageDays <= 15) addMapCount(agingMap, '8-15 días');
        else if (ageDays <= 30) addMapCount(agingMap, '16-30 días');
        else addMapCount(agingMap, '30+ días');
      }

      const techKey = coalesceLabel(
        row.primary_assignee_name ?? row.assignee,
        'Sin asignar'
      );
      const tech = technicianMap.get(techKey) ?? {
        openCount: 0,
        closedCount: 0,
        resolvedHours: 0,
        resolvedRows: 0,
      };

      if (finalized) {
        tech.closedCount += 1;
        const hours = hoursBetween(row.created_at, row.finalized_at);
        if (hours !== null) {
          tech.resolvedHours += hours;
          tech.resolvedRows += 1;
          closedResolutionHours += hours;
          closedResolutionRows += 1;
        }
      } else {
        tech.openCount += 1;
      }

      technicianMap.set(techKey, tech);
    }

    const locationLabel =
      typeof row.location_id === 'number'
        ? locationMap.get(row.location_id) ?? 'Sin ubicación'
        : 'Sin ubicación';
    addMapCount(byLocationMap, locationLabel);

    const incidentLabel = row.special_incident_name
      ? row.special_incident_name
      : typeof row.special_incident_id === 'number'
        ? (incidentMap.get(row.special_incident_id) ?? `Incidente #${row.special_incident_id}`)
        : 'Sin incidente';
    addMapCount(byIncidentMap, incidentLabel);

    const deadline = endOfDayFromDateString(row.deadline_date);

    if (!deadline) {
      addMapCount(deadlineBuckets, 'Sin deadline');
    } else {
      if (finalized && row.finalized_at) {
        const finalizedAt = toDate(row.finalized_at);
        if (finalizedAt && finalizedAt.getTime() <= deadline.getTime()) {
          addMapCount(deadlineBuckets, 'A tiempo');
        } else {
          addMapCount(deadlineBuckets, 'Tarde');
        }
      } else if (!finalized && deadline.getTime() < now.getTime()) {
        addMapCount(deadlineBuckets, 'Abierta vencida');
        if (accepted) overdueOpen += 1;
      } else {
        addMapCount(deadlineBuckets, 'Abierta dentro de plazo');
      }
    }
  }

  const avgResolutionHours =
    closedResolutionRows > 0
      ? round(closedResolutionHours / closedResolutionRows, 1)
      : 0;

  const onTime = deadlineBuckets.get('A tiempo') ?? 0;
  const late = deadlineBuckets.get('Tarde') ?? 0;
  const slaOnTimeRate = onTime + late > 0 ? round((onTime / (onTime + late)) * 100, 1) : 0;

  const byTechnician: WorkTechnicianRow[] = Array.from(technicianMap.entries())
    .map(([technician, info]) => ({
      technician,
      openCount: info.openCount,
      closedCount: info.closedCount,
      avgResolutionHours:
        info.resolvedRows > 0 ? round(info.resolvedHours / info.resolvedRows, 1) : 0,
    }))
    .sort((a, b) => {
      if (b.openCount !== a.openCount) return b.openCount - a.openCount;
      return b.closedCount - a.closedCount;
    })
    .slice(0, TOP_TABLE);

  const orderedPriority = ['Crítica', 'Alta', 'Media', 'Baja', 'Sin prioridad'];
  const byPriority: ReportBucket[] = orderedPriority.map((label) => ({
    label,
    value: byPriorityMap.get(label) ?? 0,
  }));

  const extraPriorities = Array.from(byPriorityMap.entries())
    .filter(([label]) => !orderedPriority.includes(label))
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return {
    meta: makeMeta(rows.length),
    totalTickets: rows.filter((row) => !asBool(row.is_archived)).length,
    kpis: {
      requestBacklog,
      workOrderBacklog,
      urgentOpen,
      overdueOpen,
      unassignedOpen,
      archived,
      avgResolutionHours,
      slaOnTimeRate,
    },
    byStatus: mapToOrderedStatusBuckets(byStatusMap),
    byPriority: [...byPriority, ...extraPriorities],
    backlogAging: Array.from(agingMap.entries()).map(([label, value]) => ({ label, value })),
    deadlineCompliance: Array.from(deadlineBuckets.entries()).map(([label, value]) => ({
      label,
      value,
    })),
    byTechnician,
    byLocation: toBuckets(byLocationMap, TOP_TABLE),
    bySpecialIncident: toBuckets(byIncidentMap, TOP_TABLE),
  };
}

function mapAssetRankings(
  map: Map<number, number>,
  assetsById: Map<number, AssetRow>
): AssetTopRow[] {
  return Array.from(map.entries())
    .map(([assetId, value]) => {
      const asset = assetsById.get(assetId);
      return {
        assetId,
        code: asset?.code ?? `A-${assetId}`,
        name: asset?.name ?? 'Activo sin nombre',
        value: round(value),
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_TABLE);
}

export async function getAssetsReport(
  rawFilters?: DashboardReportFilters | ReportFilters
): Promise<AssetsReport> {
  const filters = normalizeFilters(rawFilters);

  let assetsQuery = supabase.from('v_assets').select(
    'id,code,name,status,criticality,is_active,warranty_end_date,location_id,location_name'
  );

  assetsQuery = applyLocationFilter(assetsQuery, filters);

  const { data: assetsData, error: assetsError } = await assetsQuery.limit(10000);
  if (assetsError) throw new Error(assetsError.message);

  const assets = (assetsData ?? []) as AssetRow[];
  const assetIds = assets.map((asset) => asset.id);

  let ticketAssets: TicketAssetRow[] = [];
  let maintenanceRows: AssetMaintenanceRow[] = [];

  if (assetIds.length > 0) {
    const ticketAssetQuery = supabase
      .from('ticket_assets')
      .select('ticket_id,asset_id')
      .in('asset_id', assetIds)
      .limit(10000);

    const maintenanceQuery = applyDateRange(
      supabase
        .from('asset_maintenance_log')
        .select(
          'asset_id,maintenance_type,labor_cost,parts_cost,other_cost,downtime_minutes,performed_at'
        )
        .in('asset_id', assetIds)
        .limit(10000),
      filters,
      'performed_at'
    );

    const [ticketAssetRes, maintenanceRes] = await Promise.all([
      ticketAssetQuery,
      maintenanceQuery,
    ]);

    if (ticketAssetRes.error) throw new Error(ticketAssetRes.error.message);
    if (maintenanceRes.error) throw new Error(maintenanceRes.error.message);

    ticketAssets = (ticketAssetRes.data ?? []) as TicketAssetRow[];
    maintenanceRows = (maintenanceRes.data ?? []) as AssetMaintenanceRow[];
  }

  const now = new Date();

  const byStatusMap = new Map<string, number>();
  const byCriticalityMap = new Map<string, number>([
    ['1 - Muy baja', 0],
    ['2 - Baja', 0],
    ['3 - Media', 0],
    ['4 - Alta', 0],
    ['5 - Crítica', 0],
  ]);

  let activeAssets = 0;
  let maintenanceAssets = 0;
  let outOfServiceAssets = 0;
  let retiredAssets = 0;
  let warrantyIn30Days = 0;
  let warrantyIn60Days = 0;
  let warrantyIn90Days = 0;

  for (const asset of assets) {
    const status = coalesceLabel(asset.status, 'SIN ESTADO').toUpperCase();
    addMapCount(byStatusMap, status);

    if (asBool(asset.is_active)) activeAssets += 1;
    if (status === 'EN_MANTENIMIENTO') maintenanceAssets += 1;
    if (status === 'FUERA_DE_SERVICIO') outOfServiceAssets += 1;
    if (status === 'RETIRADO') retiredAssets += 1;

    const criticality = Math.max(1, Math.min(5, Math.floor(toNumber(asset.criticality))));
    const criticalityLabel =
      criticality === 1
        ? '1 - Muy baja'
        : criticality === 2
          ? '2 - Baja'
          : criticality === 3
            ? '3 - Media'
            : criticality === 4
              ? '4 - Alta'
              : '5 - Crítica';

    addMapCount(byCriticalityMap, criticalityLabel);

    const warranty = toDate(asset.warranty_end_date);
    if (!warranty) continue;

    const days = Math.ceil((warranty.getTime() - now.getTime()) / 86_400_000);
    if (days < 0) continue;
    if (days <= 30) warrantyIn30Days += 1;
    if (days <= 60) warrantyIn60Days += 1;
    if (days <= 90) warrantyIn90Days += 1;
  }

  const ticketCountByAsset = new Map<number, number>();
  for (const row of ticketAssets) {
    const assetId = Number(row.asset_id);
    if (!Number.isFinite(assetId)) continue;
    ticketCountByAsset.set(assetId, (ticketCountByAsset.get(assetId) ?? 0) + 1);
  }

  const costByAsset = new Map<number, number>();
  const downtimeByAsset = new Map<number, number>();
  const maintenanceTypeMap = new Map<string, number>();

  let maintenanceCostTotal = 0;
  let downtimeMinutesTotal = 0;

  for (const row of maintenanceRows) {
    const assetId = Number(row.asset_id);
    if (!Number.isFinite(assetId)) continue;

    const totalCost =
      toNumber(row.labor_cost) + toNumber(row.parts_cost) + toNumber(row.other_cost);

    const downtime = toNumber(row.downtime_minutes);

    costByAsset.set(assetId, (costByAsset.get(assetId) ?? 0) + totalCost);
    downtimeByAsset.set(assetId, (downtimeByAsset.get(assetId) ?? 0) + downtime);

    maintenanceCostTotal += totalCost;
    downtimeMinutesTotal += downtime;

    const typeLabel = coalesceLabel(row.maintenance_type, 'NO CLASIFICADO').toUpperCase();
    addMapCount(maintenanceTypeMap, typeLabel);
  }

  const assetsById = new Map<number, AssetRow>();
  for (const asset of assets) {
    assetsById.set(asset.id, asset);
  }

  return {
    meta: makeMeta(assets.length),
    kpis: {
      totalAssets: assets.length,
      activeAssets,
      maintenanceAssets,
      outOfServiceAssets,
      retiredAssets,
      warrantyIn30Days,
      warrantyIn60Days,
      warrantyIn90Days,
      maintenanceCostTotal: round(maintenanceCostTotal),
      downtimeHoursTotal: round(downtimeMinutesTotal / 60, 1),
    },
    byStatus: toBuckets(byStatusMap, 20),
    byCriticality: Array.from(byCriticalityMap.entries()).map(([label, value]) => ({
      label,
      value,
    })),
    byMaintenanceType: toBuckets(maintenanceTypeMap, 20),
    topByTickets: mapAssetRankings(ticketCountByAsset, assetsById),
    topByCost: mapAssetRankings(costByAsset, assetsById),
    topByDowntime: mapAssetRankings(downtimeByAsset, assetsById),
  };
}

export async function getInventoryPartsReport(
  rawFilters?: DashboardReportFilters | ReportFilters
): Promise<InventoryPartsReport> {
  const filters = normalizeFilters(rawFilters);

  const docsQuery = applyDateRange(
    supabase
      .from('inventory_docs')
      .select('id,doc_type,status,cancelled_at,created_at,posted_at,ticket_id')
      .limit(5000),
    filters,
    'created_at'
  );

  const kardexQuery = applyDateRange(
    supabase
      .from('v_inventory_kardex')
      .select(
        'part_code,part_name,qty_delta,unit_cost,movement_side,doc_type,occurred_at,ticket_id'
      )
      .limit(5000),
    filters,
    'occurred_at'
  );

  const requestQuery = applyDateRange(
    supabase
      .from('ticket_part_requests')
      .select('ticket_id,requested_qty,reserved_qty,issued_qty,returned_qty,created_at')
      .limit(5000),
    filters,
    'created_at'
  );

  const [
    summaryRes,
    availableRes,
    reorderRes,
    docsRes,
    kardexRes,
    requestsRes,
    valuation,
  ] = await Promise.all([
    supabase
      .from('v_part_stock_summary')
      .select('part_id,code,name,is_active,criticality,total_qty')
      .limit(10000),
    supabase
      .from('v_available_stock')
      .select(
        'part_id,part_code,part_name,warehouse_id,warehouse_code,warehouse_name,on_hand_qty,reserved_qty,available_qty'
      )
      .limit(10000),
    supabase
      .from('v_reorder_suggestions')
      .select(
        'part_id,part_code,part_name,warehouse_id,warehouse_code,warehouse_name,on_hand_qty,suggested_min_replenish,needs_reorder'
      )
      .limit(10000),
    docsQuery,
    kardexQuery,
    requestQuery,
    listInventoryValuationParts(),
  ]);

  if (summaryRes.error) throw new Error(summaryRes.error.message);
  if (availableRes.error) throw new Error(availableRes.error.message);
  if (reorderRes.error) throw new Error(reorderRes.error.message);
  if (docsRes.error) throw new Error(docsRes.error.message);
  if (kardexRes.error) throw new Error(kardexRes.error.message);
  if (requestsRes.error) throw new Error(requestsRes.error.message);

  const summaryRows = (summaryRes.data ?? []) as PartStockSummaryRow[];
  const availableRows = (availableRes.data ?? []) as AvailableStockRow[];
  const reorderRows = (reorderRes.data ?? []) as ReorderSuggestionRow[];
  const docsRows = (docsRes.data ?? []) as InventoryDocRowLite[];
  const kardexRows = (kardexRes.data ?? []) as KardexRowLite[];
  const requestRows = (requestsRes.data ?? []) as TicketPartRequestLite[];

  const docsByStatusMap = new Map<string, number>();
  const docsByTypeMap = new Map<string, number>();

  for (const doc of docsRows) {
    addMapCount(docsByStatusMap, coalesceLabel(doc.status, 'SIN ESTADO').toUpperCase());
    addMapCount(docsByTypeMap, coalesceLabel(doc.doc_type, 'SIN TIPO').toUpperCase());
  }

  let onHandQty = 0;
  let reservedQty = 0;
  let availableQty = 0;

  for (const row of availableRows) {
    onHandQty += toNumber(row.on_hand_qty);
    reservedQty += toNumber(row.reserved_qty);
    availableQty += toNumber(row.available_qty);
  }

  const criticalParts = summaryRows.filter((row) => {
    const c = coalesceLabel(row.criticality, '').toUpperCase();
    return c === 'HIGH' || c === 'CRITICAL';
  }).length;

  const needsReorder = reorderRows.filter((row) => row.needs_reorder).length;

  const consumedQtyMap = new Map<string, number>();
  let consumptionCost = 0;

  for (const row of kardexRows) {
    const qty = toNumber(row.qty_delta);
    const isOut = row.movement_side === 'OUT' || qty < 0;
    if (!isOut) continue;

    const partKey = `${coalesceLabel(row.part_code, 'N/D')}|${coalesceLabel(row.part_name, 'Sin nombre')}`;
    const qtyAbs = Math.abs(qty);

    consumedQtyMap.set(partKey, (consumedQtyMap.get(partKey) ?? 0) + qtyAbs);
    consumptionCost += qtyAbs * toNumber(row.unit_cost);
  }

  const topConsumedParts: PartRankingRow[] = Array.from(consumedQtyMap.entries())
    .map(([key, value]) => {
      const [code, name] = key.split('|');
      return { code: code ?? 'N/D', name: name ?? 'Sin nombre', value: round(value) };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_TABLE);

  const topReorderParts: PartRankingRow[] = reorderRows
    .filter((row) => row.needs_reorder)
    .map((row) => ({
      code: row.part_code,
      name: row.part_name,
      value: round(toNumber(row.suggested_min_replenish)),
      warehouse: `${row.warehouse_code} — ${row.warehouse_name}`,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_TABLE);

  const reservationMap = new Map<string, number>();
  let pendingReservationQty = 0;

  for (const row of requestRows) {
    const reserved = toNumber(row.reserved_qty);
    const pending = Math.max(reserved, 0);

    if (pending <= 0) continue;

    const ticketLabel = `OT #${row.ticket_id}`;
    reservationMap.set(ticketLabel, (reservationMap.get(ticketLabel) ?? 0) + pending);
    pendingReservationQty += pending;
  }

  const reservationsByTicket: PartRankingRow[] = Array.from(reservationMap.entries())
    .map(([ticketLabel, value]) => ({
      code: ticketLabel,
      name: 'Pendiente por despachar',
      value: round(value),
      ticketId: ticketLabel,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_TABLE);

  return {
    meta: makeMeta(summaryRows.length),
    kpis: {
      totalParts: summaryRows.length,
      criticalParts,
      onHandQty: round(onHandQty),
      reservedQty: round(reservedQty),
      availableQty: round(availableQty),
      needsReorder,
      docsDraft: docsRows.filter((doc) => doc.status === 'DRAFT').length,
      docsCancelled: docsRows.filter((doc) => doc.status === 'CANCELLED').length,
      inventoryValuation: valuation.totalValuation,
      consumptionCost: round(consumptionCost),
      pendingReservationQty: round(pendingReservationQty),
    },
    docsByStatus: toBuckets(docsByStatusMap, 20),
    docsByType: toBuckets(docsByTypeMap, 20),
    topConsumedParts,
    topReorderParts,
    reservationsByTicket,
  };
}

export async function getAdminReportsData(
  rawFilters?: DashboardReportFilters | ReportFilters
): Promise<AdminReportsData> {
  const filters = normalizeFilters(rawFilters);

  let demandQuery = applyDateRange(
    supabase
      .from('tickets')
      .select('location_id,created_at')
      .limit(10000),
    filters,
    'created_at'
  );

  if (typeof filters.locationId === 'number') {
    demandQuery = demandQuery.eq('location_id', filters.locationId);
  }

  const [
    rolesRes,
    permsRes,
    rolePermsRes,
    usersRes,
    userRolesRes,
    assigneesRes,
    announcementsRes,
    locationsRes,
    societiesRes,
    demandRes,
  ] = await Promise.all([
    supabase.from('roles').select('id,name').limit(5000),
    supabase.from('permissions').select('id').limit(10000),
    supabase.from('role_permissions').select('role_id,permission_id').limit(20000),
    supabase.from('users').select('id,is_active,rol_id,location_id').limit(20000),
    supabase.from('user_roles').select('user_id,role_id').limit(20000),
    supabase.from('assignees').select('section,is_active,user_id').limit(20000),
    supabase
      .from('announcements')
      .select('id,level,is_active,starts_at,ends_at')
      .limit(5000),
    supabase.from('locations').select('id,name,is_active').limit(5000),
    supabase.from('societies').select('id,is_active').limit(5000),
    demandQuery,
  ]);

  if (rolesRes.error) throw new Error(rolesRes.error.message);
  if (permsRes.error) throw new Error(permsRes.error.message);
  if (rolePermsRes.error) throw new Error(rolePermsRes.error.message);
  if (usersRes.error) throw new Error(usersRes.error.message);
  if (userRolesRes.error) throw new Error(userRolesRes.error.message);
  if (assigneesRes.error) throw new Error(assigneesRes.error.message);
  if (announcementsRes.error) throw new Error(announcementsRes.error.message);
  if (locationsRes.error) throw new Error(locationsRes.error.message);
  if (societiesRes.error) throw new Error(societiesRes.error.message);
  if (demandRes.error) throw new Error(demandRes.error.message);

  const roles = (rolesRes.data ?? []) as RoleLite[];
  const permissions = (permsRes.data ?? []) as PermissionLite[];
  const rolePermissions = (rolePermsRes.data ?? []) as RolePermissionLite[];
  const users = (usersRes.data ?? []) as UserLite[];
  const userRoles = (userRolesRes.data ?? []) as UserRoleLite[];
  const assignees = (assigneesRes.data ?? []) as AssigneeLite[];
  const announcements = (announcementsRes.data ?? []) as AnnouncementLite[];
  const locations = (locationsRes.data ?? []) as LocationLite[];
  const societies = (societiesRes.data ?? []) as SocietyLite[];
  const demand = (demandRes.data ?? []) as TicketLocationLite[];

  const usersActive = users.filter((u) => asBool(u.is_active)).length;
  const usersInactive = users.length - usersActive;

  const assigneesActive = assignees.filter((a) => asBool(a.is_active)).length;
  const assigneesWithoutUser = assignees.filter(
    (a) => asBool(a.is_active) && !a.user_id
  ).length;

  const now = new Date();
  const inSevenDays = new Date(now.getTime() + 7 * 86_400_000);

  const activeAnnouncements = announcements.filter((a) => {
    if (!asBool(a.is_active)) return false;
    const startsAt = toDate(a.starts_at);
    const endsAt = toDate(a.ends_at);
    if (startsAt && startsAt.getTime() > now.getTime()) return false;
    if (endsAt && endsAt.getTime() < now.getTime()) return false;
    return true;
  }).length;

  const expiringAnnouncements = announcements.filter((a) => {
    if (!asBool(a.is_active)) return false;
    const endsAt = toDate(a.ends_at);
    if (!endsAt) return false;
    return endsAt.getTime() >= now.getTime() && endsAt.getTime() <= inSevenDays.getTime();
  }).length;

  const activeLocations = locations.filter((l) => asBool(l.is_active)).length;
  const activeSocieties = societies.filter((s) => asBool(s.is_active)).length;

  const roleById = new Map<number, RoleLite>();
  for (const role of roles) roleById.set(role.id, role);

  const usersByRoleMap = new Map<number, number>();
  const usersByRoleFallbackMap = new Map<number, number>();

  for (const row of userRoles) {
    usersByRoleMap.set(row.role_id, (usersByRoleMap.get(row.role_id) ?? 0) + 1);
  }

  for (const row of users) {
    if (typeof row.rol_id === 'number') {
      usersByRoleFallbackMap.set(
        row.rol_id,
        (usersByRoleFallbackMap.get(row.rol_id) ?? 0) + 1
      );
    }
  }

  const useUserRoles = usersByRoleMap.size > 0;
  const finalUsersByRole = useUserRoles ? usersByRoleMap : usersByRoleFallbackMap;

  const usersByRole: ReportBucket[] = Array.from(finalUsersByRole.entries())
    .map(([roleId, count]) => ({
      label: roleById.get(roleId)?.name ?? `Rol #${roleId}`,
      value: count,
    }))
    .sort((a, b) => b.value - a.value);

  const rolePermCountMap = new Map<number, number>();
  for (const row of rolePermissions) {
    rolePermCountMap.set(
      row.role_id,
      (rolePermCountMap.get(row.role_id) ?? 0) + 1
    );
  }

  const rolePermissionMatrix: AdminRoleMatrixRow[] = roles
    .map((role) => ({
      roleId: role.id,
      roleName: role.name,
      users: finalUsersByRole.get(role.id) ?? 0,
      permissions: rolePermCountMap.get(role.id) ?? 0,
    }))
    .sort((a, b) => b.users - a.users);

  const assigneesBySectionMap = new Map<string, number>();
  for (const row of assignees) {
    addMapCount(assigneesBySectionMap, coalesceLabel(row.section, 'SIN SECCION'));
  }

  const announcementsByLevelMap = new Map<string, number>();
  for (const row of announcements) {
    addMapCount(
      announcementsByLevelMap,
      coalesceLabel(row.level, 'SIN NIVEL').toLowerCase()
    );
  }

  const locationNameById = new Map<number, string>();
  for (const row of locations) {
    locationNameById.set(row.id, row.name);
  }

  const locationDemandMap = new Map<string, number>();
  for (const row of demand) {
    const label =
      typeof row.location_id === 'number'
        ? (locationNameById.get(row.location_id) ?? 'Sin ubicación')
        : 'Sin ubicación';

    addMapCount(locationDemandMap, label);
  }

  return {
    meta: makeMeta(users.length),
    kpis: {
      roles: roles.length,
      permissions: permissions.length,
      usersActive,
      usersInactive,
      assigneesActive,
      assigneesWithoutUser,
      activeAnnouncements,
      expiringAnnouncements,
      activeLocations,
      activeSocieties,
    },
    usersByRole,
    assigneesBySection: toBuckets(assigneesBySectionMap, 20),
    announcementsByLevel: toBuckets(announcementsByLevelMap, 20),
    locationDemand: toBuckets(locationDemandMap, 20),
    rolePermissionMatrix,
  };
}
