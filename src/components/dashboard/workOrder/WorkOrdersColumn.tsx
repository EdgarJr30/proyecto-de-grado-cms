import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type JSX,
} from 'react';
import type { Ticket, WorkOrderExtras } from '../../../types/Ticket';
import {
  getPublicImageUrl,
  getTicketImagePaths,
} from '../../../services/storageService';
import AssigneeBadge from '../../common/AssigneeBadge';

type TicketDropTarget = {
  targetStatus: Ticket['status'] | 'Archivadas';
  targetIndex: number;
};

type ColumnStatus = Ticket['status'] | 'Archivadas';

interface Props {
  tickets: Ticket[];
  status: ColumnStatus;
  onOpenModal: (ticket: Ticket) => void;
  getPriorityStyles: (priority: Ticket['priority']) => string;
  getStatusStyles: (status: ColumnStatus) => string;
  capitalize: (word?: string) => string;
  isLoading?: boolean;
  count?: number;
  getLocationLabel: (
    locationId: number | string | bigint | null | undefined,
    fallback?: string
  ) => string;
  getSpecialIncidentAdornment?: (t: Ticket) => JSX.Element | null;
  canDragDrop?: boolean;
  draggedTicketId?: number | null;
  onDragStartTicket?: (ticket: Ticket) => void;
  onDragEndTicket?: () => void;
  onDropTicketAt?: (target: TicketDropTarget) => void;
}

