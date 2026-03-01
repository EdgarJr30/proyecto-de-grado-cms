// src/context/AuthContext.tsx
import React, {
  createContext,
  useCallback,
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

function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message.toLowerCase();
  }
  return '';
}

function isSessionMissingError(error: unknown): boolean {
  const msg = getAuthErrorMessage(error);
  return (
    msg.includes('auth session missing') ||
    msg.includes('session missing') ||
    msg.includes('refresh token not found') ||
    msg.includes('invalid refresh token')
  );
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

  const doRefresh = useCallback(async ({ silent }: RefreshOptions = {}) => {
    const shouldBlock = !hydratedRef.current && !silent;
    if (shouldBlock) setLoading(true);
    try {
      // 1) ¿hay sesión guardada?
      const {
        data: { session },
        error: sErr,
      } = await supabase.auth.getSession();
      if (sErr) {
        if (isSessionMissingError(sErr)) {
          setIsAuthenticated(false);
          return;
        }
        // Error transitorio de red/infra: conserva estado anterior.
        console.warn('[Auth] getSession transient error:', sErr.message);
        return;
      }

      if (!session) {
        setIsAuthenticated(false);
        return;
      }

      // 2) valida que el token sea realmente usable
      const { data: userData, error: uErr } = await supabase.auth.getUser();
      if (uErr) {
        if (isSessionMissingError(uErr)) {
          setIsAuthenticated(false);
          return;
        }
        // Supabase emite SIGNED_IN en refocus; un error temporal de getUser
        // no debe cerrar sesión ni resetear la app.
        console.warn('[Auth] getUser transient error:', uErr.message);
        setIsAuthenticated(true);
        return;
      }

      if (!userData?.user) {
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
  }, []);

  // Debouncea los refresh “silenciosos”
  const debouncedSilentRefresh = useMemo(
    () =>
      debounce(() => {
        void doRefresh({ silent: true });
      }, 300),
    [doRefresh]
  );

  const refresh = useCallback(
    async (opts?: RefreshOptions) => doRefresh(opts),
    [doRefresh]
  );

  useEffect(() => {
    // Hidratación inicial (bloqueante)
    void doRefresh();

    // Suscripción a eventos de auth
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setLoading(false);
        hydratedRef.current = true;
        return;
      }

      // SIGNED_IN puede dispararse también al refocus.
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        void doRefresh({ silent: true });
        return;
      }

      // Eventos silenciosos: ignorar si la pestaña está oculta.
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (ignoreSilentEventsRef.current) {
          return;
        }
        debouncedSilentRefresh();
        return;
      }

      // Otros: no hacen nada
    });

    return () => sub?.subscription.unsubscribe();
  }, [debouncedSilentRefresh, doRefresh]);

  const value = useMemo<AuthState>(
    () => ({ loading, isAuthenticated, refresh }),
    [loading, isAuthenticated, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
