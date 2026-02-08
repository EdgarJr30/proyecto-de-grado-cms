import { toast, type ToastOptions, type ToastContent } from 'react-toastify';

/** Normaliza mensaje a string legible para consola */
function asText(msg: ToastContent) {
  if (typeof msg === 'string') return msg;
  try {
    return JSON.stringify(msg);
  } catch {
    return String(msg);
  }
}

/** Toast de éxito con log */
export function showToastSuccess(message: ToastContent, opts?: ToastOptions) {
  console.log(`✅ [toast-success] ${asText(message)}`);
  return toast.success(message, opts);
}

/** Toast de error con log */
export function showToastError(message: ToastContent, opts?: ToastOptions) {
  console.error(`❌ [toast-error] ${asText(message)}`);
  return toast.error(message, opts);
}

/** Toast de info con log */
export function showToastInfo(message: ToastContent, opts?: ToastOptions) {
  console.info(`ℹ️ [toast-info] ${asText(message)}`);
  return toast.info(message, opts);
}

/** Toast de warning opcional con log */
export function showToastWarning(message: ToastContent, opts?: ToastOptions) {
  console.warn(`⚠️ [toast-warning] ${asText(message)}`);
  return toast.warning(message, opts);
}

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
  error?: string;
  error_description?: string;
  status?: number;
  statusCode?: number;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null
    ? (v as Record<string, unknown>)
    : null;
}

export function formatError(error: unknown): string {
  // Error normal
  if (error instanceof Error) {
    const rec = asRecord(error);
    // Algunos errors envuelven info extra
    const msg = rec?.message ? String(rec.message) : error.message;
    return msg || 'Error desconocido';
  }

  // Response (fetch)
  if (typeof Response !== 'undefined' && error instanceof Response) {
    return `HTTP ${error.status} ${error.statusText}`.trim();
  }

  // Supabase/PostgREST (PostgrestError / AuthError / etc.)
  const rec = asRecord(error) as SupabaseLikeError | null;
  if (rec) {
    const parts: string[] = [];

    const msg = rec.message ?? rec.error_description ?? rec.error ?? undefined;

    if (msg) parts.push(String(msg));

    if (rec.details) parts.push(`Details: ${String(rec.details)}`);
    if (rec.hint) parts.push(`Hint: ${String(rec.hint)}`);
    if (rec.code) parts.push(`Code: ${String(rec.code)}`);

    const status = rec.status ?? rec.statusCode;
    if (status) parts.push(`HTTP: ${String(status)}`);

    if (parts.length) return parts.join(' • ');
  }

  // String directo
  if (typeof error === 'string') return error;

  // Fallback
  try {
    return JSON.stringify(error);
  } catch {
    return 'Error desconocido';
  }
}
