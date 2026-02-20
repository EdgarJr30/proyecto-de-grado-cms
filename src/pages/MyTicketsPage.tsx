import { useEffect, useMemo, useState } from 'react';
import { getSession } from '../utils/auth';
import Sidebar from '../components/layout/Sidebar';
import { getTicketsByUserId } from '../services/ticketService';
import {
  getPublicImageUrl,
  getTicketImagePaths,
} from '../services/storageService';
import type { Ticket } from '../types/Ticket';
import type { FilterState } from '../types/filters';
import type { MyTicketsFilterKey } from '../features/management/myTicketsFilters';
import MyTicketsFiltersBar from '../components/dashboard/ticket/MyTicketsFiltersBar';
import '../styles/peopleAsana.css';

const PAGE_SIZE = 8;

function priorityChipClass(value?: Ticket['priority']) {
  if (value === 'Alta') return 'bg-orange-50 text-orange-700 border-orange-200';
  if (value === 'Media') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function statusChipClass(value?: Ticket['status']) {
  if (value === 'En Ejecución') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (value === 'Finalizadas')
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export default function MyTicketsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<MyTicketsFilterKey, unknown>>(
    {} as Record<MyTicketsFilterKey, unknown>
  );
  const [page, setPage] = useState(0);

  const mergedFilters = useMemo<FilterState<MyTicketsFilterKey>>(
    () => filters as FilterState<MyTicketsFilterKey>,
    [filters]
  );

  const filtersKey = useMemo(() => JSON.stringify(mergedFilters), [mergedFilters]);

  // 1) Solo obtiene el userId de la sesión
  useEffect(() => {
    (async () => {
      const { data } = await getSession();
      const id = data.session?.user?.id ?? null; // UUID de auth.users
      setUserId(id);
    })();
  }, []);

  // 2) Carga los tickets cuando tenemos userId
  useEffect(() => {
    (async () => {
      if (!userId) {
        setTickets([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const rows = await getTicketsByUserId(userId);
        setTickets(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const filteredTickets = useMemo(() => {
    const term =
      typeof mergedFilters.q === 'string'
        ? mergedFilters.q.trim().toLowerCase()
        : '';
    const statuses = Array.isArray(mergedFilters.status)
      ? mergedFilters.status.map(String)
      : [];
    const priorities = Array.isArray(mergedFilters.priority)
      ? mergedFilters.priority.map(String)
      : [];
    const createdRange =
      mergedFilters.created_at && typeof mergedFilters.created_at === 'object'
        ? (mergedFilters.created_at as { from?: string; to?: string })
        : undefined;

    return tickets.filter((ticket) => {
      if (term.length >= 2) {
        const haystack = [
          String(ticket.id ?? ''),
          ticket.title ?? '',
          ticket.description ?? '',
          ticket.requester ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (statuses.length > 0 && !statuses.includes(ticket.status)) {
        return false;
      }

      if (priorities.length > 0 && !priorities.includes(ticket.priority)) {
        return false;
      }

      if (createdRange?.from || createdRange?.to) {
        const createdDate =
          typeof ticket.created_at === 'string'
            ? ticket.created_at.slice(0, 10)
            : '';
        if (createdRange.from && createdDate < createdRange.from) return false;
        if (createdRange.to && createdDate > createdRange.to) return false;
      }

      return true;
    });
  }, [tickets, mergedFilters]);

  useEffect(() => {
    setPage(0);
  }, [filtersKey, tickets.length]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const visibleTickets = useMemo(() => {
    const from = safePage * PAGE_SIZE;
    const to = from + PAGE_SIZE;
    return filteredTickets.slice(from, to);
  }, [filteredTickets, safePage]);

  return (
    <div className="people-asana h-screen flex bg-[#f3f4f8]">
      <Sidebar />
      <main className="flex flex-col h-[100dvh] overflow-hidden flex-1">
        <header className="people-page-header px-4 md:px-6 lg:px-8 py-3 md:py-4">
          <div className="people-header-row flex items-center justify-between gap-3">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Mi Perfil
            </h2>
          </div>
        </header>

        <div className="people-filters px-4 md:px-6 lg:px-8 pt-2">
          <MyTicketsFiltersBar
            onApply={(vals) => {
              setFilters((prev) =>
                JSON.stringify(prev) === JSON.stringify(vals) ? prev : vals
              );
            }}
          />
        </div>

        <section className="people-content flex-1 overflow-x-auto px-4 md:px-6 lg:px-8 pt-2 pb-6">
          <div className="people-table-toolbar flex items-center gap-3 rounded-xl border border-gray-200 bg-white/85 px-3 py-2 shadow-sm">
            <p className="text-sm font-medium text-gray-700">
              Mis tickets — Página {safePage + 1} de {totalPages} —{' '}
              {filteredTickets.length} total
            </p>
          </div>

          {loading ? (
            <div className="mt-3 rounded-xl border border-gray-200 bg-white py-10 text-center text-gray-400">
              Cargando tickets...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="mt-3 rounded-xl border border-gray-200 bg-white py-10 text-center text-gray-400">
              No tienes tickets con los filtros actuales.
            </div>
          ) : (
            <div className="mt-3">
              <div className="md:hidden space-y-3">
                {visibleTickets.map((ticket) => {
                  const firstImage = getTicketImagePaths(ticket.image ?? '')[0];
                  return (
                    <article
                      key={ticket.id}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-semibold text-gray-900 line-clamp-1">
                          {ticket.title}
                        </h3>
                        <div className="flex items-center gap-1">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${priorityChipClass(
                              ticket.priority
                            )}`}
                          >
                            {ticket.priority}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusChipClass(
                              ticket.status
                            )}`}
                          >
                            {ticket.status}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                        {ticket.description || 'Sin descripción'}
                      </p>
                      {firstImage ? (
                        <img
                          src={getPublicImageUrl(firstImage)}
                          alt="Adjunto"
                          className="mt-3 h-24 w-full rounded-md border border-gray-200 object-cover"
                        />
                      ) : null}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                        <span>ID: {ticket.id}</span>
                        <span>Ubicación: {ticket.location_id ?? '—'}</span>
                        <span>Solicitante: {ticket.requester || '—'}</span>
                        <span>Fecha: {ticket.incident_date || '—'}</span>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden md:block">
                <div className="overflow-auto rounded-2xl ring-1 ring-gray-200 bg-white shadow-sm">
                  <table className="people-table min-w-full border-separate border-spacing-0">
                    <thead className="people-table-head bg-white sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          ID
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Ticket
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
                          Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Creado
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Adjunto
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {visibleTickets.map((ticket) => {
                        const firstImage = getTicketImagePaths(ticket.image ?? '')[0];
                        return (
                          <tr key={ticket.id} className="people-table-row hover:bg-indigo-50/40 transition">
                            <td className="px-4 py-3 border-b border-gray-100 text-sm font-medium text-gray-900 whitespace-nowrap">
                              #{ticket.id}
                            </td>
                            <td className="px-4 py-3 border-b border-gray-100 min-w-[260px]">
                              <div className="text-sm font-semibold text-gray-900 line-clamp-1">
                                {ticket.title}
                              </div>
                              <div className="text-xs text-gray-500 line-clamp-1">
                                {ticket.description || 'Sin descripción'}
                              </div>
                            </td>
                            <td className="px-4 py-3 border-b border-gray-100 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${priorityChipClass(
                                  ticket.priority
                                )}`}
                              >
                                {ticket.priority}
                              </span>
                            </td>
                            <td className="px-4 py-3 border-b border-gray-100 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusChipClass(
                                  ticket.status
                                )}`}
                              >
                                {ticket.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 border-b border-gray-100 text-sm text-gray-700 whitespace-nowrap">
                              {ticket.location_id ?? '—'}
                            </td>
                            <td className="px-4 py-3 border-b border-gray-100 text-sm text-gray-700 whitespace-nowrap">
                              {ticket.incident_date || '—'}
                            </td>
                            <td className="px-4 py-3 border-b border-gray-100 text-sm text-gray-700 whitespace-nowrap">
                              {ticket.created_at
                                ? new Date(ticket.created_at).toLocaleDateString(
                                    'es-DO'
                                  )
                                : '—'}
                            </td>
                            <td className="px-4 py-3 border-b border-gray-100 whitespace-nowrap">
                              {firstImage ? (
                                <img
                                  src={getPublicImageUrl(firstImage)}
                                  alt="Adjunto"
                                  className="h-9 w-14 rounded-md border border-gray-200 object-cover"
                                />
                              ) : (
                                <span className="text-sm text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!loading && filteredTickets.length > 0 && (
            <div className="people-pagination mt-3 flex justify-end gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-gray-100 disabled:hover:bg-white"
              >
                Anterior
              </button>
              <button
                onClick={() =>
                  setPage((p) => (p + 1 < totalPages ? p + 1 : p))
                }
                disabled={safePage + 1 >= totalPages}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 cursor-pointer hover:bg-indigo-500 disabled:hover:bg-indigo-600"
              >
                Siguiente
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
