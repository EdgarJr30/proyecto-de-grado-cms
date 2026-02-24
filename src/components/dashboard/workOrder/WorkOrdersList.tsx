import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Ticket, WorkOrder, WorkOrderExtras } from '../../../types/Ticket';
import type { FilterState } from '../../../types/filters';
import type { WorkOrdersFilterKey } from '../../../features/tickets/WorkOrdersFilters';
import {
  getPublicImageUrl,
  getTicketImagePaths,
} from '../../../services/storageService';
import {
  getTicketsByWorkOrdersFiltersPaginated,
  moveWorkOrderStatus,
} from '../../../services/ticketService';
import AssigneeBadge from '../../common/AssigneeBadge';
import { supabase } from '../../../lib/supabaseClient';
import { useLocationCatalog } from '../../../hooks/useLocationCatalog';
import { useCan } from '../../../rbac/PermissionsContext';
import { showToastError } from '../../../notifications/toast';

type GroupMode = 'manual' | 'dateAsc' | 'dateDesc';

type Props = {
  filters?: FilterState<WorkOrdersFilterKey>;
  groupMode: GroupMode;
  onOpen?: (t: WorkOrder) => void;
  lastUpdatedTicket?: Partial<WorkOrder> | null;
};

type ManualOrderMap = Record<Ticket['status'], number[]>;

type DropTarget = {
  status: Ticket['status'];
  index: number;
};

const PAGE_SIZE = 10;
const MANUAL_ORDER_STORAGE_KEY = 'work_orders_manual_order_v1';
const STATUS_ORDER: Ticket['status'][] = [
  'Pendiente',
  'En Ejecución',
  'Finalizadas',
];
const STATUS_SECTION_LABEL: Record<Ticket['status'], string> = {
  Pendiente: 'Pendientes',
  'En Ejecución': 'En ejecución',
  Finalizadas: 'Finalizadas',
};

function statusClass(s: Ticket['status']) {
  if (s === 'Pendiente') return 'bg-yellow-100 text-gray-800 border-gray-200';
  if (s === 'En Ejecución') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-green-100 text-green-800 border-green-200';
}

function priorityClass(p?: Ticket['priority']) {
  if (p === 'Alta') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (p === 'Media') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-green-100 text-green-800 border-green-200';
}

function withEffective(w: WorkOrder): WorkOrder {
  const primary =
    (w as WorkOrderExtras).primary_assignee_id ?? w.assignee_id ?? null;
  const sec = (w as WorkOrderExtras).secondary_assignee_ids ?? [];
  const effective =
    (w as WorkOrderExtras).effective_assignee_id ??
    primary ??
    (sec.length > 0 ? sec[0] : null) ??
    null;
  return {
    ...(w as WorkOrderExtras),
    effective_assignee_id: effective,
  } as WorkOrder;
}

function emptyManualOrder(): ManualOrderMap {
  return {
    Pendiente: [],
    'En Ejecución': [],
    Finalizadas: [],
  };
}

function readManualOrderFromStorage(): ManualOrderMap {
  if (typeof window === 'undefined') return emptyManualOrder();

  const fallback = emptyManualOrder();
  try {
    const raw = window.localStorage.getItem(MANUAL_ORDER_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ManualOrderMap>;

    return {
      Pendiente: Array.isArray(parsed.Pendiente)
        ? parsed.Pendiente.map(Number).filter((id) => Number.isFinite(id))
        : [],
      'En Ejecución': Array.isArray(parsed['En Ejecución'])
        ? parsed['En Ejecución']
            .map(Number)
            .filter((id) => Number.isFinite(id))
        : [],
      Finalizadas: Array.isArray(parsed.Finalizadas)
        ? parsed.Finalizadas.map(Number).filter((id) => Number.isFinite(id))
        : [],
    };
  } catch {
    return fallback;
  }
}

function persistManualOrder(order: ManualOrderMap) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MANUAL_ORDER_STORAGE_KEY, JSON.stringify(order));
}