export default function WorkOrdersColumn({
  tickets,
  status,
  onOpenModal,
  getPriorityStyles,
  getStatusStyles,
  capitalize,
  isLoading = false,
  count,
  getLocationLabel,
  getSpecialIncidentAdornment,
  canDragDrop = false,
  draggedTicketId = null,
  onDragStartTicket,
  onDragEndTicket,
  onDropTicketAt,
}: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const columnBodyRef = useRef<HTMLDivElement | null>(null);
  const suppressClickUntilRef = useRef(0);

  const visibleCount = typeof count === 'number' ? count : tickets.length;
  const showSkeleton = isLoading && tickets.length === 0;
  const isEmptyColumn = !showSkeleton && tickets.length === 0;

  const canDrop = canDragDrop && draggedTicketId != null;

  const ticketIds = useMemo(() => tickets.map((ticket) => Number(ticket.id)), [tickets]);
  const ticketIdsKey = useMemo(() => ticketIds.join(','), [ticketIds]);

  const resolveDropIndex = (clientY: number) => {
    const body = columnBodyRef.current;
    if (!body) return tickets.length;

    const cards = Array.from(
      body.querySelectorAll<HTMLDivElement>('[data-drop-card="1"]')
    );

    if (cards.length === 0) return 0;

    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i];
      const rect = card.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (clientY < midpoint) {
        return i;
      }
    }

    return cards.length;
  };

  const handleDragOverColumn = (e: DragEvent<HTMLDivElement>) => {
    if (!canDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);

    const nextIndex = resolveDropIndex(e.clientY);
    setDropIndex(nextIndex);
  };

  const handleDragLeaveColumn = (e: DragEvent<HTMLDivElement>) => {
    if (!canDrop) return;
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragOver(false);
    setDropIndex(null);
  };

  const handleDropOnColumn = (e: DragEvent<HTMLDivElement>) => {
    if (!canDrop) return;
    e.preventDefault();

    const nextIndex = dropIndex ?? tickets.length;
    setIsDragOver(false);
    setDropIndex(null);

    onDropTicketAt?.({ targetStatus: status, targetIndex: nextIndex });
  };

  useEffect(() => {
    setDropIndex(null);
    setIsDragOver(false);
  }, [status, ticketIdsKey]);

  return (
    <div
      onDragOver={handleDragOverColumn}
      onDragEnter={handleDragOverColumn}
      onDragLeave={handleDragLeaveColumn}
      onDrop={handleDropOnColumn}
      className={`wo-board-column rounded-xl border border-gray-200 bg-gray-100/70 p-2.5 flex-[0_0_280px] w-[280px] min-w-[280px] max-w-[280px] flex flex-col h-full min-h-[420px] overflow-hidden transition-colors ${
        isDragOver ? 'ring-2 ring-indigo-300 bg-indigo-50/60' : ''
      }`}
    >
      <h3 className="wo-board-column-head font-semibold text-sm mb-2 flex items-center gap-2">
        <span
          className={`wo-board-status-chip px-2 py-1 rounded-lg text-xs font-semibold border ${getStatusStyles(
            status
          )}`}
        >
          {status}
        </span>

        <span
          className="wo-board-count inline-flex items-center justify-center rounded-full border border-gray-300 text-xs min-w-6 h-6 px-1.5 bg-white text-gray-700"
          title={`Total en ${status}`}
        >
          {visibleCount}
        </span>
      </h3>

      <div
        ref={columnBodyRef}
        className="wo-board-column-body flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden max-h-[80vh] flex-1 min-h-[200px] pr-0.5"
        onDragOver={handleDragOverColumn}
        onDragEnter={handleDragOverColumn}
        onDragLeave={handleDragLeaveColumn}
        onDrop={handleDropOnColumn}
      >
        {showSkeleton ? (
          Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white/70 animate-pulse border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col gap-2"
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
            {tickets.map((ticket, index) => {
              const ticketId = Number(ticket.id);
              const isDragged =
                draggedTicketId != null && ticketId === draggedTicketId;
              const showDropLine =
                canDrop && dropIndex != null && dropIndex === index;

              return (
                <div key={ticket.id} className="relative">
                  {showDropLine && <div className="wo-drop-line" aria-hidden="true" />}

                  <div
                    data-drop-card="1"
                    draggable={canDragDrop}
                    aria-grabbed={isDragged}
                    onDragStart={(e) => {
                      if (!canDragDrop) return;
                      suppressClickUntilRef.current = Date.now() + 250;
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(ticket.id));
                      onDragStartTicket?.(ticket);
                    }}
                    onDragEnd={() => {
                      suppressClickUntilRef.current = Date.now() + 250;
                      onDragEndTicket?.();
                    }}
                    onClick={() => {
                      if (Date.now() < suppressClickUntilRef.current) return;
                      onOpenModal(ticket);
                    }}
                    className={`wo-ticket-card bg-white border border-gray-200 rounded-lg p-2.5 shadow-sm hover:shadow-md transition cursor-pointer min-w-0 ${
                      canDragDrop
                        ? 'cursor-grab active:cursor-grabbing'
                        : 'wo-ticket-card--drag-disabled'
                    } ${isDragged ? 'opacity-60' : ''}`}
                  >
                    {ticket.image &&
                      (() => {
                        const imagePaths = getTicketImagePaths(ticket.image);
                        if (imagePaths.length === 0) return null;
                        return (
                          <div className="wo-ticket-cover mb-1.5">
                            <img
                              src={getPublicImageUrl(imagePaths[0])}
                              alt="Adjunto"
                              className="w-full h-11 object-cover rounded-md"
                            />
                            {imagePaths.length > 1 && (
                              <span className="wo-ticket-cover-count">
                                +{imagePaths.length - 1}
                              </span>
                            )}
                          </div>
                        );
                      })()}

                    <div className="flex items-start justify-between gap-2 mb-0.5 min-w-0">
                      <h4 className="wo-ticket-title font-semibold text-[14px] truncate break-words max-w-full">
                        {ticket.title}
                      </h4>
                    </div>

                    <p className="wo-ticket-desc text-[11px] line-clamp-2 break-words mb-1.5">
                      {ticket.description || 'Sin descripción'}
                    </p>

                    <div className="flex flex-wrap items-center gap-1 mb-1.5">
                      {ticket.is_urgent && (
                        <span className="flex items-center gap-1 text-[10px] font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
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
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${getPriorityStyles(
                          ticket.priority
                        )}`}
                      >
                        {capitalize(ticket.priority)}
                      </span>

                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${getStatusStyles(
                          ticket.status
                        )}`}
                      >
                        {ticket.status}
                      </span>
                    </div>

                    <div className="wo-ticket-meta text-[10px] space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1">
                        <svg
                          className="w-2.5 h-2.5 shrink-0"
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
                          className="w-2.5 h-2.5 shrink-0"
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
                          Ubicación:{' '}
                          {ticket.location_name?.trim() ||
                            getLocationLabel(ticket.location_id, 'Sin ubicación')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <svg
                          className="w-2.5 h-2.5 shrink-0"
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
                        <strong className="text-[10px] shrink-0">ID:</strong>
                        <span className="truncate">{ticket.id}</span>
                        {getSpecialIncidentAdornment?.(ticket)}
                      </div>
                    </div>

                    <AssigneeBadge
                      assigneeId={
                        (ticket as WorkOrderExtras).effective_assignee_id ??
                        (ticket as WorkOrderExtras).primary_assignee_id ??
                        (ticket as Ticket).assignee_id ??
                        null
                      }
                      size="sm"
                      className="mt-1.5"
                    />
                  </div>
                </div>
              );
            })}

            {canDrop && dropIndex != null && dropIndex === tickets.length && (
              <div className="wo-drop-line" aria-hidden="true" />
            )}

            {isEmptyColumn && (
              <div
                className={`wo-empty-drop rounded-xl border border-dashed px-3 py-10 text-center text-xs ${
                  isDragOver
                    ? 'border-indigo-400 text-indigo-700 bg-indigo-50'
                    : 'border-gray-300 text-gray-500 bg-gray-50'
                }`}
              >
                {status === 'Archivadas'
                  ? 'Sin órdenes archivadas'
                  : canDragDrop
                    ? 'Arrastra y suelta una orden aquí'
                    : 'Sin órdenes en esta columna'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
