import { supabase } from '../lib/supabaseClient';

export type TicketComment = {
  id: number;
  ticket_id: number;
  author_user_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
};

type TicketCommentRow = {
  id: number | string;
  ticket_id: number | string;
  author_user_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
};

type BasicCommentRow = {
  id: number | string;
  ticket_id: number | string;
  author_user_id: string;
  body: string;
  created_at: string;
};

type UserNameRow = {
  id: string;
  name: string | null;
  last_name: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractSupabaseError(error: unknown, fallback: string) {
  if (!isRecord(error)) return fallback;

  const message =
    typeof error.message === 'string' ? error.message.trim() : '';
  const details =
    typeof error.details === 'string' ? error.details.trim() : '';
  const hint = typeof error.hint === 'string' ? error.hint.trim() : '';
  const code = typeof error.code === 'string' ? error.code.trim() : '';

  const parts = [message, details, hint].filter((part) => part.length > 0);
  const base = parts.length > 0 ? parts.join(' | ') : fallback;
  return code.length > 0 ? `${base} [${code}]` : base;
}

function isMissingFunctionError(error: unknown, functionName: string) {
  if (!isRecord(error)) return false;
  const code = typeof error.code === 'string' ? error.code : '';
  const message = typeof error.message === 'string' ? error.message : '';
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    message.toLowerCase().includes(functionName.toLowerCase())
  );
}

function toNumber(value: number | string): number {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapCommentRow(row: TicketCommentRow): TicketComment {
  const authorName = row.author_name?.trim() ?? '';

  return {
    id: toNumber(row.id),
    ticket_id: toNumber(row.ticket_id),
    author_user_id: row.author_user_id,
    body: row.body,
    created_at: row.created_at,
    author_name: authorName.length > 0 ? authorName : null,
  };
}

function mapCommentBasicRow(
  row: BasicCommentRow,
  usersById: Record<string, string>
): TicketComment {
  const authorName = usersById[row.author_user_id] ?? null;
  return {
    id: toNumber(row.id),
    ticket_id: toNumber(row.ticket_id),
    author_user_id: row.author_user_id,
    body: row.body,
    created_at: row.created_at,
    author_name: authorName,
  };
}

async function listTicketCommentsFallback(ticketId: number): Promise<TicketComment[]> {
  const { data, error } = await supabase
    .from('ticket_comments')
    .select('id, ticket_id, author_user_id, body, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw new Error(
      extractSupabaseError(error, 'No se pudieron cargar comentarios.')
    );
  }

  const rows = (data ?? []) as BasicCommentRow[];
  const authorIds = Array.from(new Set(rows.map((row) => row.author_user_id)));
  if (authorIds.length === 0) return [];

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, name, last_name')
    .in('id', authorIds);

  if (usersError) {
    throw new Error(
      extractSupabaseError(usersError, 'No se pudieron cargar autores de comentarios.')
    );
  }

  const usersById: Record<string, string> = {};
  for (const user of (usersData ?? []) as UserNameRow[]) {
    const fullName = `${user.name?.trim() ?? ''} ${user.last_name?.trim() ?? ''}`.trim();
    if (fullName.length > 0) usersById[user.id] = fullName;
  }

  return rows.map((row) => mapCommentBasicRow(row, usersById));
}

export async function listTicketComments(ticketId: number): Promise<TicketComment[]> {
  const { data, error } = await supabase.rpc('list_ticket_comments', {
    p_ticket_id: ticketId,
  });

  if (error && isMissingFunctionError(error, 'list_ticket_comments')) {
    return listTicketCommentsFallback(ticketId);
  }

  if (error) {
    throw new Error(
      extractSupabaseError(error, 'No se pudieron cargar comentarios.')
    );
  }

  return ((data ?? []) as unknown[]).map((row) =>
    mapCommentRow(row as TicketCommentRow)
  );
}

export async function addTicketComment(ticketId: number, body: string): Promise<void> {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new Error('El comentario no puede estar vacío.');
  }

  const { error: rpcError } = await supabase.rpc('add_ticket_comment', {
    p_ticket_id: ticketId,
    p_body: trimmed,
  });

  if (!rpcError) return;

  if (!isMissingFunctionError(rpcError, 'add_ticket_comment')) {
    throw new Error(
      extractSupabaseError(rpcError, 'No se pudo registrar el comentario.')
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(extractSupabaseError(userError, 'No se pudo validar la sesión.'));
  }
  if (!user?.id) {
    throw new Error('No hay sesión activa.');
  }

  const { error: insertError } = await supabase.from('ticket_comments').insert({
    ticket_id: ticketId,
    author_user_id: user.id,
    body: trimmed,
  });

  if (insertError) {
    throw new Error(
      extractSupabaseError(insertError, 'No se pudo registrar el comentario.')
    );
  }
}
