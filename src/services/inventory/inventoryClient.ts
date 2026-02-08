import { supabase } from '../../lib/supabaseClient';

export function inv() {
  return supabase;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unexpected error';
}
