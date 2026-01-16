// src/services/reportService.ts
import { supabase } from "../lib/supabaseClient";
import type {
  ReportFilters,
  CountByStatusDTO,
  CountByFieldDTO,
  TicketStatus,
} from "../types/Report";
import type { PostgrestError } from "@supabase/supabase-js";
import type { ChartData } from "chart.js";

/** ==== Tipos del dashboard ==== */
export type Priority = "Crítica" | "Alta" | "Media" | "Baja";

export interface DashboardKpis {
  openCount: number;            // OTs Abiertas (status=Pendiente | En Ejecución)
  overdueCount: number;         // OTs Vencidas (due_date < now AND status != Finalizadas)
  mttrHours: number;            // MTTR promedio (h)
  preventiveCompliance: number; // % preventivo cumplido (preventivo cerradas / planificadas)
  criticalBacklog: number;      // Backlog crítico (prioridad Crítica abiertas)
}

export interface MttrTrendPoint { label: string; value: number; }
export interface MonthSplit { month: string; preventive: number; corrective: number; }
export interface AgeBucket { bucket: string; count: number; }
export interface ComplianceByLocation { location: string; compliance: number; }
export interface TechnicianLoad { tech: string; hours: number; capacity: number; }
export type BarChartData = ChartData<'bar', number[], string>;


const STATUS_ORDER: TicketStatus[] = ["Pendiente", "En Ejecución", "Finalizadas"];

// “Lite row” con todos los campos que usamos en reportes
type TicketLite = {
  status: string | null;
  is_accepted: boolean | null;
  location: string | null;
  assignee: string | null;
  requester: string | null;
  created_at: string | null;     // ISO
  closed_at?: string | null;     // ISO
  is_preventive?: boolean | null;
  priority?: string | null;      // Crítica/Alta/Media/Baja
  due_date?: string | null;      // ISO
  repair_time_h?: number | null; // horas (para MTTR)
  planned?: boolean | null;      // preventivo planificado
};

// Builder básico (siempre incluye is_accepted para filtrar en servidor)
function buildBaseSelect(columns: string) {
  const cols = `is_accepted, ${columns}`;
  return supabase.from("tickets").select(cols);
}

// Respuesta tipada sin any
type RowsResponse<T> = Promise<{ data: T[] | null; error: PostgrestError | null }>;

function applyFilters<T>(
  query: ReturnType<typeof buildBaseSelect>,
  filters?: ReportFilters
): RowsResponse<T> {
  let q = query.eq("is_accepted", true); // SIEMPRE aceptados

  if (filters?.location)  q = q.eq("location",  filters.location);
  if (filters?.assignee)  q = q.eq("assignee",  filters.assignee);
  if (filters?.requester) q = q.eq("requester", filters.requester);
  if (filters?.status)    q = q.eq("status",    filters.status);

  if (filters?.from) q = q.gte("created_at", filters.from);
  if (filters?.to)   q = q.lte("created_at", filters.to);

  // Cast único a la promesa tipada
  return q as unknown as RowsResponse<T>;
}

/* =========================================================================
 *  FUNCIONES EXISTENTES (se conservan nombres y firmas)
 * ========================================================================= */

