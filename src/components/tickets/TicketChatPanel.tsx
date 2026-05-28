import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { Clock3, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { showConfirmAlert, showToastError, showToastSuccess } from '../../notifications';
import { formatDateInTimezone } from '../../utils/formatDate';
import {
  addTicketComment,
  listTicketComments,
  type TicketComment,
} from '../../services/ticketCommentsService';
import {
  addTicketCollaborator,
  canIManageCollaborators,
  listCollaboratorCandidates,
  type Collaborator,
} from '../../services/collaboratorService';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Detecta una mención "@..." activa justo antes del cursor.
 * Devuelve el índice de la "@" y el texto escrito tras ella, o null.
 */
function detectMention(
  value: string,
  caret: number
): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const m = before.match(/(^|\s)@([\p{L}\p{N}._-]*)$/u);
  if (!m) return null;
  const query = m[2] ?? '';
  return { start: caret - query.length - 1, query };
}

type TicketChatPanelProps = {
  ticketId: number;
  title?: string;
  emptyMessage?: string;
  composerPlaceholder?: string;
  maxHeightClassName?: string;
};

export default function TicketChatPanel({
  ticketId,
  title = 'Chat interno',
  emptyMessage = 'No hay comentarios registrados todavía.',
  composerPlaceholder = 'Escribe una respuesta para este ticket...',
  maxHeightClassName = 'max-h-[380px]',
}: TicketChatPanelProps) {
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // --- Menciones (@usuario) para agregar colaboradores estilo Asana ---
  const [canManageCollab, setCanManageCollab] = useState(false);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<Collaborator[]>([]);
  const [addingCollab, setAddingCollab] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const validTicketId = useMemo(
    () => (Number.isInteger(ticketId) && ticketId > 0 ? ticketId : 0),
    [ticketId]
  );

  const loadComments = useCallback(async () => {
    if (!validTicketId) {
      setComments([]);
      return;
    }

    const rows = await listTicketComments(validTicketId);
    setComments(rows);
  }, [validTicketId]);

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
    setCommentDraft('');
    let alive = true;
    setCommentsLoading(true);

    void loadComments()
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar comentarios.';
        showToastError(message);
      })
      .finally(() => {
        if (alive) setCommentsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [loadComments, validTicketId]);

  useEffect(() => {
    if (!validTicketId) return;

    const channel = supabase
      .channel(`ticket-comments-panel:${validTicketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_comments',
          filter: `ticket_id=eq.${validTicketId}`,
        },
        () => {
          void loadComments();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadComments, validTicketId]);

  async function handleCommentSubmit() {
    if (!validTicketId) return;
    if (postingComment || commentDraft.trim().length === 0) return;

    setPostingComment(true);
    try {
      await addTicketComment(validTicketId, commentDraft);
      setCommentDraft('');
      await loadComments();
      showToastSuccess('Comentario agregado.');
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo registrar el comentario.';
      showToastError(message);
    } finally {
      setPostingComment(false);
    }
  }

  // ¿El usuario actual puede gestionar colaboradores? (admin o responsable)
  useEffect(() => {
    if (!validTicketId) {
      setCanManageCollab(false);
      return;
    }
    let alive = true;
    void canIManageCollaborators(validTicketId).then((v) => {
      if (alive) setCanManageCollab(v);
    });
    return () => {
      alive = false;
    };
  }, [validTicketId]);

  // Busca candidatos mientras hay una mención activa (solo si puede gestionar).
  useEffect(() => {
    if (!mention || !canManageCollab || !validTicketId) {
      setMentionCandidates([]);
      return;
    }
    let alive = true;
    const handle = window.setTimeout(() => {
      void listCollaboratorCandidates(validTicketId, mention.query)
        .then((rows) => {
          if (alive) setMentionCandidates(rows);
        })
        .catch(() => {
          if (alive) setMentionCandidates([]);
        });
    }, 200);
    return () => {
      alive = false;
      window.clearTimeout(handle);
    };
  }, [mention, canManageCollab, validTicketId]);

  const handleDraftChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setCommentDraft(value);
    if (!canManageCollab) {
      setMention(null);
      return;
    }
    const caret = event.target.selectionStart ?? value.length;
    setMention(detectMention(value, caret));
  };

  const handlePickMention = async (candidate: Collaborator) => {
    const active = mention;
    if (!active || addingCollab) return;

    const ok = await showConfirmAlert({
      title: 'Agregar colaborador',
      text: `¿Quieres agregar a ${candidate.label} como colaborador de esta tarea? Estará recibiendo todas las modificaciones realizadas en ella.`,
      icon: 'question',
      confirmButtonText: 'Sí, agregar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5',
    });
    if (!ok) {
      setMention(null);
      setMentionCandidates([]);
      return;
    }

    setAddingCollab(true);
    try {
      await addTicketCollaborator(validTicketId, candidate.id);
      // Reemplaza el token "@query" por "@Nombre " en el mensaje.
      setCommentDraft((prev) => {
        const tokenEnd = active.start + 1 + active.query.length;
        return `${prev.slice(0, active.start)}@${candidate.label} ${prev.slice(tokenEnd)}`;
      });
      showToastSuccess(`${candidate.label} agregado como colaborador.`);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'No se pudo agregar el colaborador.';
      showToastError(message);
    } finally {
      setAddingCollab(false);
      setMention(null);
      setMentionCandidates([]);
      textareaRef.current?.focus();
    }
  };

  return (
    <section className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="flex min-w-0 items-center gap-2">
        <MessageSquare className="h-4 w-4 shrink-0 text-indigo-600" />
        <h4 className="min-w-0 truncate text-lg font-semibold">
          {title} ({comments.length})
        </h4>
      </div>

      <div className="min-w-0 space-y-2">
        <div className="relative min-w-0">
          <textarea
            ref={textareaRef}
            value={commentDraft}
            onChange={handleDraftChange}
            onKeyDown={(event) => {
              if (mention && event.key === 'Escape') {
                event.preventDefault();
                setMention(null);
                setMentionCandidates([]);
                return;
              }
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                void handleCommentSubmit();
              }
            }}
            rows={3}
            placeholder={composerPlaceholder}
            disabled={postingComment}
            className="block w-full min-w-0 resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-indigo-500/30"
          />
          {canManageCollab && mention && mentionCandidates.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <li className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700">
                Agregar colaborador
              </li>
              {mentionCandidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      void handlePickMention(candidate);
                    }}
                    disabled={addingCollab}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-indigo-50 disabled:opacity-60 dark:hover:bg-indigo-500/10"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {candidate.label}
                    </span>
                    {candidate.email && (
                      <span className="text-xs text-slate-500">{candidate.email}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              void handleCommentSubmit();
            }}
            disabled={postingComment || commentDraft.trim().length === 0}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {postingComment ? 'Guardando...' : 'Enviar comentario'}
          </button>
        </div>
      </div>

      <div
        className={cx(
          maxHeightClassName,
          'min-w-0 space-y-3 overflow-y-auto overflow-x-hidden rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950/60'
        )}
      >
        {commentsLoading ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Cargando comentarios...
          </p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {emptyMessage}
          </p>
        ) : (
          comments.map((comment) => {
            const isCurrentUser = currentUserId === comment.author_user_id;
            return (
              <article
                key={comment.id}
                className={cx(
                  'min-w-0 max-w-full rounded-xl border px-3 py-2 sm:max-w-[88%]',
                  isCurrentUser
                    ? 'ml-auto border-indigo-600 bg-indigo-600 text-white'
                    : 'border-gray-200 bg-white text-gray-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                )}
              >
                <div className="mb-1 flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs">
                  <p
                    className={cx(
                      'min-w-0 break-words font-semibold uppercase',
                      isCurrentUser
                        ? 'text-indigo-100'
                        : 'text-gray-600 dark:text-slate-300'
                    )}
                  >
                    {comment.author_name || 'Usuario'}
                  </p>
                  <p
                    className={cx(
                      'inline-flex shrink-0 items-center gap-1 whitespace-nowrap',
                      isCurrentUser
                        ? 'text-indigo-100'
                        : 'text-gray-500 dark:text-slate-400'
                    )}
                  >
                    <Clock3 className="h-3 w-3" />
                    {formatDateInTimezone(comment.created_at)}
                  </p>
                </div>
                <p className="wrap-anywhere text-sm">{comment.body}</p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