function dedupeIds(ids: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function normalizeManualOrderWithRows(
  previous: ManualOrderMap,
  rows: WorkOrder[]
): ManualOrderMap {
  const groupedIds = emptyManualOrder();

  rows.forEach((row) => {
    const id = Number(row.id);
    if (!id) return;
    groupedIds[row.status].push(id);
  });

  const next = emptyManualOrder();
  STATUS_ORDER.forEach((status) => {
    const existing = previous[status].filter((id) => groupedIds[status].includes(id));
    const missing = groupedIds[status].filter((id) => !existing.includes(id));
    next[status] = dedupeIds([...existing, ...missing]);
  });

  return next;
}

function moveIdWithinOrder(
  previous: ManualOrderMap,
  ticketId: number,
  sourceStatus: Ticket['status'],
  targetStatus: Ticket['status'],
  targetIndex: number
): ManualOrderMap {
  const next = {
    Pendiente: [...previous.Pendiente],
    'En Ejecución': [...previous['En Ejecución']],
    Finalizadas: [...previous.Finalizadas],
  };

  next[sourceStatus] = next[sourceStatus].filter((id) => id !== ticketId);
  next[targetStatus] = next[targetStatus].filter((id) => id !== ticketId);

  const safeIndex = Math.max(0, Math.min(targetIndex, next[targetStatus].length));
  next[targetStatus].splice(safeIndex, 0, ticketId);

  return next;
}

function parseSafeDate(input?: string | null): number {
  if (!input) return Number.NaN;
  const parsed = Date.parse(input);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function compareByIncidentDate(a: WorkOrder, b: WorkOrder, mode: GroupMode) {
  const aDate = parseSafeDate(a.incident_date);
  const bDate = parseSafeDate(b.incident_date);

  if (!Number.isNaN(aDate) && !Number.isNaN(bDate) && aDate !== bDate) {
    return mode === 'dateAsc' ? aDate - bDate : bDate - aDate;
  }

  if (!Number.isNaN(aDate) && Number.isNaN(bDate)) return -1;
  if (Number.isNaN(aDate) && !Number.isNaN(bDate)) return 1;

  return Number(b.id) - Number(a.id);
}

export default function WorkOrdersList({
  filters,
  groupMode,
  onOpen,
  lastUpdatedTicket,
}: Props) {
  const { getLocationLabel } = useLocationCatalog({
    includeInactive: true,
    activeOnlyOptions: false,
  });
  const canMoveCards = useCan('work_orders:full_access');
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [manualOrderByStatus, setManualOrderByStatus] =
    useState<ManualOrderMap>(() => readManualOrderFromStorage());
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [draggedTicket, setDraggedTicket] = useState<WorkOrder | null>(null);
  const [draggedTicketId, setDraggedTicketId] = useState<number | null>(null);
  const [movingTicketId, setMovingTicketId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [sectionMenuTicketId, setSectionMenuTicketId] = useState<number | null>(
    null
  );
  const realtimeRefreshTimeout = useRef<number | null>(null);
  const suppressRealtimeUntilRef = useRef<Record<number, number>>({});
  const suppressClickUntilRef = useRef(0);

  const fkey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);
  const toId = (value: string | number | undefined | null) => Number(value ?? 0);

  const groupedRows = useMemo(() => {
    const grouped = STATUS_ORDER.map((status) => {
      const statusRows = rows.filter((r) => r.status === status);

      if (groupMode === 'manual') {
        const ids = manualOrderByStatus[status];
        const map = new Map<number, WorkOrder>();
        statusRows.forEach((row) => {
          map.set(Number(row.id), row);
        });

        const ordered = ids
          .map((id) => map.get(id))
          .filter((row): row is WorkOrder => Boolean(row));
        const missing = statusRows.filter((row) => !ids.includes(Number(row.id)));

        return {
          status,
          title: STATUS_SECTION_LABEL[status],
          items: [...ordered, ...missing],
        };
      }

      return {
        status,
        title: STATUS_SECTION_LABEL[status],
        items: [...statusRows].sort((a, b) => compareByIncidentDate(a, b, groupMode)),
      };
    });

    return grouped;
  }, [groupMode, manualOrderByStatus, rows]);

  const reload = useCallback(
    async (p = 0) => {
      setLoading(true);
      const { data, count: total } = await getTicketsByWorkOrdersFiltersPaginated(
        (filters ?? {}) as FilterState<string>,
        p,
        PAGE_SIZE
      );
      setRows(data);
      setCount(total);
      setLoading(false);
    },
    [filters]
  );

  useEffect(() => {
    setPage(0);
  }, [fkey]);

  useEffect(() => {
    void reload(page);
  }, [page, fkey, reload]);

  useEffect(() => {
    setManualOrderByStatus((prev) => normalizeManualOrderWithRows(prev, rows));
  }, [rows]);

  useEffect(() => {
    persistManualOrder(manualOrderByStatus);
  }, [manualOrderByStatus]);

  useEffect(() => {
    if (sectionMenuTicketId == null) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const inActions =
        target instanceof Element && target.closest('[data-list-actions="1"]');
      if (!inActions) setSectionMenuTicketId(null);
    };

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSectionMenuTicketId(null);
      }
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onEsc);

    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [sectionMenuTicketId]);

  // Mezcla local optimista cuando llega un patch desde el modal
  useEffect(() => {
    if (!lastUpdatedTicket?.id) return;
    const lastId = toId(lastUpdatedTicket.id as string | number | undefined);
    if (!lastId) return;

    let touched = false;
    setRows((prev) => {
      const next = prev.map((r) => {
        if (toId(r.id) === lastId) {
          touched = true;
          return withEffective({
            ...r,
            ...(lastUpdatedTicket as WorkOrder),
          } as WorkOrder);
        }
        return r;
      });
      return touched ? next : prev;
    });

    if (!touched) {
      void reload(page);
    }
  }, [lastUpdatedTicket, page, reload]);

  useEffect(() => {
    const channel = supabase
      .channel('tickets-changes-WorkOrdersList')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets' },
        (payload) => {
          const oldRow = payload.old as Partial<Ticket>;
          const newRow = payload.new as Partial<Ticket>;
          const changedId = Number(newRow.id ?? 0);
          const suppressUntil = suppressRealtimeUntilRef.current[changedId] ?? 0;
          if (changedId && suppressUntil > Date.now()) {
            return;
          }
          if (changedId && suppressUntil <= Date.now()) {
            delete suppressRealtimeUntilRef.current[changedId];
          }

          const relevantChange =
            oldRow.status !== newRow.status ||
            oldRow.priority !== newRow.priority ||
            oldRow.assignee_id !== newRow.assignee_id ||
            oldRow.location_id !== newRow.location_id ||
            oldRow.title !== newRow.title ||
            oldRow.incident_date !== newRow.incident_date ||
            oldRow.is_archived !== newRow.is_archived ||
            oldRow.is_accepted !== newRow.is_accepted;
          if (!relevantChange) return;

          if (realtimeRefreshTimeout.current) {
            window.clearTimeout(realtimeRefreshTimeout.current);
          }
          realtimeRefreshTimeout.current = window.setTimeout(() => {
            void reload(page);
            realtimeRefreshTimeout.current = null;
          }, 450);
        }
      )
      .subscribe();

    return () => {
      if (realtimeRefreshTimeout.current) {
        window.clearTimeout(realtimeRefreshTimeout.current);
      }
      try {
        void channel.unsubscribe();
      } catch {
        // noop
      }
    };
  }, [page, reload]);

  const canRowDrag = canMoveCards && movingTicketId === null;

  const clearDragState = () => {
    setDraggedTicket(null);
    setDraggedTicketId(null);
    setDropTarget(null);
  };

  const moveTicket = useCallback(
    async (ticket: WorkOrder, targetStatus: Ticket['status'], targetIndex: number) => {
      const ticketId = Number(ticket.id);
      if (!ticketId || movingTicketId !== null) return;

      const sourceStatus = ticket.status;
      const statusChanged = sourceStatus !== targetStatus;
      const manualMode = groupMode === 'manual';
      if (!manualMode && !statusChanged) return;

      const previousRows = rows;
      const previousOrder = manualOrderByStatus;

      setMovingTicketId(ticketId);
      suppressRealtimeUntilRef.current[ticketId] = Date.now() + 3000;
      setRows((prev) =>
        prev.map((row) =>
          Number(row.id) === ticketId
            ? ({ ...row, status: targetStatus } as WorkOrder)
            : row
        )
      );
      if (manualMode || statusChanged) {
        setManualOrderByStatus((prev) =>
          moveIdWithinOrder(
            prev,
            ticketId,
            sourceStatus,
            targetStatus,
            manualMode ? targetIndex : prev[targetStatus].length
          )
        );
      }

      try {
        if (statusChanged) {
          await moveWorkOrderStatus(ticketId, targetStatus);
        }
      } catch (error: unknown) {
        setRows(previousRows);
        setManualOrderByStatus(previousOrder);
        const msg = error instanceof Error ? error.message : String(error);
        showToastError(`No se pudo mover la orden. ${msg}`);
      } finally {
        setMovingTicketId(null);
      }
    },
    [groupMode, manualOrderByStatus, movingTicketId, rows]
  );

  const handleDrop = async (target?: DropTarget) => {
    if (!canMoveCards) return;
    const resolvedTarget = target ?? dropTarget;
    if (!draggedTicket || !resolvedTarget) return;

    await moveTicket(draggedTicket, resolvedTarget.status, resolvedTarget.index);
    clearDragState();
  };

  const handleMoveBetweenSections = async (
    ticket: WorkOrder,
    targetStatus: Ticket['status']
  ) => {
    if (!canMoveCards) return;

    const targetRows = groupedRows.find((group) => group.status === targetStatus)?.items ?? [];
    const targetIndex = ticket.status === targetStatus ? 0 : targetRows.length;

    await moveTicket(ticket, targetStatus, targetIndex);
  };

  return (
    <div className="wo-list overflow-auto rounded-2xl ring-1 ring-gray-200 bg-white shadow-sm">
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="wo-list-head bg-white sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[112px]">
              Acciones
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Nombre
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Fecha
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Prioridad
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Estado
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Ubicación
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Técnico
            </th>
          </tr>
        </thead>

        <tbody className="bg-white">
          {loading ? (
            <tr>
              <td colSpan={7} className="py-10 text-center text-gray-400">
                Cargando…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-10 text-center text-gray-400">
                Sin resultados.
              </td>
            </tr>
          ) : (
            groupedRows.map((group) => (
              <Fragment key={group.status}>
                <tr
                  className="wo-list-section-row"
                  onDragOver={(e) => {
                    if (!canRowDrag || !draggedTicket) return;
                    e.preventDefault();
                    setDropTarget({ status: group.status, index: 0 });
                  }}
                  onDrop={(e) => {
                    if (!canRowDrag || !draggedTicket) return;
                    e.preventDefault();
                    void handleDrop({ status: group.status, index: 0 });
                  }}
                >
                  <td colSpan={7} className="px-3 py-2 bg-gray-50 border-y border-gray-200">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <span className="text-gray-500">▾</span>
                      {group.title}
                      <span className="rounded-full bg-white border border-gray-300 px-2 text-xs text-gray-500">
                        {group.items.length}
                      </span>
                    </div>
                  </td>
                </tr>

                {group.items.length === 0 && (
                  <tr
                    className="wo-list-empty-row"
                    onDragOver={(e) => {
                      if (!canRowDrag || !draggedTicket) return;
                      e.preventDefault();
                      setDropTarget({ status: group.status, index: 0 });
                    }}
                    onDrop={(e) => {
                      if (!canRowDrag || !draggedTicket) return;
                      e.preventDefault();
                      void handleDrop({ status: group.status, index: 0 });
                    }}
                  >
                    <td colSpan={7} className="px-4 py-4 text-xs text-gray-400 border-b border-gray-100">
                      {canRowDrag
                        ? 'Arrastra una orden aquí'
                        : 'No hay órdenes en esta sección'}
                    </td>
                  </tr>
                )}

                {group.items.map((t, idx) => {
                  const images = getTicketImagePaths(t.image ?? '');
                  const first = images[0];
                  const ticketId = Number(t.id);
                  const isDragged = draggedTicketId != null && draggedTicketId === ticketId;
                  const showDropLine =
                    dropTarget?.status === group.status && dropTarget.index === idx;

                  return (
                    <Fragment key={t.id}>
                      {showDropLine && (
                        <tr className="wo-list-drop-row" aria-hidden="true">
                          <td colSpan={7} className="px-3 py-0 border-b border-transparent">
                            <div className="wo-drop-line" />
                          </td>
                        </tr>
                      )}

                      <tr
                        className={`wo-list-row hover:bg-indigo-50/40 transition cursor-pointer ${
                          isDragged ? 'opacity-60' : ''
                        }`}
                        onClick={() => {
                          if (Date.now() < suppressClickUntilRef.current) return;
                          onOpen?.(t);
                        }}
                        onDragOver={(e) => {
                          if (!canRowDrag || !draggedTicket) return;
                          e.preventDefault();
                          setDropTarget({ status: group.status, index: idx });
                        }}
                        onDrop={(e) => {
                          if (!canRowDrag || !draggedTicket) return;
                          e.preventDefault();
                          void handleDrop({ status: group.status, index: idx });
                        }}
                      >
                        <td className="px-3 py-1.5 border-b border-gray-100 align-middle">
                          <div
                            className="wo-list-actions flex items-center gap-1"
                            data-list-actions="1"
                          >
                            <button
                              type="button"
                              draggable={canRowDrag}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onDragStart={(e) => {
                                e.stopPropagation();
                                if (!canRowDrag) return;
                                suppressClickUntilRef.current = Date.now() + 250;
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', String(t.id));
                                setDraggedTicketId(ticketId);
                                setDraggedTicket(t);
                                setDropTarget({ status: group.status, index: idx });
                              }}
                              onDragEnd={(e) => {
                                e.stopPropagation();
                                suppressClickUntilRef.current = Date.now() + 250;
                                clearDragState();
                              }}
                              className={`wo-ticket-action-btn ${
                                canRowDrag ? '' : 'wo-ticket-action-btn--disabled'
                              }`}
                              title={
                                !canMoveCards
                                  ? 'No tienes permiso para mover tareas'
                                  : movingTicketId !== null
                                    ? 'Espera a que termine el movimiento'
                                    : 'Arrastrar tarea'
                              }
                              aria-label="Arrastrar tarea"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                                <path d="M8 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3Zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3Zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3Zm8-14a1.5 1.5 0 110-3 1.5 1.5 0 010 3Zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3Zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3Z" />
                              </svg>
                            </button>

                            <div className="relative">
                              <button
                                type="button"
                                className="wo-ticket-action-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSectionMenuTicketId((prev) =>
                                    prev === ticketId ? null : ticketId
                                  );
                                }}
                                title="Mover entre secciones"
                                aria-label="Mover entre secciones"
                              >
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7l4-4 4 4m-4-4v18" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 17l-4 4-4-4m4 4V3" />
                                </svg>
                              </button>

                              {sectionMenuTicketId === ticketId && (
                                <div className="wo-section-menu absolute left-0 top-9 z-20 min-w-[190px] rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
                                  {STATUS_ORDER.map((option) => {
                                    const isCurrent = option === t.status;
                                    return (
                                      <button
                                        key={option}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSectionMenuTicketId(null);
                                          void handleMoveBetweenSections(t, option);
                                        }}
                                        className={`wo-section-menu-item flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                                          isCurrent
                                            ? 'bg-indigo-50 text-indigo-700'
                                            : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                      >
                                        <span className="w-4 text-center text-sm">
                                          {isCurrent ? '✓' : ''}
                                        </span>
                                        <span>{option}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              className="wo-ticket-action-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpen?.(t);
                              }}
                              title="Abrir tarea"
                              aria-label="Abrir tarea"
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h9v9" />
                              </svg>
                            </button>
                          </div>
                        </td>

                        <td className="px-3 py-1.5 border-b border-gray-100">
                          <div className="flex items-center gap-2 min-w-[250px]">
                            {first ? (
                              <img
                                src={getPublicImageUrl(first)}
                                alt="Adjunto"
                                className="h-8 w-8 rounded-md object-cover border border-gray-200"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-md bg-gray-100 border border-gray-200" />
                            )}
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-gray-900 truncate">
                                {t.title}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                OT-{String(t.id).padStart(4, '0')}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-1.5 border-b border-gray-100 text-[13px] text-gray-700 whitespace-nowrap">
                          {t.incident_date ?? '—'}
                        </td>

                        <td className="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${priorityClass(
                              t.priority
                            )}`}
                          >
                            {t.priority?.[0]?.toUpperCase()}
                            {t.priority?.slice(1)}
                          </span>
                        </td>

                        <td className="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${statusClass(
                              t.status
                            )}`}
                          >
                            {t.status}
                          </span>
                        </td>

                        <td className="px-3 py-1.5 border-b border-gray-100 text-[13px] text-gray-600 whitespace-nowrap">
                          {t.location_name?.trim() ||
                            getLocationLabel(t.location_id, 'Sin ubicación')}
                        </td>

                        <td className="px-3 py-1.5 border-b border-gray-100 text-[13px] text-gray-700 whitespace-nowrap">
                          <AssigneeBadge
                            assigneeId={
                              (t as WorkOrderExtras).effective_assignee_id ??
                              (t as WorkOrderExtras).primary_assignee_id ??
                              (t as Ticket).assignee_id ??
                              null
                            }
                            size="xs"
                          />
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}

                {dropTarget?.status === group.status &&
                  dropTarget.index === group.items.length && (
                    <tr className="wo-list-drop-row" aria-hidden="true">
                      <td colSpan={7} className="px-3 py-0 border-b border-transparent">
                        <div className="wo-drop-line" />
                      </td>
                    </tr>
                  )}

                <tr
                  className="wo-list-drop-zone"
                  onDragOver={(e) => {
                    if (!canRowDrag || !draggedTicket) return;
                    e.preventDefault();
                    setDropTarget({ status: group.status, index: group.items.length });
                  }}
                  onDrop={(e) => {
                    if (!canRowDrag || !draggedTicket) return;
                    e.preventDefault();
                    void handleDrop({
                      status: group.status,
                      index: group.items.length,
                    });
                  }}
                >
                  <td colSpan={7} className="p-0 h-1" />
                </tr>
              </Fragment>
            ))
          )}
        </tbody>
      </table>

      <div className="wo-list-footer flex justify-end gap-2 p-3 border-t border-gray-200 bg-gray-50/80">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-gray-100 disabled:hover:bg-white"
        >
          Anterior
        </button>
        <button
          onClick={() =>
            setPage((p) => (p + 1 < Math.ceil(count / PAGE_SIZE) ? p + 1 : p))
          }
          disabled={page + 1 >= Math.ceil(count / PAGE_SIZE)}
          className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-indigo-500 disabled:hover:bg-indigo-600"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
