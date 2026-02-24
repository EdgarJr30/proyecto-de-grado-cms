import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import EditTicketModal from './EditWorkOrdersModal';
import {
  updateTicket,
  moveWorkOrderStatus,
  getTicketCountsRPC,
  getTicketsByWorkOrdersFiltersPaginated,
  getArchivedWorkOrdersByFiltersPaginated,
} from '../../../services/ticketService';
import {
  getAllSpecialIncidents,
  makeSpecialIncidentMap,
} from '../../../services/specialIncidentsService';
import type { Ticket, WorkOrder } from '../../../types/Ticket';
import type { SpecialIncident } from '../../../types/SpecialIncident';
import type { FilterState } from '../../../types/filters';
import type { WorkOrdersFilterKey } from '../../../features/tickets/WorkOrdersFilters';
import WorkOrdersColumn from './WorkOrdersColumn';
import Modal from '../../ui/Modal';
import { showToastError } from '../../../notifications/toast';
import { useCan } from '../../../rbac/PermissionsContext';
import { useLocationCatalog } from '../../../hooks/useLocationCatalog';

const STATUSES: Ticket['status'][] = [
  'Pendiente',
  'En Ejecución',
  'Finalizadas',
];
const BOARD_PAGE_SIZE = 200;
const MAX_BOARD_PAGES = 8;
const MANUAL_ORDER_STORAGE_KEY = 'work_orders_manual_order_v1';

type BoardGroupMode = 'manual' | 'dateAsc' | 'dateDesc';
type ColumnStatus = Ticket['status'] | 'Archivadas';

type ManualOrderMap = Record<Ticket['status'], number[]>;

type TicketDropTarget = {
  targetStatus: ColumnStatus;
  targetIndex: number;
};

