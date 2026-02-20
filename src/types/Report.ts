export type TicketStatus = 'Pendiente' | 'En Ejecución' | 'Finalizadas';

export interface ReportFilters {
  location_id?: string;
  assignee?: string;
  requester?: string;
  status?: TicketStatus; // útil para filtrar cuando agrupas por otro campo
  from?: string; // ISO: "2025-08-01T00:00:00"
  to?: string; // ISO: "2025-08-31T23:59:59"
  locationId?: number; // versión numérica para reportes nuevos
}

export interface CountByStatusDTO {
  status: TicketStatus;
  count: number;
}

export interface CountByFieldDTO {
  key: string; // location_id | assignee | requester
  count: number;
}

export interface DashboardReportFilters {
  from?: string;
  to?: string;
  locationId?: number;
}

export interface ReportBucket {
  label: string;
  value: number;
}

export interface SectionMeta {
  generatedAt: string;
  rowCount: number;
}

export interface ExecutiveSummaryReport {
  meta: SectionMeta;
  kpis: {
    openWorkOrders: number;
    overdueWorkOrders: number;
    urgentOpen: number;
    assetsOutOfService: number;
    needsReorder: number;
    activeAnnouncements: number;
    inventoryValuation: number;
  };
  byLocation: ReportBucket[];
  bySpecialIncident: ReportBucket[];
  topConsumedParts: ReportBucket[];
}

export interface WorkTechnicianRow {
  technician: string;
  openCount: number;
  closedCount: number;
  avgResolutionHours: number;
}

export interface WorkManagementReport {
  meta: SectionMeta;
  totalTickets: number;
  kpis: {
    requestBacklog: number;
    workOrderBacklog: number;
    urgentOpen: number;
    overdueOpen: number;
    unassignedOpen: number;
    archived: number;
    avgResolutionHours: number;
    slaOnTimeRate: number;
  };
  byStatus: ReportBucket[];
  byPriority: ReportBucket[];
  backlogAging: ReportBucket[];
  deadlineCompliance: ReportBucket[];
  byTechnician: WorkTechnicianRow[];
  byLocation: ReportBucket[];
  bySpecialIncident: ReportBucket[];
}

export interface AssetTopRow {
  assetId: number;
  code: string;
  name: string;
  value: number;
}

export interface AssetsReport {
  meta: SectionMeta;
  kpis: {
    totalAssets: number;
    activeAssets: number;
    maintenanceAssets: number;
    outOfServiceAssets: number;
    retiredAssets: number;
    warrantyIn30Days: number;
    warrantyIn60Days: number;
    warrantyIn90Days: number;
    maintenanceCostTotal: number;
    downtimeHoursTotal: number;
  };
  byStatus: ReportBucket[];
  byCriticality: ReportBucket[];
  byMaintenanceType: ReportBucket[];
  topByTickets: AssetTopRow[];
  topByCost: AssetTopRow[];
  topByDowntime: AssetTopRow[];
}

export interface PartRankingRow {
  code: string;
  name: string;
  value: number;
  warehouse?: string;
  ticketId?: string;
}

export interface InventoryPartsReport {
  meta: SectionMeta;
  kpis: {
    totalParts: number;
    criticalParts: number;
    onHandQty: number;
    reservedQty: number;
    availableQty: number;
    needsReorder: number;
    docsDraft: number;
    docsCancelled: number;
    inventoryValuation: number;
    consumptionCost: number;
    pendingReservationQty: number;
  };
  docsByStatus: ReportBucket[];
  docsByType: ReportBucket[];
  topConsumedParts: PartRankingRow[];
  topReorderParts: PartRankingRow[];
  reservationsByTicket: PartRankingRow[];
}

export interface AdminRoleMatrixRow {
  roleId: number;
  roleName: string;
  users: number;
  permissions: number;
}

export interface AdminReportsData {
  meta: SectionMeta;
  kpis: {
    roles: number;
    permissions: number;
    usersActive: number;
    usersInactive: number;
    assigneesActive: number;
    assigneesWithoutUser: number;
    activeAnnouncements: number;
    expiringAnnouncements: number;
    activeLocations: number;
    activeSocieties: number;
  };
  usersByRole: ReportBucket[];
  assigneesBySection: ReportBucket[];
  announcementsByLevel: ReportBucket[];
  locationDemand: ReportBucket[];
  rolePermissionMatrix: AdminRoleMatrixRow[];
}
