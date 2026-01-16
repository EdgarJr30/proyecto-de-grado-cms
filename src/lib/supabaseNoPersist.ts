import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or anon key');
}

/**
 * Cliente aislado para signUp:
 * - NO persiste sesión (no toca localStorage)
 * - NO auto refresca tokens
 * - NO detecta sesión en URL
 * - Usa un storage inerte para evitar cualquier escritura
 */
export const supabaseNoPersist = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  },
  // opcional: solo para trazar llamadas si quieres diferenciarlas en logs/proxies
  // global: { headers: { 'x-client-ctx': 'admin-signup' } },
});
