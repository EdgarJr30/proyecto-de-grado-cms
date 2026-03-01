// src/context/UserContext.tsx
import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
  type UserProfile,
  type UserProfilePatch,
} from '../services/userService';
import { supabase } from '../lib/supabaseClient';
import { onDataInvalidated } from '../lib/dataInvalidation';

type RefreshOptions = { silent?: boolean };

type UserState = {
  loading: boolean;
  error: string | null;
  profile: UserProfile | null;
  refresh: (opts?: RefreshOptions) => Promise<void>;
  update: (patch: UserProfilePatch) => Promise<{ ok: boolean; error?: string }>;
};

const UserContext = createContext<UserState | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Marca de hidratación inicial
  const hydratedRef = useRef(false);

  // 👇 Nuevo: ignorar refrescos silenciosos si la pestaña está oculta
  const ignoreSilentRef = useRef(document.visibilityState === 'hidden');
  useEffect(() => {
    const onVis = () => {
      ignoreSilentRef.current = document.visibilityState === 'hidden';
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const refresh = useCallback(
    async (opts: RefreshOptions = {}) => {
      const { silent = false } = opts;
      const shouldBlock = !hydratedRef.current && !silent;

      if (shouldBlock) setLoading(true);
      setError(null);

      try {
        if (!isAuthenticated) {
          setProfile(null);
          return;
        }
        const p = await getCurrentUserProfile();
        setProfile(p);
      } catch (e: unknown) {
        const msg =
          e instanceof Error
            ? e.message
            : 'Error inesperado obteniendo el perfil';
        setError(msg);
        console.error(msg);
      } finally {
        if (shouldBlock) {
          setLoading(false);
          hydratedRef.current = true;
        }
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    // Hidratación inicial
    void refresh();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      switch (event) {
        case 'SIGNED_OUT':
          setProfile(null);
          setLoading(false);
          hydratedRef.current = true;
          break;
        case 'SIGNED_IN':
        case 'INITIAL_SESSION':
          // SIGNED_IN puede dispararse al recuperar foco; evita bloquear UI.
          void refresh({ silent: true });
          break;
        case 'USER_UPDATED':
        case 'TOKEN_REFRESHED':
          // Solo refresca de forma silenciosa si la pestaña está visible.
          if (!ignoreSilentRef.current) {
            void refresh({ silent: true });
          }
          break;
        default:
          break;
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    return onDataInvalidated('users', () => {
      if (!isAuthenticated) return;
      void refresh({ silent: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const update = useCallback(
    async (patch: UserProfilePatch) => {
      if (!isAuthenticated) {
        return { ok: false, error: 'No hay sesión activa' };
      }

      const prev = profile;
      try {
        if (prev) setProfile({ ...prev, ...patch });
        const updated = await updateCurrentUserProfile(patch);
        if (!updated) {
          if (prev) setProfile(prev);
          return { ok: false, error: 'No se pudo actualizar el perfil' };
        }
        setProfile(updated);
        return { ok: true };
      } catch (e: unknown) {
        if (prev) setProfile(prev);
        const msg =
          e instanceof Error
            ? e.message
            : 'Error inesperado actualizando el perfil';
        setError(msg);
        return { ok: false, error: msg };
      }
    },
    [isAuthenticated, profile]
  );

  const value = useMemo<UserState>(
    () => ({
      loading,
      error,
      profile,
      refresh,
      update,
    }),
    [loading, error, profile, refresh, update]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
