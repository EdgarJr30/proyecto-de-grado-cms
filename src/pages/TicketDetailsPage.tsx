import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { markTicketCommentNotificationsRead } from '../services/notificationCenterService';
import { getTicketById } from '../services/ticketService';
import {
  addTicketComment,
  listTicketComments,
  type TicketComment,
} from '../services/ticketCommentsService';
import type { WorkOrder } from '../types/Ticket';
import TicketApprovalSection from '../components/tickets/TicketApprovalSection';
import TicketAssetChecklistSection from '../components/tickets/TicketAssetChecklistSection';
import {
  listTicketCollaborators,
  type Collaborator,
} from '../services/collaboratorService';
import { showToastError, showToastSuccess } from '../notifications';
import { formatDateInTimezone } from '../utils/formatDate';

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return formatDateInTimezone(value, 'America/Santo_Domingo', 'display');
}

export default function TicketDetailsPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const numericTicketId = useMemo(() => Number(ticketId), [ticketId]);
  const [ticket, setTicket] = useState<WorkOrder | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [checklistComplete, setChecklistComplete] = useState(true);

  const navigationState = (location.state ?? null) as
    | { backTo?: string; backLabel?: string }
    | null;
  const backTo = navigationState?.backTo?.trim() || '/mi-perfil';
  const backLabel = navigationState?.backLabel?.trim() || 'Mi perfil';

  const handleChecklistChange = useCallback(
    (view: { complete: boolean }) => setChecklistComplete(view.complete),
    []
  );

  const loadTicket = useCallback(async () => {
    if (!Number.isInteger(numericTicketId) || numericTicketId <= 0) {
      setTicket(null);
      return;
    }

    const row = await getTicketById(numericTicketId);
    setTicket(row);
  }, [numericTicketId]);

  const loadCollaborators = useCallback(async () => {
    if (!Number.isInteger(numericTicketId) || numericTicketId <= 0) {
      setCollaborators([]);
      return;
    }
    try {
      setCollaborators(await listTicketCollaborators(numericTicketId));
    } catch {
      setCollaborators([]);
    }
  }, [numericTicketId]);

  const loadComments = useCallback(async () => {
    if (!Number.isInteger(numericTicketId) || numericTicketId <= 0) {
      setComments([]);
      return;
    }

    const rows = await listTicketComments(numericTicketId);
    setComments(rows);
  }, [numericTicketId]);

  useEffect(() => {
    let alive = true;

    const bootstrap = async () => {
      setLoading(true);
      try {
        await Promise.all([loadTicket(), loadComments(), loadCollaborators()]);
      } catch (error: unknown) {
        const msg =
          error instanceof Error
            ? error.message
            : 'No se pudo cargar el detalle del ticket.';
        showToastError(msg);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      alive = false;
    };
  }, [loadComments, loadTicket, loadCollaborators]);

  useEffect(() => {
    if (!Number.isInteger(numericTicketId) || numericTicketId <= 0) return;

    const channel = supabase
      .channel(`ticket-comments:${numericTicketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_comments',
          filter: `ticket_id=eq.${numericTicketId}`,
        },
        () => {
          void loadComments();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadComments, numericTicketId]);

  useEffect(() => {
    if (!Number.isInteger(numericTicketId) || numericTicketId <= 0) return;

    void markTicketCommentNotificationsRead(numericTicketId).catch(() => undefined);
  }, [numericTicketId]);

  const handleSubmitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isInteger(numericTicketId) || numericTicketId <= 0) return;

    setPosting(true);
    try {
      await addTicketComment(numericTicketId, newComment);
      setNewComment('');
      await loadComments();
      showToastSuccess('Comentario agregado.');
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'No se pudo guardar el comentario.';
      showToastError(msg);
    } finally {
      setPosting(false);
    }
  };

  return (
    <main className="flex h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 md:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4">
        {loading ? (
          <div className="flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-12 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando ticket...
          </div>
        ) : !ticket ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-12 text-center text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            No se encontró el ticket solicitado.
          </div>
        ) : (
          <>
            <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Ticket #{ticket.id}
                  </span>
                  <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                    {ticket.status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/ordenes_trabajo?ticketId=${ticket.id}`, {
                      state: { openTicketId: ticket.id },
                    })
                  }
                  className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 sm:w-auto dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200 dark:hover:bg-indigo-500/25"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  Ir al ticket
                </button>
              </div>

              <h2 className="wrap-anywhere text-lg font-semibold text-slate-900 dark:text-slate-100">
                {ticket.title}
              </h2>
              <p className="wrap-anywhere mt-2 text-sm text-slate-600 dark:text-slate-300">
                {ticket.description}
              </p>

              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    Solicitante
                  </p>
                  <p className="wrap-anywhere font-medium text-slate-900 dark:text-slate-100">
                    {ticket.requester || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    Prioridad
                  </p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {ticket.priority}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    Urgente
                  </p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {ticket.is_urgent ? 'Sí' : 'No'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    Fecha límite
                  </p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {ticket.deadline_date || 'Sin definir'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    Ubicación
                  </p>
                  <p className="wrap-anywhere font-medium text-slate-900 dark:text-slate-100">
                    {ticket.location_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    Última actualización
                  </p>
                  <p className="wrap-anywhere font-medium text-slate-900 dark:text-slate-100">
                    {formatDateTime(
                      (
                        ticket as WorkOrder & {
                          updated_at?: string | null;
                        }
                      ).updated_at ?? ticket.created_at
                    )}
                  </p>
                </div>
              </div>
            </section>

            {collaborators.length > 0 && (
              <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Colaboradores
                </h3>
                <div className="flex flex-wrap gap-2">
                  {collaborators.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200"
                      title={c.email ?? undefined}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <TicketAssetChecklistSection
              ticketId={ticket.id as unknown as number}
              status={ticket.status}
              onChange={handleChecklistChange}
            />

            <TicketApprovalSection
              ticketId={ticket.id as unknown as number}
              status={ticket.status}
              checklistComplete={checklistComplete}
              onChanged={loadTicket}
            />

            <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex min-w-0 items-center gap-2">
                <MessageSquare className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
                <h3 className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Comentarios ({comments.length})
                </h3>
              </div>

              <form onSubmit={handleSubmitComment} className="mb-4 space-y-2">
                <textarea
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Escribe un comentario para este ticket..."
                  rows={3}
                  disabled={posting}
                  className="block w-full min-w-0 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-indigo-500/30"
                />
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => navigate(backTo)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Regresar a {backLabel}
                  </button>
                  <button
                    type="submit"
                    disabled={posting || newComment.trim().length === 0}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {posting ? 'Guardando...' : 'Agregar comentario'}
                  </button>
                </div>
              </form>

              {comments.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No hay comentarios registrados todavía.
                </p>
              ) : (
                <ul className="min-w-0 space-y-2 overflow-x-hidden">
                  {comments.map((comment) => (
                    <li
                      key={comment.id}
                      className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/60"
                    >
                      <div className="mb-1 flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <p className="min-w-0 break-words text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                          {comment.author_name || 'Usuario'}
                        </p>
                        <p className="shrink-0 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                          {formatDateTime(comment.created_at)}
                        </p>
                      </div>
                      <p className="wrap-anywhere text-sm text-slate-700 dark:text-slate-200">
                        {comment.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
        </div>
      </section>
    </main>
  );
}
