import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Ticket } from '../../../types/Ticket';
import type { SpecialIncident } from '../../../types/SpecialIncident';
import { formatDateInTimezone } from '../../../utils/formatDate';
import {
  getPublicImageUrl,
  getTicketImagePaths,
} from '../../../services/storageService';
import { useAssignees } from '../../../context/AssigneeContext';
import type { Assignee } from '../../../types/Assignee';
import { formatAssigneeFullName } from '../../../services/assigneeService';
import { acceptTickets } from '../../../services/ticketService';
import {
  getAllSpecialIncidents,
  makeSpecialIncidentMap,
} from '../../../services/specialIncidentsService';
import { showToastError, showToastSuccess } from '../../../notifications';
import AnimatedDialog from '../../ui/AnimatedDialog';
import { supabase } from '../../../lib/supabaseClient';
import {
  getUnreadTicketCommentNotificationCounts,
  markTicketCommentNotificationsRead,
  subscribeToMyNotificationDeliveries,
} from '../../../services/notificationCenterService';
import TicketChatPanel from '../../tickets/TicketChatPanel';

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function PriorityChip({ value }: { value: string }) {
  const map: Record<string, string> = {
    Baja: 'bg-emerald-100 text-emerald-800',
    Media: 'bg-amber-100 text-amber-800',
    Alta: 'bg-orange-100 text-orange-800',
    Crítica: 'bg-rose-100 text-rose-800',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        map[value] || 'bg-gray-100 text-gray-700'
      )}
    >
      {value}
    </span>
  );
}

function StatusChip({ value }: { value: string }) {
  const map: Record<string, string> = {
    Nueva: 'bg-gray-100 text-gray-800',
    'En Revisión': 'bg-yellow-100 text-yellow-800',
    Aprobada: 'bg-emerald-100 text-emerald-800',
    Rechazada: 'bg-rose-100 text-rose-800',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
        map[value] || 'bg-gray-100 text-gray-700'
      )}
    >
      {value}
    </span>
  );
}

type DetailTab = 'details' | 'comments' | 'history';

