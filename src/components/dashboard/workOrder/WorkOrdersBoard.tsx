import { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import EditTicketModal from './EditWorkOrdersModal';
import {
  updateTicket,
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

  type WorkOrderWithSpecialIncident = WorkOrder & {
    special_incident_id?: number | null;
  };

  const loadedColumns = useRef(0);

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
      location:
        typeof (filters as Record<string, unknown> | undefined)?.location ===
        'string'
          ? ((filters as Record<string, unknown>).location as string)
          : undefined,
    }),
    [filters]
  );

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

  /** Carga cuando hay filtros (una sola query y se reparte por columnas) */
  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      if (isFiltering) {
        const { data } = await getTicketsByWorkOrdersFiltersPaginated(
          (filters ?? {}) as FilterState<string>,
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
  }, [isFiltering, JSON.stringify(filters)]);

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
  }, [JSON.stringify(countsFilters)]);

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

  /** UI optimista para los badges */
  function bumpCountsLocal(oldTicket: Ticket, newTicket: Ticket) {
    setCounts((prev) => {
      const next = { ...prev };
      if (STATUSES.includes(oldTicket.status)) {
        next[oldTicket.status] = Math.max(0, (next[oldTicket.status] ?? 0) - 1);
      }
      if (STATUSES.includes(newTicket.status)) {
        next[newTicket.status] = (next[newTicket.status] ?? 0) + 1;
      }
      return next;
    });
  }

  /** Debounce para reconciliar con la BD vía RPC */
  const refreshTimeout = useRef<number | null>(null);
  function scheduleCountsRefresh() {
    if (refreshTimeout.current) window.clearTimeout(refreshTimeout.current);
    refreshTimeout.current = window.setTimeout(async () => {
      const c = await getTicketCountsRPC(countsFilters);
      setCounts(c);
      refreshTimeout.current = null;
    }, 1200);
  }

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

      await updateTicket(Number(patch.id), {
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
        (filteredTickets.find((r) => r.id === patch.id) as WorkOrder) ??
        (lastUpdatedTicket as WorkOrder) ??
        (patch as WorkOrder);

      setLastUpdatedTicket({ ...baseline, ...(patch as WorkOrder) });

      // (esto ya estaba bien: en modo filtrado mezclas contra el row existente)
      setFilteredTickets((rows) =>
        rows.map((r) =>
          r.id === patch.id
            ? ({ ...r, ...(patch as WorkOrder) } as WorkOrder)
            : r
        )
      );

      setModalOpen(false);
      setSelectedTicket(null);

      const affected =
        prev.status !== patch.status ||
        prev.is_accepted !== patch.is_accepted ||
        prev.location !== patch.location;

      if (affected) {
        bumpCountsLocal(prev as Ticket, patch as Ticket);
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

  /** Sincroniza la animación del loader por columnas */
  const handleColumnLoaded = () => {
    loadedColumns.current += 1;
    if (loadedColumns.current >= STATUSES.length) setIsLoading(false);
  };
  useEffect(() => {
    loadedColumns.current = 0;
    setIsLoading(true);
  }, [reloadKey]);

  /** Realtime: actualiza badges por delta */
  useEffect(() => {
    const channel = supabase
      .channel('tickets-changes-WorkOrdersBoard')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets' },
        (payload) => {
          const oldRow = payload.old as Ticket;
          const newRow = payload.new as Ticket;
          if (
            oldRow.status !== newRow.status ||
            oldRow.is_accepted !== newRow.is_accepted ||
            oldRow.location !== newRow.location ||
            oldRow.is_archived !== newRow.is_archived
          ) {
            bumpCountsLocal(oldRow, newRow);
            scheduleCountsRefresh();
          }
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
  }, []); // 👈 suscríbete una sola vez

  return (
    <div className="flex gap-6 h-full w-full overflow-x-auto">
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
              baja: 'bg-green-100 text-green-800 border-green-200',
              media: 'bg-yellow-100 text-yellow-800 border-yellow-200',
              alta: 'bg-orange-100 text-orange-800 border-orange-200',
            };
            return (
              styles[priority] || 'bg-gray-100 text-gray-800 border-gray-200'
            );
          }}
          getStatusStyles={(s) => {
            const styles: Record<Ticket['status'], string> = {
              Pendiente: 'bg-yellow-100 text-gray-800 border-gray-200',
              'En Ejecución': 'bg-blue-100 text-blue-800 border-blue-200',
              Finalizadas: 'bg-green-100 text-green-800 border-green-200',
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
              ?.location === 'string'
              ? ((filters as Record<string, unknown>).location as string)
              : undefined
          }
          count={counts[status]}
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