interface Props {
  filters?: FilterState<WorkOrdersFilterKey>;
  groupMode: BoardGroupMode;
  showArchivedColumn: boolean;
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

function parseSafeDate(input?: string | null): number {
  if (!input) return Number.NaN;
  const parsed = Date.parse(input);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function compareByIncidentDate(a: WorkOrder, b: WorkOrder, mode: BoardGroupMode) {
  const aDate = parseSafeDate(a.incident_date);
  const bDate = parseSafeDate(b.incident_date);

  if (!Number.isNaN(aDate) && !Number.isNaN(bDate) && aDate !== bDate) {
    return mode === 'dateAsc' ? aDate - bDate : bDate - aDate;
  }

  if (!Number.isNaN(aDate) && Number.isNaN(bDate)) {
    return -1;
  }

  if (Number.isNaN(aDate) && !Number.isNaN(bDate)) {
    return 1;
  }

  return Number(b.id) - Number(a.id);
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

function cloneManualOrder(order: ManualOrderMap): ManualOrderMap {
  return {
    Pendiente: [...order.Pendiente],
    'En Ejecución': [...order['En Ejecución']],
    Finalizadas: [...order.Finalizadas],
  };
}

function normalizeManualOrderWithRows(
  previous: ManualOrderMap,
  rows: WorkOrder[]
): ManualOrderMap {
  const groupedIds: ManualOrderMap = emptyManualOrder();

  rows.forEach((row) => {
    const rowId = Number(row.id);
    if (!rowId) return;
    groupedIds[row.status].push(rowId);
  });

  const next = emptyManualOrder();

  STATUSES.forEach((status) => {
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
  const next = cloneManualOrder(previous);

  next[sourceStatus] = next[sourceStatus].filter((id) => id !== ticketId);
  next[targetStatus] = next[targetStatus].filter((id) => id !== ticketId);

  const clampedTargetIndex = Math.max(
    0,
    Math.min(targetIndex, next[targetStatus].length)
  );

  next[targetStatus].splice(clampedTargetIndex, 0, ticketId);
  return next;
}

export default function WorkOrdersBoard({
  filters,
  groupMode,
  showArchivedColumn,
}: Props) {
  const { getLocationLabel } = useLocationCatalog({
    includeInactive: true,
    activeOnlyOptions: false,
  });
  const [selectedTicket, setSelectedTicket] = useState<WorkOrder | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [specialIncidentsById, setSpecialIncidentsById] = useState<
    Record<number, SpecialIncident>
  >({});
  const [boardTickets, setBoardTickets] = useState<WorkOrder[]>([]);
  const [archivedTickets, setArchivedTickets] = useState<WorkOrder[]>([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [manualOrderByStatus, setManualOrderByStatus] =
    useState<ManualOrderMap>(() => readManualOrderFromStorage());
  const [counts, setCounts] = useState<Record<Ticket['status'], number>>({
    Pendiente: 0,
    'En Ejecución': 0,
    Finalizadas: 0,
  });
  const [draggedTicket, setDraggedTicket] = useState<WorkOrder | null>(null);
  const [movingTicketId, setMovingTicketId] = useState<number | null>(null);
  const canMoveCards = useCan('work_orders:full_access');

  type WorkOrderWithSpecialIncident = WorkOrder & {
    special_incident_id?: number | null;
  };

  const filtersRef = useRef<FilterState<WorkOrdersFilterKey> | undefined>(
    filters
  );

  const refreshCountsTimeout = useRef<number | null>(null);
  const refreshBoardTimeout = useRef<number | null>(null);
  const suppressRealtimeUntilRef = useRef<Record<number, number>>({});

  const countsFilters = useMemo(
    () => ({
      term:
        typeof (filters as Record<string, unknown> | undefined)?.q === 'string'
          ? ((filters as Record<string, unknown>).q as string).trim() ||
            undefined
          : undefined,
      location_id:
        typeof (filters as Record<string, unknown> | undefined)?.location_id ===
        'string'
          ? ((filters as Record<string, unknown>).location_id as string)
          : undefined,
    }),
    [filters]
  );

  const countsFiltersRef = useRef(countsFilters);
  const filtersKey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);
  const countsFiltersKey = useMemo(
    () => JSON.stringify(countsFilters),
    [countsFilters]
  );

  const ticketById = useMemo(() => {
    const map = new Map<number, WorkOrder>();
    [...boardTickets, ...archivedTickets].forEach((ticket) => {
      const idNum = Number(ticket.id);
      if (idNum) {
        map.set(idNum, ticket);
      }
    });
    return map;
  }, [boardTickets, archivedTickets]);

  const orderedTicketsByStatus = useMemo(() => {
    const grouped: Record<Ticket['status'], WorkOrder[]> = {
      Pendiente: [],
      'En Ejecución': [],
      Finalizadas: [],
    };

    boardTickets.forEach((ticket) => {
      grouped[ticket.status].push(ticket);
    });

    if (groupMode === 'manual') {
      return STATUSES.reduce(
        (acc, status) => {
          const ids = manualOrderByStatus[status];
          const localMap = new Map<number, WorkOrder>();
          grouped[status].forEach((ticket) => {
            localMap.set(Number(ticket.id), ticket);
          });

          const ordered = ids
            .map((id) => localMap.get(id))
            .filter((ticket): ticket is WorkOrder => Boolean(ticket));

          const missing = grouped[status].filter(
            (ticket) => !ids.includes(Number(ticket.id))
          );

          acc[status] = [...ordered, ...missing];
          return acc;
        },
        {
          Pendiente: [] as WorkOrder[],
          'En Ejecución': [] as WorkOrder[],
          Finalizadas: [] as WorkOrder[],
        }
      );
    }

    return STATUSES.reduce(
      (acc, status) => {
        acc[status] = [...grouped[status]].sort((a, b) =>
          compareByIncidentDate(a, b, groupMode)
        );
        return acc;
      },
      {
        Pendiente: [] as WorkOrder[],
        'En Ejecución': [] as WorkOrder[],
        Finalizadas: [] as WorkOrder[],
      }
    );
  }, [boardTickets, manualOrderByStatus, groupMode]);

  const orderedArchivedTickets = useMemo(() => {
    if (groupMode === 'manual') {
      return [...archivedTickets].sort((a, b) => Number(b.id) - Number(a.id));
    }
    return [...archivedTickets].sort((a, b) =>
      compareByIncidentDate(a, b, groupMode)
    );
  }, [archivedTickets, groupMode]);

  const boardColumns = useMemo<ColumnStatus[]>(
    () =>
      showArchivedColumn
        ? [...STATUSES, 'Archivadas']
        : [...STATUSES],
    [showArchivedColumn]
  );

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    countsFiltersRef.current = countsFilters;
  }, [countsFilters]);

  useEffect(() => {
    persistManualOrder(manualOrderByStatus);
  }, [manualOrderByStatus]);

  const loadBoardTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const merged: WorkOrder[] = [];
      const activeFilters = (filtersRef.current ?? {}) as FilterState<string>;

      for (let page = 0; page < MAX_BOARD_PAGES; page += 1) {
        const { data } = await getTicketsByWorkOrdersFiltersPaginated(
          activeFilters,
          page,
          BOARD_PAGE_SIZE
        );

        merged.push(...((data ?? []) as WorkOrder[]));

        if (!data || data.length < BOARD_PAGE_SIZE) {
          break;
        }
      }

      const uniqueById = Array.from(
        new Map(merged.map((ticket) => [Number(ticket.id), ticket])).values()
      );

      setBoardTickets(uniqueById);
      setManualOrderByStatus((prev) => normalizeManualOrderWithRows(prev, uniqueById));

      if (!showArchivedColumn) {
        setArchivedTickets([]);
        setArchivedCount(0);
      } else {
        const archivedMerged: WorkOrder[] = [];
        let archivedTotal = 0;

        for (let page = 0; page < MAX_BOARD_PAGES; page += 1) {
          const { data, count } = await getArchivedWorkOrdersByFiltersPaginated(
            activeFilters,
            page,
            BOARD_PAGE_SIZE
          );

          if (page === 0) {
            archivedTotal = count ?? 0;
          }

          archivedMerged.push(...((data ?? []) as WorkOrder[]));

          if (!data || data.length < BOARD_PAGE_SIZE) {
            break;
          }
        }

        const uniqueArchived = Array.from(
          new Map(
            archivedMerged.map((ticket) => [Number(ticket.id), ticket])
          ).values()
        );

        setArchivedTickets(uniqueArchived);
        setArchivedCount(archivedTotal || uniqueArchived.length);
      }
    } finally {
      setIsLoading(false);
    }
  }, [showArchivedColumn]);

  const scheduleCountsRefresh = useCallback(() => {
    if (refreshCountsTimeout.current) {
      window.clearTimeout(refreshCountsTimeout.current);
    }

    refreshCountsTimeout.current = window.setTimeout(async () => {
      const c = await getTicketCountsRPC(countsFiltersRef.current);
      setCounts(c);
      refreshCountsTimeout.current = null;
    }, 220);
  }, []);

  const scheduleBoardRefresh = useCallback(() => {
    if (refreshBoardTimeout.current) {
      window.clearTimeout(refreshBoardTimeout.current);
    }

    refreshBoardTimeout.current = window.setTimeout(async () => {
      await loadBoardTickets();
      refreshBoardTimeout.current = null;
    }, 420);
  }, [loadBoardTickets]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await getTicketCountsRPC(countsFilters);
      if (alive) {
        setCounts(c);
      }
    })();