export default function WorkRequestsDetailModal({
  ticket,
  locationLabel,
  onClose,
  canFullWR,
  getAssigneeFor,
  setAssigneeFor,
  onAccepted,
}: {
  ticket: Ticket;
  locationLabel?: string;
  onClose: () => void;
  canFullWR: boolean;
  getAssigneeFor: (id: number) => number | '';
  setAssigneeFor: (id: number, assigneeId: number) => void;
  onAccepted?: () => void;
}) {
  const imagePaths = getTicketImagePaths(ticket.image ?? '');
  const { loading, bySectionActive } = useAssignees();

  const SECTIONS_ORDER: Array<
    'SIN ASIGNAR' | 'Internos' | 'TERCEROS' | 'OTROS'
  > = ['SIN ASIGNAR', 'Internos', 'TERCEROS', 'OTROS'];

  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('details');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pendingCommentCount, setPendingCommentCount] = useState(0);
  const [specialIncidentsById, setSpecialIncidentsById] = useState<
    Record<number, SpecialIncident>
  >({});
  const numericTicketId = useMemo(() => Number(ticket.id), [ticket.id]);
  const assigneeValue = useMemo(
    () => getAssigneeFor(Number(ticket.id)),
    [getAssigneeFor, ticket.id]
  );

  type TicketWithSpecialIncident = Ticket & {
    special_incident_id?: number | null;
  };

  async function handleAccept() {
    if (!canFullWR) {
      showToastError('No tienes permiso para aceptar solicitudes.');
      return;
    }
    if (!assigneeValue) {
      showToastError('Selecciona un responsable antes de aceptar.');
      return;
    }
    setSubmitting(true);
    try {
      await acceptTickets([
        { id: Number(ticket.id), assignee_id: Number(assigneeValue) },
      ]);
      showToastSuccess('Solicitud aceptada correctamente.');
      onAccepted?.(); // permite que el padre recargue y cierre
    } catch (error) {
      showToastError(
        `Hubo un error al aceptar la solicitud. Error: ${
          error instanceof Error ? error.message : 'Desconocido'
        }`
      );
    } finally {
      setSubmitting(false);
    }
  }

  function renderSpecialIncidentChip(specialIncidentId?: number | null) {
    if (!specialIncidentId) return null;
    const si = specialIncidentsById[Number(specialIncidentId)];
    if (!si) return null;
    return (
      <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
        {si.name}
      </span>
    );
  }

  const acceptDisabled = !canFullWR || !assigneeValue || submitting;

  const loadPendingCommentCount = useCallback(async () => {
    if (!currentUserId || !Number.isInteger(numericTicketId) || numericTicketId <= 0) {
      setPendingCommentCount(0);
      return;
    }

    const counts = await getUnreadTicketCommentNotificationCounts();
    setPendingCommentCount(counts[numericTicketId] ?? 0);
  }, [currentUserId, numericTicketId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getAllSpecialIncidents(); // activas e inactivas
        if (!cancelled) setSpecialIncidentsById(makeSpecialIncidentMap(list));
      } catch {
        // opcional: console.error
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) setCurrentUserId(user?.id ?? null);
      } catch {
        if (!cancelled) setCurrentUserId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setActiveTab('details');
    setPendingCommentCount(0);
  }, [ticket.id]);

  useEffect(() => {
    void loadPendingCommentCount().catch(() => {
      setPendingCommentCount(0);
    });
  }, [loadPendingCommentCount]);

  useEffect(() => {
    if (!currentUserId) return;

    return subscribeToMyNotificationDeliveries(currentUserId, () => {
      void loadPendingCommentCount().catch(() => {
        setPendingCommentCount(0);
      });
    });
  }, [currentUserId, loadPendingCommentCount]);

  useEffect(() => {
    if (activeTab !== 'comments') return;
    if (!Number.isInteger(numericTicketId) || numericTicketId <= 0) return;
    if (pendingCommentCount <= 0) return;

    setPendingCommentCount(0);
    void markTicketCommentNotificationsRead(numericTicketId)
      .then(() => loadPendingCommentCount())
      .catch(() => {
        void loadPendingCommentCount();
      });
  }, [activeTab, loadPendingCommentCount, numericTicketId, pendingCommentCount]);

  return (
    <AnimatedDialog
      open
      onClose={onClose}
      overlayClassName="bg-black/40 backdrop-blur-sm"
      panelClassName="w-full max-w-5xl max-h-[86vh] overflow-y-auto no-x-scroll rounded-xl bg-white shadow-2xl"
    >
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-xl font-semibold">
            <span>Solicitud #{ticket.id}</span>
            {(() => {
              const siId = (ticket as TicketWithSpecialIncident).special_incident_id;
              const chip = renderSpecialIncidentChip(siId);
              return chip ? (
                <span className="inline-flex items-center gap-1">
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
            })()}
          </h3>
          <p className="text-gray-500 wrap-anywhere">{ticket.title}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAccept}
            disabled={acceptDisabled}
            title={
              !canFullWR
                ? 'No tienes permiso para aceptar'
                : !assigneeValue
                  ? 'Selecciona un responsable'
                  : undefined
            }
            className={
              'inline-flex cursor-pointer items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40'
            }
          >
            {submitting ? 'Aceptando…' : 'Aceptar solicitud'}
          </button>

          <button
            onClick={onClose}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-gray-100 hover:bg-gray-200"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      </header>

      <nav className="px-6 pt-3">
        <div className="flex gap-6 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={cx(
              'border-b-2 pb-1 transition',
              activeTab === 'details'
                ? 'border-indigo-600 font-medium text-indigo-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            Detalles
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('comments')}
            className={cx(
              'inline-flex items-center gap-2 border-b-2 pb-1 transition',
              activeTab === 'comments'
                ? 'border-indigo-600 font-medium text-indigo-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            <span>Comentarios</span>
            {pendingCommentCount > 0 ? (
              <span
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white"
                title={
                  pendingCommentCount === 1
                    ? 'Tienes 1 comentario pendiente por revisar'
                    : `Tienes ${pendingCommentCount} comentarios pendientes por revisar`
                }
              >
                {pendingCommentCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={cx(
              'border-b-2 pb-1 transition',
              activeTab === 'history'
                ? 'border-indigo-600 font-medium text-indigo-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            Historial
          </button>
        </div>
      </nav>

      {activeTab === 'details' ? (
        <section className="grid grid-cols-1 gap-8 px-6 py-6 md:grid-cols-2">
          <div>
            <h4 className="mb-4 text-lg font-semibold">Información General</h4>
            <dl className="grid grid-cols-1 gap-3 text-sm">
              <div>
                <dt className="text-gray-500">Solicitante</dt>
                <dd className="wrap-anywhere text-gray-900">{ticket.requester}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Ubicación</dt>
                <dd className="text-gray-900">
                  {(locationLabel && locationLabel.trim()) || 'Sin ubicación'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Fecha de creación</dt>
                <dd className="text-gray-900">
                  {formatDateInTimezone(ticket.created_at)}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h4 className="mb-4 text-lg font-semibold">Estado y Prioridad</h4>
            <dl className="grid grid-cols-1 gap-3 text-sm">
              <div>
                <dt className="text-gray-500">Estado actual</dt>
                <dd className="mt-1">
                  <StatusChip value={ticket.status ?? 'Nueva'} />
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Prioridad</dt>
                <dd className="mt-1">
                  <PriorityChip value={ticket.priority ?? 'Media'} />
                </dd>
              </div>
            </dl>
          </div>

          <div className="md:col-span-2">
            <h4 className="mb-2 text-lg font-semibold">Asignación</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-gray-600">Responsable</label>
                <select
                  className={
                    'mt-1 w-full cursor-pointer rounded border-gray-300' +
                    (!canFullWR
                      ? ' cursor-not-allowed bg-gray-100 opacity-50'
                      : '')
                  }
                  disabled={loading || !canFullWR}
                  value={assigneeValue}
                  onChange={(event) =>
                    setAssigneeFor(Number(ticket.id), Number(event.target.value))
                  }
                >
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {SECTIONS_ORDER.map((group) => (
                    <optgroup key={group} label={group}>
                      {(bySectionActive[group] ?? []).map(
                        (assignee: Assignee | undefined) =>
                          assignee ? (
                            <option key={assignee.id} value={assignee.id}>
                              {formatAssigneeFullName(assignee)}
                            </option>
                          ) : null
                      )}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <h4 className="mb-2 text-lg font-semibold">Descripción del Problema</h4>
            <p className="wrap-anywhere whitespace-pre-wrap text-gray-700">
              {ticket.description || '—'}
            </p>
          </div>

          <div className="md:col-span-2">
            <h4 className="mb-3 text-lg font-semibold">Fotos Adjuntas</h4>
            {imagePaths.length === 0 ? (
              <p className="text-sm text-gray-500">No hay imágenes.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {imagePaths.map((path, index) => (
                  <a
                    key={index}
                    href={getPublicImageUrl(path)}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <img
                      src={getPublicImageUrl(path)}
                      alt={`Adjunto ${index + 1}`}
                      className="h-28 w-full rounded object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === 'comments' ? (
        <section className="space-y-4 px-6 py-6">
          <TicketChatPanel
            ticketId={numericTicketId}
            title="Chat interno"
            composerPlaceholder="Escribe una respuesta para este ticket..."
          />
        </section>
      ) : null}

      {activeTab === 'history' ? (
        <section className="px-6 py-6">
          <p className="text-sm text-gray-500">
            El historial de auditoría estará disponible en esta pestaña.
          </p>
        </section>
      ) : null}
    </AnimatedDialog>
  );
}
