// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '../lib/supabaseClient';

type RefreshOptions = { silent?: boolean };

type AuthState = {
  loading: boolean;
  isAuthenticated: boolean;
  refresh: (opts?: RefreshOptions) => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

// Utilidad: debounce simple
function debounce<F extends (...args: unknown[]) => void>(fn: F, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Evita bloquear la UI luego de la primera hidratación
  const hydratedRef = useRef(false);

  // Flag: ignorar eventos silenciosos (TOKEN_REFRESHED / USER_UPDATED) cuando la pestaña está oculta
  const ignoreSilentEventsRef = useRef(document.visibilityState === 'hidden');

  useEffect(() => {
    const onVis = () => {
      ignoreSilentEventsRef.current = document.visibilityState === 'hidden';
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const doRefresh = async ({ silent }: RefreshOptions = {}) => {
    const shouldBlock = !hydratedRef.current && !silent;
    if (shouldBlock) setLoading(true);
    try {
      // 1) ¿hay sesión guardada?
      const {
        data: { session },
        error: sErr,
      } = await supabase.auth.getSession();
      if (sErr) console.warn('[Auth] getSession error:', sErr.message);

      if (!session) {
        setIsAuthenticated(false);
        return;
      }

      // 2) valida que el token sea realmente usable
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr || !userData?.user) {
        console.warn('[Auth] invalid session → signing out');
        await supabase.auth.signOut();
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);
    } finally {
      if (shouldBlock) {
        setLoading(false);
        hydratedRef.current = true;
      }
    }
  };

  // Debouncea los refresh “silenciosos”
  const debouncedSilentRefresh = useMemo(
    () =>
      debounce(() => {
        void doRefresh({ silent: true });
      }, 300),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const refresh = async (opts?: RefreshOptions) => doRefresh(opts);

  useEffect(() => {
    // Hidratación inicial (bloqueante)
    void doRefresh();

    // Suscripción a eventos de auth
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Eventos “duros”: siempre refrescar (aunque bloquee en primera carga)
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        void doRefresh();
        return;
      }

      // Eventos “silenciosos”: ignorar si la pestaña está oculta; si no, hacer refresh SILENCIOSO con debounce
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (ignoreSilentEventsRef.current) {
          // ignoramos mientras no haya foco
          return;
        }
        debouncedSilentRefresh();
        return;
      }

      // Otros: no hacen nada
    });

    return () => sub?.subscription.unsubscribe();
  }, [debouncedSilentRefresh]);

  const value = useMemo<AuthState>(
    () => ({ loading, isAuthenticated, refresh }),
    [loading, isAuthenticated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