    return () => {
      alive = false;
    };
  }, [countsFiltersKey, countsFilters]);

  useEffect(() => {
    void loadBoardTickets();
  }, [filtersKey, loadBoardTickets]);

  // Cargar todas (activas e inactivas) y mapear por id
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getAllSpecialIncidents();
        if (!cancelled) setSpecialIncidentsById(makeSpecialIncidentMap(list));
      } catch {
        // noop
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('tickets-changes-WorkOrdersBoard')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets' },
        (payload) => {
          const oldRow = payload.old as Ticket;
          const newRow = payload.new as Ticket;
          const changedId = Number(newRow.id ?? 0);
          const suppressUntil = suppressRealtimeUntilRef.current[changedId] ?? 0;
          if (changedId && suppressUntil > Date.now()) {
            return;
          }
          if (changedId && suppressUntil <= Date.now()) {
            delete suppressRealtimeUntilRef.current[changedId];
          }

          const countRelevantChanged =
            oldRow.status !== newRow.status ||
            oldRow.is_accepted !== newRow.is_accepted ||
            oldRow.location_id !== newRow.location_id ||
            oldRow.is_archived !== newRow.is_archived;

          if (countRelevantChanged) {
            scheduleCountsRefresh();
          }

          scheduleBoardRefresh();
        }
      )
      .subscribe();

    return () => {
      try {
        void channel.unsubscribe();
      } catch {
        // noop
      }
    };
  }, [scheduleCountsRefresh, scheduleBoardRefresh]);

  useEffect(() => {
    return () => {
      if (refreshCountsTimeout.current) {
        window.clearTimeout(refreshCountsTimeout.current);
      }
      if (refreshBoardTimeout.current) {
        window.clearTimeout(refreshBoardTimeout.current);
      }
    };
  }, []);

  function renderSpecialIncidentChip(specialIncidentId?: number | null) {
    if (!specialIncidentId) return null;
    const specialIncident = specialIncidentsById[Number(specialIncidentId)];
    if (!specialIncident) return null;
    return (
      <span className="ml-1 inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
        {specialIncident.name}
      </span>
    );
  }

  const openModal = (ticket: WorkOrder) => {
    setSelectedTicket(ticket);
    setModalOpen(true);
  };

  const closeModal = () => {
    setSelectedTicket(null);
    setModalOpen(false);
  };

  const patchTicketInBoard = useCallback((ticketId: number, patch: Partial<WorkOrder>) => {
    setBoardTickets((rows) =>
      rows.map((row) =>
        Number(row.id) === ticketId ? ({ ...row, ...patch } as WorkOrder) : row
      )
    );
  }, []);

  const patchTicketInArchived = useCallback(
    (ticketId: number, patch: Partial<WorkOrder>) => {
      setArchivedTickets((rows) =>
        rows.map((row) =>
          Number(row.id) === ticketId
            ? ({ ...row, ...patch } as WorkOrder)
            : row
        )
      );
    },
    []
  );

  const handleSave = async (patch: Partial<WorkOrder>) => {
    try {
      const patchId = Number(patch.id ?? selectedTicket?.id ?? 0);
      if (!patchId) throw new Error('ID de ticket inválido.');

      const previous = ticketById.get(patchId) ?? selectedTicket;
      if (!previous) throw new Error('No se encontró la orden a actualizar.');

      const updatePayload: Partial<Ticket> = {};
      if ('comments' in patch) updatePayload.comments = patch.comments ?? undefined;
      if ('assignee_id' in patch) updatePayload.assignee_id = patch.assignee_id;
      if ('priority' in patch) {
        updatePayload.priority = patch.priority as Ticket['priority'];
      }
      if ('status' in patch) {
        updatePayload.status = patch.status as Ticket['status'];
      }
      if ('is_urgent' in patch) updatePayload.is_urgent = Boolean(patch.is_urgent);
      if ('deadline_date' in patch) {
        updatePayload.deadline_date = patch.deadline_date ?? undefined;
      }
      if ('is_archived' in patch && typeof patch.is_archived === 'boolean') {
        updatePayload.is_archived = patch.is_archived;
      }

      if (Object.keys(updatePayload).length > 0) {
        await updateTicket(patchId, updatePayload);
      }

      const nextTicket = { ...previous, ...patch } as WorkOrder;
      const nextStatus = (patch.status as Ticket['status']) ?? previous.status;
      const archiveStateChanged =
        typeof patch.is_archived === 'boolean' &&
        patch.is_archived !== previous.is_archived;

      if (archiveStateChanged) {
        if (patch.is_archived) {
          setBoardTickets((rows) => rows.filter((row) => Number(row.id) !== patchId));
          setArchivedTickets((rows) => [{ ...nextTicket, is_archived: true }, ...rows]);
        } else {
          setArchivedTickets((rows) =>
            rows.filter((row) => Number(row.id) !== patchId)
          );
          setBoardTickets((rows) => [{ ...nextTicket, is_archived: false }, ...rows]);
        }

        await loadBoardTickets();
        scheduleCountsRefresh();
        setModalOpen(false);
        setSelectedTicket(null);
        return;
      }

      if (previous.is_archived) {
        patchTicketInArchived(patchId, patch);
      } else {
        patchTicketInBoard(patchId, patch);
      }

      if (previous.status !== nextStatus) {
        setManualOrderByStatus((prev) =>
          moveIdWithinOrder(prev, patchId, previous.status, nextStatus, 0)
        );
      }

      scheduleCountsRefresh();
      setModalOpen(false);
      setSelectedTicket(null);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showToastError(`No se pudo actualizar el ticket. ${msg}`);
    }
  };

  const handleDragStartTicket = (ticket: Ticket) => {
    if (!canMoveCards || movingTicketId !== null || ticket.is_archived) {
      return;
    }
    setDraggedTicket(ticket as WorkOrder);
  };

  const handleDragEndTicket = () => {
    setDraggedTicket(null);
  };

  const moveTicket = useCallback(
    async (
      ticket: WorkOrder,
      targetStatus: Ticket['status'],
      targetIndex: number
    ) => {
      const ticketId = Number(ticket.id);
      if (!ticketId || movingTicketId !== null || ticket.is_archived) return;

      const sourceStatus = ticket.status;
      const statusChanged = sourceStatus !== targetStatus;
      const manualMode = groupMode === 'manual';

      if (!manualMode && !statusChanged) {
        setDraggedTicket(null);
        return;
      }

      const previousRows = boardTickets;
      const previousOrder = manualOrderByStatus;

      setDraggedTicket(null);
      setMovingTicketId(ticketId);
      suppressRealtimeUntilRef.current[ticketId] = Date.now() + 3000;

      setBoardTickets((rows) =>
        rows.map((row) =>
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
          scheduleCountsRefresh();
        }
      } catch (error: unknown) {
        setBoardTickets(previousRows);
        setManualOrderByStatus(previousOrder);
        const msg = error instanceof Error ? error.message : String(error);
        showToastError(`No se pudo mover la orden. ${msg}`);
      } finally {
        setMovingTicketId(null);
      }
    },
    [
      boardTickets,
      groupMode,
      manualOrderByStatus,
      movingTicketId,
      scheduleCountsRefresh,
      setBoardTickets,
      setManualOrderByStatus,
    ]
  );

  const handleDropTicket = async ({
    targetStatus,
    targetIndex,
  }: TicketDropTarget) => {
    if (!canMoveCards) return;
    if (targetStatus === 'Archivadas') return;
    const ticket = draggedTicket;
    if (!ticket) return;

    await moveTicket(ticket, targetStatus, targetIndex);
  };

  useEffect(() => {
    setManualOrderByStatus((prev) => normalizeManualOrderWithRows(prev, boardTickets));
  }, [boardTickets]);

  return (
    <div className="wo-board-layout flex gap-3 h-full w-full overflow-x-auto pb-2">
      {boardColumns.map((status) => (
        <WorkOrdersColumn
          key={status}
          status={status}
          isLoading={isLoading}
          tickets={
            status === 'Archivadas'
              ? orderedArchivedTickets
              : (orderedTicketsByStatus[status] ?? [])
          }
          onOpenModal={openModal}
          getPriorityStyles={(priority) => {
            const styles: Record<Ticket['priority'], string> = {
              Baja: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              Media: 'bg-amber-50 text-amber-700 border-amber-200',
              Alta: 'bg-rose-50 text-rose-700 border-rose-200',
            };
            return (
              styles[priority] || 'bg-gray-100 text-gray-800 border-gray-200'
            );
          }}
          getStatusStyles={(s) => {
            const styles: Record<ColumnStatus, string> = {
              Pendiente: 'bg-amber-50 text-amber-800 border-amber-200',
              'En Ejecución': 'bg-sky-50 text-sky-800 border-sky-200',
              Finalizadas: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              Archivadas: 'bg-slate-50 text-slate-700 border-slate-300',
            };
            return styles[s] || 'bg-gray-100 text-gray-800 border-gray-200';
          }}
          capitalize={(w) =>
            typeof w === 'string' ? w[0].toUpperCase() + w.slice(1) : ''
          }
          count={status === 'Archivadas' ? archivedCount : counts[status]}
          getLocationLabel={getLocationLabel}
          canDragDrop={
            status !== 'Archivadas' && canMoveCards && movingTicketId === null
          }
          draggedTicketId={draggedTicket ? Number(draggedTicket.id) : null}
          onDragStartTicket={handleDragStartTicket}
          onDragEndTicket={handleDragEndTicket}
          onDropTicketAt={handleDropTicket}
          getSpecialIncidentAdornment={(t) => {
            const siId = (t as WorkOrderWithSpecialIncident)
              .special_incident_id;
            const chip = renderSpecialIncidentChip(siId);
            return chip ? (
              <span className="inline-flex items-center gap-1 ml-1">
                {chip}
                <span
                  role="img"
                  aria-label="incidente especial"
                  title="Incidente especial"
                >
                  🚨
                </span>
              </span>
            ) : null;
          }}
        />
      ))}

      <Modal isOpen={modalOpen} onClose={closeModal} isLocked={showFullImage}>
        {selectedTicket && (
          <EditTicketModal
            isOpen={modalOpen}
            onClose={closeModal}
            ticket={selectedTicket}
            onSave={handleSave}
            showFullImage={showFullImage}
            setShowFullImage={setShowFullImage}
            forceReadOnly={Boolean(selectedTicket?.is_archived)}
            getSpecialIncidentAdornment={(t) => {
              const siId = (
                t as WorkOrder & { special_incident_id?: number | null }
              ).special_incident_id;
              const chip = renderSpecialIncidentChip(siId);
              return chip ? (
                <span className="inline-flex items-center gap-1 ml-1">
                  {chip}
                  <span
                    role="img"
                    aria-label="incidente especial"
                    title="Incidente especial"
                  >
                    🚨
                  </span>
                </span>
              ) : null;
            }}
          />
        )}
      </Modal>
    </div>
  );
}