// Cuenta tickets por STATUS (Pendiente / En Ejecución / Finalizadas)
export async function getCountByStatus(filters?: ReportFilters): Promise<CountByStatusDTO[]> {
  const { data, error } = await applyFilters<TicketLite>(
    buildBaseSelect("status, created_at"),
    filters
  );
  if (error) throw new Error(error.message);

  const rows = (data ?? []);

  // Inicializamos el contador con 0 para cada status esperado
  const counts = new Map<TicketStatus, number>(
    STATUS_ORDER.map((s) => [s, 0]),
  );

  for (const r of rows) {
    const s = (r.status ?? "") as string;
    const normalized =
      s === "Pendiente" || s === "En Ejecución" || s === "Finalizadas" ? (s as TicketStatus) : null;
    if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  // Devolvemos orden fijo
  return STATUS_ORDER.map((s) => ({
    status: s,
    count: counts.get(s) ?? 0,
  }));
}

// Cuenta tickets agrupando por location | assignee | requester
export async function getCountByField(
  field: "location" | "assignee" | "requester",
  filters?: ReportFilters,
): Promise<CountByFieldDTO[]> {
  const { data, error } = await applyFilters<Pick<TicketLite, typeof field>>(
    buildBaseSelect(`${field}, created_at`),
    filters
  );
  if (error) throw new Error(error.message);

  const rows = (data ?? []);

  // Agrupamos en cliente
  const counter = new Map<string, number>();
  for (const r of rows) {
    const key = (r[field] ?? "(Sin valor)") as string;
    counter.set(key, (counter.get(key) ?? 0) + 1);
  }

  const result: CountByFieldDTO[] = Array.from(counter.entries()).map(([key, count]) => ({
    key,
    count,
  }));

  // Orden: mayor a menor
  result.sort((a, b) => b.count - a.count);
  return result;
}

/** Helpers para Chart.js (existentes) */
export function toBarChartFromStatus(
  dto: CountByStatusDTO[],
  datasetLabel = "Tickets aceptados"
): BarChartData {
  return {
    labels: dto.map((d) => d.status),
    datasets: [
      {
        label: datasetLabel,
        data: dto.map((d) => d.count),
        backgroundColor: ["#6366f1", "#f59e0b", "#10b981"],
        borderColor: ["#6366f1", "#f59e0b", "#10b981"],
        borderWidth: 1,
      },
    ],
  };
}

export function toBarChartFromField(
  dto: CountByFieldDTO[],
  datasetLabel = "Tickets aceptados"
): BarChartData {
  return {
    labels: dto.map((d) => d.key),
    datasets: [
      {
        label: datasetLabel,
        data: dto.map((d) => d.count),
        backgroundColor: "#6366f1",
        borderColor: "#6366f1",
        borderWidth: 1,
      },
    ],
  };
}

/* =========================================================================
 *  NUEVAS FUNCIONES DEL DASHBOARD
 * ========================================================================= */

// KPIs principales
export async function getDashboardKpis(filters?: ReportFilters): Promise<DashboardKpis> {
  const { data, error } = await applyFilters<TicketLite>(
    buildBaseSelect(`status, created_at, closed_at, is_preventive, priority, due_date, planned, repair_time_h`),
    filters
  );
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  // Abiertas (no finalizadas)
  const openCount = rows.filter(r => (r.status === "Pendiente" || r.status === "En Ejecución")).length;

  // Vencidas
  const nowIso = new Date().toISOString();
  const overdueCount = rows.filter(r =>
    (!!r.due_date && r.due_date < nowIso) && r.status !== "Finalizadas"
  ).length;

  // MTTR (horas); si no hay repair_time_h, calcula (closed_at - created_at) en horas
  let totalH = 0, closedN = 0;
  for (const r of rows) {
    if (r.status === "Finalizadas") {
      closedN++;
      if (typeof r.repair_time_h === "number") {
        totalH += Math.max(0, r.repair_time_h);
      } else if (r.closed_at && r.created_at) {
        const diff = (new Date(r.closed_at).getTime() - new Date(r.created_at).getTime()) / 36e5;
        totalH += Math.max(0, diff);
      }
    }
  }
  const mttrHours = closedN ? +(totalH / closedN).toFixed(1) : 0;

  // Cumplimiento preventivo: cerradas preventivo / planificadas
  const prevClosed = rows.filter(r => r.is_preventive && r.status === "Finalizadas").length;
  const prevPlanned = rows.filter(r => r.is_preventive && (r.planned ?? true)).length || 1;
  const preventiveCompliance = Math.round((prevClosed / prevPlanned) * 100);

  // Backlog crítico
  const criticalBacklog = rows.filter(r =>
    (r.priority === "Crítica") && (r.status !== "Finalizadas")
  ).length;

  return { openCount, overdueCount, mttrHours, preventiveCompliance, criticalBacklog };
}

// Tendencia MTTR por semana (últimas 7)
export async function getMttrTrend(filters?: ReportFilters): Promise<MttrTrendPoint[]> {
  const { data, error } = await applyFilters<TicketLite>(
    buildBaseSelect(`created_at, closed_at, status, repair_time_h`),
    filters
  );
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter(r => r.status === "Finalizadas");

  const weeks = Array.from({ length: 7 }, (_, i) => i).reverse(); // 6..0 => Sem1..Sem7
  const now = new Date();
  const acc: { [key: number]: { sum: number; n: number } } = {};
  for (const r of rows) {
    const end = r.closed_at ? new Date(r.closed_at) : new Date(r.created_at ?? now);
    const diffWeeks = Math.floor((+now - +end) / (7 * 24 * 3600 * 1000));
    if (diffWeeks >= 0 && diffWeeks < 7) {
      const w = 6 - diffWeeks; // 0..6 para Sem1..Sem7
      const val = typeof r.repair_time_h === "number"
        ? r.repair_time_h
        : r.created_at && r.closed_at
          ? (new Date(r.closed_at).getTime() - new Date(r.created_at).getTime()) / 36e5
          : 0;
      (acc[w] ??= { sum: 0, n: 0 });
      acc[w].sum += Math.max(0, val);
      acc[w].n += 1;
    }
  }
  return weeks.map((i) => ({
    label: `Sem ${i + 1}`,
    value: acc[i]?.n ? +(acc[i].sum / acc[i].n).toFixed(1) : 0,
  }));
}

// Preventivo vs Correctivo por mes (últimos 6) — meses robustos
export async function getPreventiveVsCorrective(filters?: ReportFilters): Promise<MonthSplit[]> {
  const { data, error } = await applyFilters<TicketLite>(
    buildBaseSelect(`created_at, is_preventive`),
    filters
  );
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
    return `${d.toLocaleString("es-DO", { month: "short" })}`;
  });

  const acc: { [m: number]: { prev: number; corr: number } } = {};
  const nowD = new Date();

  for (const r of rows) {
    const dt = r.created_at ? new Date(r.created_at) : null;
    if (!dt) continue;

    // Diferencia de meses sin % 12 (evita que >12m “reingrese”)
    const monthsDiff =
      (nowD.getFullYear() - dt.getFullYear()) * 12 + (nowD.getMonth() - dt.getMonth());

    if (monthsDiff >= 0 && monthsDiff < 6) {
      const bucket = 5 - monthsDiff;
      const bucketObj = (acc[bucket] ??= { prev: 0, corr: 0 });
      if (r.is_preventive) {
        bucketObj.prev += 1;
      } else {
        bucketObj.corr += 1;
      }
    }
  }

  return months.map((m, i) => ({
    month: m.charAt(0).toUpperCase() + m.slice(1),
    preventive: acc[i]?.prev ?? 0,
    corrective: acc[i]?.corr ?? 0,
  }));
}

