import { useEffect, useMemo, useState } from 'react';
import type { Ticket, WorkOrder, WorkOrderExtras } from '../../../types/Ticket';
import type { FilterState } from '../../../types/filters';
import type { WorkOrdersFilterKey } from '../../../features/tickets/WorkOrdersFilters';
import {
  getPublicImageUrl,
  getTicketImagePaths,
} from '../../../services/storageService';
import { getTicketsByWorkOrdersFiltersPaginated } from '../../../services/ticketService';
import AssigneeBadge from '../../common/AssigneeBadge';

type Props = {
  filters?: FilterState<WorkOrdersFilterKey>;
  onOpen?: (t: WorkOrder) => void;
  lastUpdatedTicket?: Partial<WorkOrder> | null;
};

const PAGE_SIZE = 10;

function statusClass(s: Ticket['status']) {
  if (s === 'Pendiente') return 'bg-yellow-100 text-gray-800 border-gray-200';
  if (s === 'En Ejecución') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-green-100 text-green-800 border-green-200';
}

function priorityClass(p?: Ticket['priority']) {
  if (p === 'alta') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (p === 'media') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
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
  const [rows, setRows] = useState<WorkOrder[]>([]);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fkey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);

  async function reload(p = 0) {
    setLoading(true);
    const { data, count: total } = await getTicketsByWorkOrdersFiltersPaginated(
      (filters ?? {}) as FilterState<string>,
      p,
      PAGE_SIZE
    );
    setRows(data);
    setCount(total);
    setLoading(false);
  }

  useEffect(() => {
    setPage(0);
  }, [fkey]);

  useEffect(() => {
    void reload(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fkey]);

  // 👇 Mezcla local optimista cuando llega un patch desde el modal
  useEffect(() => {
    if (!lastUpdatedTicket?.id) return;

    setRows((prev) => {
      let touched = false;
      const next = prev.map((r) => {
        if (r.id === lastUpdatedTicket.id) {
          touched = true;
          return withEffective({
            ...r,
            ...(lastUpdatedTicket as WorkOrder),
          } as WorkOrder);
        }
        return r;
      });
      // Si la fila no está en la página actual, no hacemos nada (paginación)
      return touched ? next : prev;
    });
  }, [lastUpdatedTicket]);

  useEffect(() => {
    if (!lastUpdatedTicket?.id) return;

    let touched = false;
    setRows((prev) => {
      const next = prev.map((r) => {
        if (r.id === lastUpdatedTicket.id) {
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
  }, [lastUpdatedTicket]);

  return (
    <div className="overflow-auto rounded-lg ring-1 ring-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
              Orden
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
              Ubicación
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
              Técnico
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
              Estado
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
              Prioridad
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">
              Fecha
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200 bg-white">
          {loading ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-gray-400">
                Cargando…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-gray-400">
                Sin resultados.
              </td>
            </tr>
          ) : (
            rows.map((t) => {
              const images = getTicketImagePaths(t.image ?? '');
              const first = images[0];
              return (
                <tr
                  key={t.id}
                  className="hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => onOpen?.(t)}
                >
                  {/* Orden (imagen + código + título) */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {first ? (
                        <img
                          src={getPublicImageUrl(first)}
                          alt="Adjunto"
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-gray-200" />
                      )}
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          OT-{String(t.id).padStart(4, '0')}
                        </div>
                        <div className="text-sm text-gray-500 line-clamp-1">
                          {t.title}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Ubicación */}
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-500">{t.location}</div>
                  </td>

                  {/* Técnico */}
                  <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
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

                  {/* Estado */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(
                        t.status
                      )}`}
                    >
                      {t.status}
                    </span>
                  </td>

                  {/* Prioridad */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${priorityClass(
                        t.priority
                      )}`}
                    >
                      {t.priority?.[0]?.toUpperCase()}
                      {t.priority?.slice(1)}
                    </span>
                  </td>

                  {/* Fecha (igual que WorkOrders: usa incident_date) */}
                  <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                    {t.incident_date ?? '—'}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Paginación */}
      <div className="flex justify-end gap-2 p-3">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-3 py-2 rounded bg-gray-200 text-gray-700 font-medium disabled:opacity-40 cursor-pointer hover:bg-gray-300 disabled:hover:bg-gray-200"
        >
          Anterior
        </button>
        <button
          onClick={() =>
            setPage((p) => (p + 1 < Math.ceil(count / PAGE_SIZE) ? p + 1 : p))
          }
          disabled={page + 1 >= Math.ceil(count / PAGE_SIZE)}
          className="px-3 py-2 rounded bg-indigo-600 text-white font-medium disabled:opacity-40 cursor-pointer hover:bg-indigo-500 disabled:hover:bg-indigo-600"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
