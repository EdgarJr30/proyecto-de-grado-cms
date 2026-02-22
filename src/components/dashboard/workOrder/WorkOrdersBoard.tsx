import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import EditTicketModal from './EditWorkOrdersModal';
import {
  updateTicket,
  moveWorkOrderStatus,
  getTicketCountsRPC,
  getTicketsByWorkOrdersFiltersPaginated,
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
const FILTERED_LIMIT = 200;

interface Props {
  filters?: FilterState<WorkOrdersFilterKey>;
}

export default function WorkOrdersBoard({ filters }: Props) {
  const { getLocationLabel } = useLocationCatalog({
    includeInactive: true,
    activeOnlyOptions: false,
  });
  const [selectedTicket, setSelectedTicket] = useState<WorkOrder | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedTicket, setLastUpdatedTicket] = useState<WorkOrder | null>(
    null
  );
  const [specialIncidentsById, setSpecialIncidentsById] = useState<
    Record<number, SpecialIncident>
  >({});
  const [filteredTickets, setFilteredTickets] = useState<WorkOrder[]>([]);
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

  const loadedColumns = useRef(0);
  const filtersRef = useRef<FilterState<WorkOrdersFilterKey> | undefined>(
    filters
  );
  const isFilteringRef = useRef(false);

  /** ¿Hay filtros activos? */
  const isFiltering = useMemo(() => {
    const f = (filters ?? {}) as Record<string, unknown>;
    return Object.keys(f).some((k) => {
      const val = f[k];
      if (val === undefined || val === null || val === '') return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    });
  }, [filters]);

  /** Normalización segura para la RPC de conteos */
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

  const filtersKey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);
  const countsFiltersKey = useMemo(
    () => JSON.stringify(countsFilters),
    [countsFilters]
  );
  const countsFiltersRef = useRef(countsFilters);
  const toId = (value: string | number | undefined | null) =>
    Number(value ?? 0);

  useEffect(() => {
    countsFiltersRef.current = countsFilters;
  }, [countsFilters]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    isFilteringRef.current = isFiltering;
  }, [isFiltering]);

  // Componente/función para pintar el chip
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

  const loadFilteredTickets = useCallback(async () => {
    const { data } = await getTicketsByWorkOrdersFiltersPaginated(
      (filtersRef.current ?? {}) as FilterState<string>,
      0,
      FILTERED_LIMIT
    );
    setFilteredTickets((data ?? []) as WorkOrder[]);
  }, []);

  /** Carga cuando hay filtros (una sola query y se reparte por columnas) */
  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      if (isFiltering) {
        const { data } = await getTicketsByWorkOrdersFiltersPaginated(
          (filtersRef.current ?? {}) as FilterState<string>,
          0,
          FILTERED_LIMIT
        );
        if (alive) setFilteredTickets((data ?? []) as WorkOrder[]);
      } else {
        setFilteredTickets([]);
        setReloadKey((p) => p + 1); // fuerza recarga de columnas con paginación local
      }
      setIsLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [isFiltering, filtersKey]);

  /** Conteos (badges) */
  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await getTicketCountsRPC(countsFilters);
      if (alive) setCounts(c);
    })();
    return () => {
      alive = false;
    };
  }, [countsFiltersKey, countsFilters]);

  //Cargar todas (activas e inactivas) y mapear por id
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getAllSpecialIncidents(); // trae activas e inactivas
        if (!cancelled) setSpecialIncidentsById(makeSpecialIncidentMap(list));
      } catch {
        // opcional: console.error('No se pudieron cargar los incidentes especiales');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Debounce para reconciliar badges con la BD vía RPC */
  const refreshTimeout = useRef<number | null>(null);
  const filteredRefreshTimeout = useRef<number | null>(null);
  const scheduleCountsRefresh = useCallback(() => {
    if (refreshTimeout.current) window.clearTimeout(refreshTimeout.current);
    refreshTimeout.current = window.setTimeout(async () => {
      const c = await getTicketCountsRPC(countsFiltersRef.current);
      setCounts(c);
      refreshTimeout.current = null;
    }, 220);
  }, []);

  const scheduleFilteredRefresh = useCallback(() => {
    if (filteredRefreshTimeout.current) {
      window.clearTimeout(filteredRefreshTimeout.current);
    }
    filteredRefreshTimeout.current = window.setTimeout(async () => {
      if (isFilteringRef.current) {
        await loadFilteredTickets();
      }
      filteredRefreshTimeout.current = null;
    }, 500);
  }, [loadFilteredTickets]);

  /** Modal */
  const openModal = (ticket: WorkOrder) => {
    setSelectedTicket(ticket);
    setModalOpen(true);
  };
  const closeModal = () => {
    setSelectedTicket(null);
    setModalOpen(false);
  };

  /** Guardar cambios desde el modal (conservando extras en memoria) */
  const handleSave = async (patch: Partial<WorkOrder>) => {
    try {
      const prev = (selectedTicket as WorkOrder) || (patch as WorkOrder);
      const patchId = toId(patch.id as string | number | undefined);
      if (!patchId) throw new Error('ID de ticket inválido.');

      await updateTicket(patchId, {
        comments: patch.comments ?? undefined,
        assignee_id: patch.assignee_id ?? undefined,
        priority: patch.priority as Ticket['priority'],
        status: patch.status as Ticket['status'],
        is_urgent: !!patch.is_urgent,
        deadline_date: patch.deadline_date ?? undefined,
      });

      // ✅ Usa el ticket base (prev) y mezcla el patch para NO perder extras como special_incident_id
      const baseline =
        (selectedTicket as WorkOrder) ??
        (filteredTickets.find((r) => toId(r.id) === patchId) as WorkOrder) ??
        (lastUpdatedTicket as WorkOrder) ??
        (patch as WorkOrder);

      setLastUpdatedTicket({ ...baseline, ...(patch as WorkOrder) });

      // (esto ya estaba bien: en modo filtrado mezclas contra el row existente)
      setFilteredTickets((rows) =>
        rows.map((r) =>
          toId(r.id) === patchId
            ? ({ ...r, ...(patch as WorkOrder) } as WorkOrder)
            : r
        )
      );

      setModalOpen(false);
      setSelectedTicket(null);

      const nextTicket = {
        ...(prev as WorkOrder),
        ...(patch as WorkOrder),
      } as Ticket;
      const affected =
        prev.status !== nextTicket.status ||
        prev.is_accepted !== nextTicket.is_accepted ||
        prev.location_id !== nextTicket.location_id;

      if (affected) {
        scheduleCountsRefresh();
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('❌ Error al actualizar el ticket:', error.message);
        showToastError(
          `No se pudo actualizar el ticket. Intenta de nuevo. ${error.message}`
        );
      } else {
        console.error('❌ Error desconocido:', error);
        showToastError(
          `No se pudo actualizar el ticket. Intenta de nuevo. ${error}`
        );
      }
    }
  };

  const handleDragStartTicket = (ticket: Ticket) => {
    if (!canMoveCards || movingTicketId !== null) return;
    setDraggedTicket(ticket as WorkOrder);
  };

  const handleDragEndTicket = () => {
    setDraggedTicket(null);
  };

  const handleDropTicketInColumn = async (targetStatus: Ticket['status']) => {
    if (!canMoveCards || movingTicketId !== null) return;

    const ticket = draggedTicket;
    setDraggedTicket(null);
    if (!ticket) return;

    const ticketId = toId(ticket.id);
    if (!ticketId) return;
    if (ticket.status === targetStatus) return;

    const previousTicket = ticket as Ticket;
    const optimisticTicket = {
      ...ticket,
      status: targetStatus,
    } as WorkOrder;

    if (!isFilteringRef.current) {
      setLastUpdatedTicket(optimisticTicket);
    }
    setMovingTicketId(ticketId);

    try {
      await moveWorkOrderStatus(ticketId, targetStatus);
      if (isFilteringRef.current) {
        await loadFilteredTickets();
      }
    } catch (error: unknown) {
      const rollbackTicket = {
        ...ticket,
        status: previousTicket.status,
      } as WorkOrder;
      if (!isFilteringRef.current) {
        setLastUpdatedTicket(rollbackTicket);
      } else {
        await loadFilteredTickets();
      }

      const msg = error instanceof Error ? error.message : String(error);
      showToastError(`No se pudo mover la orden. ${msg}`);
    } finally {
      scheduleCountsRefresh();
      setMovingTicketId(null);
    }
  };

  /** Sincroniza la animación del loader por columnas */
  const handleColumnLoaded = () => {
    loadedColumns.current += 1;
    if (loadedColumns.current >= STATUSES.length) setIsLoading(false);
  };
  useEffect(() => {
    loadedColumns.current = 0;
    setIsLoading(true);
  }, [reloadKey]);

  /** Realtime: sincroniza badges + cards entre usuarios */
  useEffect(() => {
    const channel = supabase
      .channel('tickets-changes-WorkOrdersBoard')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets' },
        (payload) => {
          const oldRow = payload.old as Ticket;
          const newRow = payload.new as Ticket;
          const countRelevantChanged =
            oldRow.status !== newRow.status ||
            oldRow.is_accepted !== newRow.is_accepted ||
            oldRow.location_id !== newRow.location_id ||
            oldRow.is_archived !== newRow.is_archived;

          if (countRelevantChanged) {
            scheduleCountsRefresh();
          }

          if (isFilteringRef.current) {
            scheduleFilteredRefresh();
            return;
          }

          const nextTicket =
            newRow.is_accepted && !newRow.is_archived
              ? (newRow as WorkOrder)
              : ({ ...newRow, is_archived: true } as WorkOrder);
          setLastUpdatedTicket(nextTicket);
        }
      )
      .subscribe();

    return () => {
      // ❇️ Importante: NO await aquí y NO removeChannel
      try {
        void channel.unsubscribe();
      } catch {
        // ignorar errores de desconexión si el socket no llegó a abrir
      }
    };
  }, [scheduleCountsRefresh, scheduleFilteredRefresh]);

  useEffect(() => {
    return () => {
      if (refreshTimeout.current) window.clearTimeout(refreshTimeout.current);
      if (filteredRefreshTimeout.current) {
        window.clearTimeout(filteredRefreshTimeout.current);
      }
    };
  }, []);

  return (
    <div className="wo-board-layout flex gap-4 h-full w-full overflow-x-auto pb-2">
      {STATUSES.map((status) => (
        <WorkOrdersColumn
          key={status}
          status={status}
          isSearching={isFiltering}
          isFiltering={isFiltering}
          tickets={
            isFiltering
              ? filteredTickets.filter((t) => t.status === status)
              : undefined
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
            const styles: Record<Ticket['status'], string> = {
              Pendiente: 'bg-amber-50 text-amber-800 border-amber-200',
              'En Ejecución': 'bg-sky-50 text-sky-800 border-sky-200',
              Finalizadas: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            };
            return styles[s] || 'bg-gray-100 text-gray-800 border-gray-200';
          }}
          capitalize={(w) =>
            typeof w === 'string' ? w[0].toUpperCase() + w.slice(1) : ''
          }
          isLoading={isLoading}
          onFirstLoad={handleColumnLoaded}
          reloadSignal={reloadKey}
          lastUpdatedTicket={lastUpdatedTicket as unknown as Ticket}
          selectedLocation={
            typeof (filters as Record<string, unknown> | undefined)
              ?.location_id === 'number'
              ? ((filters as Record<string, unknown>).location_id as number)
              : undefined
          }
          count={counts[status]}
          getLocationLabel={getLocationLabel}
          canDragDrop={canMoveCards && movingTicketId === null}
          draggedTicketId={draggedTicket ? toId(draggedTicket.id) : null}
          onDragStartTicket={handleDragStartTicket}
          onDragEndTicket={handleDragEndTicket}
          onDropTicketInColumn={handleDropTicketInColumn}
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
