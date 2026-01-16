import { useEffect, useRef, useState, useCallback, type JSX } from 'react';
import type { Ticket, WorkOrderExtras } from '../../../types/Ticket';
import { getTicketsByStatusPaginated } from '../../../services/ticketService';
import {
  getPublicImageUrl,
  getTicketImagePaths,
} from '../../../services/storageService';
import AssigneeBadge from '../../common/AssigneeBadge';

interface Props {
  tickets?: Ticket[];
  isSearching: boolean;
  status: Ticket['status'];
  onOpenModal: (ticket: Ticket) => void;
  getPriorityStyles: (priority: Ticket['priority']) => string;
  getStatusStyles: (status: Ticket['status']) => string;
  capitalize: (word?: string) => string;
  onFirstLoad: () => void;
  isLoading: boolean;
  pageSize?: number;
  reloadSignal: number;
  lastUpdatedTicket: Ticket | null;
  selectedLocation?: string;
  isFiltering: boolean;
  count?: number;
  getSpecialIncidentAdornment?: (t: Ticket) => JSX.Element | null;
}

export default function WorkOrdersColumn({
  tickets,
  isSearching,
  status,
  onOpenModal,
  getPriorityStyles,
  getStatusStyles,
  capitalize,
  onFirstLoad,
  pageSize = 10,
  reloadSignal,
  lastUpdatedTicket,
  selectedLocation,
  isFiltering,
  count,
  getSpecialIncidentAdornment,
}: Props) {
  const [localTickets, setLocalTickets] = useState<Ticket[]>([]);
  const [page, setPage] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [firstLoaded, setFirstLoaded] = useState(false);

  const pageRef = useRef(0);
  const isPaginatingRef = useRef(false);
  const columnRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  // Decide qué tickets renderizar
  const ticketsToRender = isFiltering ? tickets ?? [] : localTickets;
  // Loading solo cuando no hay tickets para mostrar y está cargando
  const showSkeleton = isInitialLoading && !isFiltering;

  const loadMoreTickets = useCallback(
    async (force = false) => {
      if (isFiltering) return;

      if ((isInitialLoading || isPaginatingRef.current) && !force) return;
      if (!hasMore) return;

      if (force) {
        setIsInitialLoading(true);
        pageRef.current = 0;
        setPage(0);
      } else {
        setIsPaginating(true);
      }

      const currentPage = force ? 0 : pageRef.current;
      const newTickets = await getTicketsByStatusPaginated(
        status,
        currentPage,
        pageSize ?? 20,
        selectedLocation
      );

      setLocalTickets((prev) => {
        const merged = force ? [...newTickets] : [...prev, ...newTickets];
        const unique = Array.from(
          new Map(merged.map((t) => [t.id, t])).values()
        );
        return unique;
      });

      if (newTickets.length < pageSize) {
        setHasMore(false);
      } else {
        pageRef.current = currentPage + 1;
        setPage(currentPage + 1);
      }

      if (force) setIsInitialLoading(false);
      else setIsPaginating(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isFiltering,
      isInitialLoading,
      hasMore,
      status,
      page,
      pageSize,
      selectedLocation,
    ]
  );

  const visibleCount =
    typeof count === 'number'
      ? count
      : isFiltering
      ? (tickets ?? []).length
      : localTickets.length;

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    isPaginatingRef.current = isPaginating;
  }, [isPaginating]);

  useEffect(() => {
    if (!isFiltering) {
      setLocalTickets([]);
      setPage(0);
      setHasMore(true);
      setFirstLoaded(false);
      setIsInitialLoading(true);
      loadMoreTickets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFiltering, status, reloadSignal, selectedLocation]);

  useEffect(() => {
    if (!firstLoaded && (isSearching || localTickets.length > 0)) {
      setFirstLoaded(true);
      onFirstLoad();
    }
  }, [isSearching, localTickets.length, firstLoaded, onFirstLoad]);

  useEffect(() => {
    if (isSearching) return;
    if (!sentinelRef.current || !columnRef.current || !hasMore) return;

    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore) {
          loadMoreTickets();
        }
      },
      {
        root: columnRef.current,
        threshold: 0.1,
      }
    );

    observer.current.observe(sentinelRef.current);

    return () => observer.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearching, localTickets.length, hasMore]);

  useEffect(() => {
    if (isSearching || !lastUpdatedTicket) return;

    if (lastUpdatedTicket.is_archived) {
      setLocalTickets((prev) =>
        prev.filter((t) => t.id !== lastUpdatedTicket.id)
      );
      return;
    }

    if (lastUpdatedTicket.status === status) {
      setLocalTickets((prev) => {
        const exists = prev.some((t) => t.id === lastUpdatedTicket.id);
        if (exists) {
          return prev.map((t) =>
            t.id === lastUpdatedTicket.id ? lastUpdatedTicket : t
          );
        } else {
          return [lastUpdatedTicket, ...prev];
        }
      });
    } else {
      setLocalTickets((prev) =>
        prev.filter((t) => t.id !== lastUpdatedTicket.id)
      );
    }
  }, [isSearching, lastUpdatedTicket, status]);

  return (
    // 🔧 Evitar que la card “crezca” horizontalmente por contenido interno
    <div className="bg-white rounded-lg shadow-lg p-4 w-[300px] sm:w-[350px] md:w-[400px] xl:w-[420px] min-w-[300px] flex-shrink-0 flex flex-col overflow-hidden">
      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
        <span
          className={`px-2 py-1 rounded text-sm font-medium ${getStatusStyles(
            status
          )}`}
        >
          {status}
        </span>

        <span
          className="inline-flex items-center justify-center rounded-full border border-gray-300 text-xs min-w-6 h-6 px-1.5 bg-white text-gray-700"
          title={`Total en ${status}`}
        >
          {visibleCount}
        </span>
      </h3>

      {/* 🔧 Scroll solo vertical; jamás horizontal */}
      <div
        ref={columnRef}
        className="flex flex-col gap-3 overflow-y-auto overflow-x-hidden max-h-[80vh] pr-1"
      >
        {showSkeleton ? (
          Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-gray-100 animate-pulse border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col gap-2"
            >
              <div className="w-3/4 h-4 bg-gray-200 rounded mb-2" />
              <div className="w-full h-3 bg-gray-200 rounded mb-1" />
              <div className="w-1/2 h-3 bg-gray-200 rounded mb-1" />
              <div className="flex gap-2 mt-1">
                <div className="w-12 h-4 bg-gray-200 rounded" />
                <div className="w-12 h-4 bg-gray-200 rounded" />
              </div>
            </div>
          ))
        ) : (
          <>
            {ticketsToRender.map((ticket) => {
              return (
                // 🔧 min-w-0 permite que los truncados funcionen dentro de flex
                <div
                  key={ticket.id}
                  onClick={() => onOpenModal(ticket)}
                  className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition cursor-pointer min-w-0"
                >
                  {/* 🔧 Imágenes en GRID (2 cols) para evitar overflow horizontal */}
                  {ticket.image &&
                    (() => {
                      const imagePaths = getTicketImagePaths(ticket.image);
                      if (imagePaths.length === 0) return null;
                      return (
                        <div className="grid grid-cols-2 gap-1 mb-3">
                          {imagePaths.slice(0, 4).map((path, idx) => (
                            <img
                              key={idx}
                              src={getPublicImageUrl(path)}
                              alt={`Adjunto ${idx + 1}`}
                              className="w-full h-24 object-cover rounded"
                            />
                          ))}
                        </div>
                      );
                    })()}

                  <div className="flex items-start justify-between gap-2 mb-1 min-w-0">
                    {/* 🔧 Título truncado y rompible */}
                    <h4 className="font-semibold text-sm text-gray-900 truncate break-words max-w-[85%]">
                      {ticket.title}
                    </h4>

                    {/* Botón ... */}
                    <button
                      type="button"
                      className="text-gray-900 hover:text-gray-600 shrink-0"
                      title="Ver más detalles"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="size-6"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* 🔧 Descripción: 2 líneas máx + rompe palabras largas */}
                  <p className="text-xs text-gray-600 line-clamp-2 break-words mb-2">
                    {ticket.description || 'Sin descripción'}
                  </p>

                  {/* 🔧 Chips con wrap para no desbordar */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {ticket.is_urgent && (
                      <span className="flex items-center gap-1 text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v3m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Urgente
                      </span>
                    )}

                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded border ${getPriorityStyles(
                        ticket.priority
                      )}`}
                    >
                      {capitalize(ticket.priority)}
                    </span>

                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded border ${getStatusStyles(
                        ticket.status
                      )}`}
                    >
                      {ticket.status}
                    </span>
                  </div>

                  {/* 🔧 Metadatos: asegúrate de truncar y permitir saltos */}
                  <div className="text-xs text-gray-500 space-y-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <svg
                        className="w-3 h-3 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5.121 17.804A3 3 0 008 19h8a3 3 0 002.879-1.196M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="truncate break-words">
                        Solicitante: {ticket.requester}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="w-3 h-3 shrink-0"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                        />
                      </svg>
                      <span className="truncate break-words">
                        Ubicación: {ticket.location || 'No especificada'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <svg
                        className="w-3 h-3 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 9h10m-11 5h12a2 2 0 002-2v-5H3v5a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="truncate">
                        Fecha:{' '}
                        {ticket.incident_date
                          ? ticket.incident_date
                          : 'No especificada'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <strong className="text-xs shrink-0">ID:</strong>
                      <span className="truncate">{ticket.id}</span>
                      {getSpecialIncidentAdornment?.(ticket)}
                    </div>
                  </div>

                  {/* Técnico */}
                  <AssigneeBadge
                    assigneeId={
                      (ticket as WorkOrderExtras).effective_assignee_id ??
                      (ticket as WorkOrderExtras).primary_assignee_id ??
                      (ticket as Ticket).assignee_id ??
                      null
                    }
                    size="sm"
                    className="mt-2"
                  />
                </div>
              );
            })}

            {isPaginating && !isSearching && (
              <div className="flex justify-center py-3">
                <svg
                  className="animate-spin h-5 w-5 text-gray-400"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
              </div>
            )}
          </>
        )}

        <div ref={sentinelRef} className="h-2 w-full" />
      </div>
    </div>
  );
}
