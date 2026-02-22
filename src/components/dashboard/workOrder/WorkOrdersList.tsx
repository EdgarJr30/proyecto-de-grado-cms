import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Ticket, WorkOrder, WorkOrderExtras } from '../../../types/Ticket';
import type { FilterState } from '../../../types/filters';
import type { WorkOrdersFilterKey } from '../../../features/tickets/WorkOrdersFilters';
import {
  getPublicImageUrl,
  getTicketImagePaths,
} from '../../../services/storageService';
import { getTicketsByWorkOrdersFiltersPaginated } from '../../../services/ticketService';
import AssigneeBadge from '../../common/AssigneeBadge';
import { supabase } from '../../../lib/supabaseClient';
import { useLocationCatalog } from '../../../hooks/useLocationCatalog';

type Props = {
  filters?: FilterState<WorkOrdersFilterKey>;
  onOpen?: (t: WorkOrder) => void;
  lastUpdatedTicket?: Partial<WorkOrder> | null;
};

const PAGE_SIZE = 10;
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

export default function WorkOrdersList({
  filters,
  onOpen,
  lastUpdatedTicket,
}: Props) {
  const { getLocationLabel } = useLocationCatalog({
    includeInactive: true,
    activeOnlyOptions: false,
  });
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const realtimeRefreshTimeout = useRef<number | null>(null);

  const fkey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);
  const toId = (value: string | number | undefined | null) =>
    Number(value ?? 0);
  const groupedRows = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        title: STATUS_SECTION_LABEL[status],
        items: rows.filter((r) => r.status === status),
      })).filter((g) => g.items.length > 0),
    [rows]
  );

  const reload = useCallback(async (p = 0) => {
    setLoading(true);
    const { data, count: total } = await getTicketsByWorkOrdersFiltersPaginated(
      (filters ?? {}) as FilterState<string>,
      p,
      PAGE_SIZE
    );
    setRows(data);
    setCount(total);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    setPage(0);
  }, [fkey]);

  useEffect(() => {
    void reload(page);
  }, [page, fkey, reload]);

  // 👇 Mezcla local optimista cuando llega un patch desde el modal
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
      // 👇 recarga solo la página actual (puede ser costoso si haces muchos guardados seguidos)
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

  return (
    <div className="wo-list overflow-auto rounded-2xl ring-1 ring-gray-200 bg-white shadow-sm">
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="wo-list-head bg-white sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Nombre
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Fecha
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Prioridad
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Estado
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Ubicación
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Técnico
            </th>
          </tr>
        </thead>

        <tbody className="bg-white">
          {loading ? (
            <tr>
              <td colSpan={6} className="py-10 text-center text-gray-400">
                Cargando…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-10 text-center text-gray-400">
                Sin resultados.
              </td>
            </tr>
          ) : (
            groupedRows.map((group) => (
              <Fragment key={group.status}>
                <tr className="wo-list-section-row">
                  <td colSpan={6} className="px-3 py-2 bg-gray-50 border-y border-gray-200">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <span className="text-gray-500">▾</span>
                      {group.title}
                      <span className="rounded-full bg-white border border-gray-300 px-2 text-xs text-gray-500">
                        {group.items.length}
                      </span>
                    </div>
                  </td>
                </tr>

                {group.items.map((t) => {
                  const images = getTicketImagePaths(t.image ?? '');
                  const first = images[0];
                  return (
                    <tr
                      key={t.id}
                      className="wo-list-row hover:bg-indigo-50/40 transition cursor-pointer"
                      onClick={() => onOpen?.(t)}
                    >
                      <td className="px-4 py-2.5 border-b border-gray-100">
                        <div className="flex items-center gap-3 min-w-[280px]">
                          {first ? (
                            <img
                              src={getPublicImageUrl(first)}
                              alt="Adjunto"
                              className="h-9 w-9 rounded-md object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-md bg-gray-100 border border-gray-200" />
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {t.title}
                            </div>
                            <div className="text-xs text-gray-500">
                              OT-{String(t.id).padStart(4, '0')}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-2.5 border-b border-gray-100 text-sm text-gray-700 whitespace-nowrap">
                        {t.incident_date ?? '—'}
                      </td>

                      <td className="px-4 py-2.5 border-b border-gray-100 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${priorityClass(
                            t.priority
                          )}`}
                        >
                          {t.priority?.[0]?.toUpperCase()}
                          {t.priority?.slice(1)}
                        </span>
                      </td>

                      <td className="px-4 py-2.5 border-b border-gray-100 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(
                            t.status
                          )}`}
                        >
                          {t.status}
                        </span>
                      </td>

                      <td className="px-4 py-2.5 border-b border-gray-100 text-sm text-gray-600 whitespace-nowrap">
                        {(t as WorkOrder & { location_name?: string | null })
                          .location_name ?? getLocationLabel(t.location_id)}
                      </td>

                      <td className="px-4 py-2.5 border-b border-gray-100 text-sm text-gray-700 whitespace-nowrap">
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
                  );
                })}
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
