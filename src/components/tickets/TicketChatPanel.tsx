import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, MessageSquare } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { showToastError, showToastSuccess } from '../../notifications';
import { formatDateInTimezone } from '../../utils/formatDate';
import {
  addTicketComment,
  listTicketComments,
  type TicketComment,
} from '../../services/ticketCommentsService';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
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

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-indigo-600" />
        <h4 className="text-lg font-semibold">
          {title} ({comments.length})
        </h4>
      </div>

      <div className="space-y-2">
        <textarea
          value={commentDraft}
          onChange={(event) => setCommentDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              void handleCommentSubmit();
            }
          }}
          rows={3}
          placeholder={composerPlaceholder}
          disabled={postingComment}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
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
          'space-y-3 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3'
        )}
      >
        {commentsLoading ? (
          <p className="text-sm text-gray-500">Cargando comentarios...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        ) : (
          comments.map((comment) => {
            const isCurrentUser = currentUserId === comment.author_user_id;
            return (
              <article
                key={comment.id}
                className={cx(
                  'max-w-[88%] rounded-xl border px-3 py-2',
                  isCurrentUser
                    ? 'ml-auto border-indigo-600 bg-indigo-600 text-white'
                    : 'border-gray-200 bg-white text-gray-900'
                )}
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <p
                    className={cx(
                      'font-semibold uppercase',
                      isCurrentUser ? 'text-indigo-100' : 'text-gray-600'
                    )}
                  >
                    {comment.author_name || 'Usuario'}
                  </p>
                  <p
                    className={cx(
                      'inline-flex items-center gap-1',
                      isCurrentUser ? 'text-indigo-100' : 'text-gray-500'
                    )}
                  >
                    <Clock3 className="h-3 w-3" />
                    {formatDateInTimezone(comment.created_at)}
                  </p>
                </div>
                <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