// Distribución por antigüedad (edad del ticket)
export async function getAgeDistribution(filters?: ReportFilters): Promise<AgeBucket[]> {
  const { data, error } = await applyFilters<TicketLite>(
    buildBaseSelect(`created_at, status`),
    filters
  );
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const now = Date.now();

  const buckets = {
    "0-1 días": 0, "2-3 días": 0, "4-7 días": 0, "8-15 días": 0, "16+ días": 0,
  } as Record<string, number>;

  for (const r of rows) {
    const c = r.created_at ? new Date(r.created_at).getTime() : now;
    const days = Math.floor((now - c) / 86400000);
    if (days <= 1) buckets["0-1 días"]++;
    else if (days <= 3) buckets["2-3 días"]++;
    else if (days <= 7) buckets["4-7 días"]++;
    else if (days <= 15) buckets["8-15 días"]++;
    else buckets["16+ días"]++;
  }

  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
}

// Cumplimiento preventivo por ubicación
export async function getPreventiveComplianceByLocation(filters?: ReportFilters): Promise<ComplianceByLocation[]> {
  const { data, error } = await applyFilters<TicketLite>(
    buildBaseSelect(`location, is_preventive, status, planned`),
    filters
  );
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const map = new Map<string, { closed: number; planned: number }>();
  for (const r of rows) {
    if (!r.is_preventive) continue;
    const key = r.location ?? "(Sin ubicación)";
    const it = map.get(key) ?? { closed: 0, planned: 0 };
    if (r.status === "Finalizadas") it.closed++;
    it.planned += (r.planned ?? true) ? 1 : 0; // ✅ antes sumaba 1 siempre
    map.set(key, it);
  }

  return Array.from(map.entries()).map(([location, { closed, planned }]) => ({
    location,
    compliance: planned ? Math.round((closed / planned) * 100) : 0,
  })).sort((a, b) => b.compliance - a.compliance);
}

// Carga del técnico (simple): horas vs capacidad (40h por defecto)
export async function getTechnicianLoad(filters?: ReportFilters): Promise<TechnicianLoad[]> {
  const { data, error } = await applyFilters<TicketLite>(
    buildBaseSelect(`assignee, repair_time_h, status`),
    filters
  );
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.assignee ?? "(Sin técnico)";
    const h = typeof r.repair_time_h === "number" ? r.repair_time_h : 2; // fallback 2h
    // usa sólo tickets no finalizados para “carga”
    if (r.status !== "Finalizadas") map.set(key, (map.get(key) ?? 0) + Math.max(0, h));
  }

  return Array.from(map.entries()).map(([tech, hours]) => ({
    tech, hours, capacity: 40,
  })).sort((a, b) => b.hours - a.hours);
}

/** ====== Helpers Chart.js (datasets) extendidos ====== */
export const chartHelpers = {
  kpiDelta: (curr: number, prev: number) =>
    prev ? Math.round(((curr - prev) / prev) * 100) : 0,

  toBar(values: { labels: string[]; data: number[] }, label = "Valor"): BarChartData {
    return {
      labels: values.labels,
      datasets: [
        { label, data: values.data, backgroundColor: "#6366f1", borderColor: "#6366f1", borderWidth: 1 }
      ],
    };
  },

  toStackedBars(months: MonthSplit[]): BarChartData {
    return {
      labels: months.map(m => m.month),
      datasets: [
        { label: "Preventivo", data: months.map(m => m.preventive), backgroundColor: "#10b981" },
        { label: "Correctivo", data: months.map(m => m.corrective), backgroundColor: "#ef4444" },
      ],
    };
  },

  toHorizontalBars(rows: { label: string; value: number }[], label = "Cantidad"): BarChartData {
    return {
      labels: rows.map(r => r.label),
      datasets: [
        { label, data: rows.map(r => r.value), backgroundColor: "#3b82f6" }
      ],
    };
  },
};
