// src/rbac/PermissionsContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { supabase } from '../lib/supabaseClient';

type PermsState = {
  // permisos
  set: Set<string>;
  list: string[];
  has: (code: string | string[]) => boolean;

  // roles (nombres)
  roles: string[];

  // estado & acciones
  ready: boolean;
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
};

const LS_PERMS = 'mlm:perms';
const LS_ROLES = 'mlm:roles';

const PermCtx = createContext<PermsState>({
  set: new Set(),
  list: [],
  roles: [],
  ready: false,
  has: () => false,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  refresh: async () => {},
});

// ------- helpers -------
function debounce<F extends (...a: unknown[]) => void>(fn: F, ms: number) {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
const shallowEq = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

// cache en módulo (permisos)
let cachedPerms: string[] | null = null;
let inflightPerms: Promise<string[]> | null = null;
let permsTs = 0;

// cache en módulo (roles)
let cachedRoles: string[] | null = null;
let inflightRoles: Promise<string[]> | null = null;
let rolesTs = 0;

const CACHE_TTL_MS = 5 * 60_000; // 5 min

async function fetchPermsOnce(): Promise<string[]> {
  const now = Date.now();
  if (cachedPerms && now - permsTs < CACHE_TTL_MS) return cachedPerms;
  if (inflightPerms) return inflightPerms;

  inflightPerms = (async () => {
    const { data, error } = await supabase.rpc('my_permissions');
    if (error) throw error;

    const list = Array.isArray(data)
      ? data.map((d: { code: string }) => d.code)
      : [];
    const norm = [...new Set(list)].filter(Boolean).sort();
    cachedPerms = norm;
    permsTs = Date.now();
    return norm;
  })();

  try {
    return await inflightPerms;
  } finally {
    inflightPerms = null;
  }
}

async function fetchUserRolesOnce(): Promise<string[]> {
  const now = Date.now();
  if (cachedRoles && now - rolesTs < CACHE_TTL_MS) return cachedRoles;
  if (inflightRoles) return inflightRoles;

  inflightRoles = (async () => {
    const {
      data: { user },
      error: uErr,
    } = await supabase.auth.getUser();
    if (uErr) throw uErr;
    if (!user) return [];

    // Trae nombres de rol a partir de roles ⨝ user_roles para el usuario actual
    const { data: rows, error: joinErr } = await supabase
      .from('roles')
      .select('name, user_roles!inner(user_id)')
      .eq('user_roles.user_id', user.id);

    if (joinErr) throw joinErr;

    const names = (rows ?? [])
      .map((r: { name?: string | null }) => r.name)
      .filter((n): n is string => Boolean(n && n.trim()))
      .map((n) => n.trim());

    const norm = [...new Set(names)].sort();
    cachedRoles = norm;
    rolesTs = Date.now();
    return norm;
  })();

  try {
    return await inflightRoles;
  } finally {
    inflightRoles = null;
  }
}

export function PermissionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // hidrata desde localStorage para evitar parpadeo inicial
  const [codes, setCodes] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(LS_PERMS);
      const arr = raw ? JSON.parse(raw) : [];
      const norm = (Array.isArray(arr) ? (arr as string[]) : [])
        .filter(Boolean)
        .sort();
      if (norm.length) {
        cachedPerms = norm;
        permsTs = Date.now();
      }
      return norm;
    } catch {
      return [];
    }
  });

  const [roles, setRoles] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(LS_ROLES);
      const arr = raw ? JSON.parse(raw) : [];
      const norm = (Array.isArray(arr) ? (arr as string[]) : [])
        .filter(Boolean)
        .sort();
      if (norm.length) {
        cachedRoles = norm;
        rolesTs = Date.now();
      }
      return norm;
    } catch {
      return [];
    }
  });

  const [ready, setReady] = useState<boolean>(false);

  // visibilidad de pestaña (para ignorar silenciosos sin foco)
  const ignoreSilentRef = useRef(document.visibilityState === 'hidden');
  useEffect(() => {
    const onVis = () => {
      ignoreSilentRef.current = document.visibilityState === 'hidden';
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const setLocalPerms = (list: string[]) => {
    setCodes((prev) => {
      if (!shallowEq(prev, list)) {
        try {
          localStorage.setItem(LS_PERMS, JSON.stringify(list));
        } catch {
          /* empty */
        }
        return list;
      }
      return prev;
    });
  };

  const setLocalRoles = (list: string[]) => {
    setRoles((prev) => {
      if (!shallowEq(prev, list)) {
        try {
          localStorage.setItem(LS_ROLES, JSON.stringify(list));
        } catch {
          /* empty */
        }
        return list;
      }
      return prev;
    });
  };

  const _refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      if (!silent && !ready) setReady(false);
      try {
        const [permList, roleList] = await Promise.all([
          fetchPermsOnce(),
          fetchUserRolesOnce(),
        ]);
        setLocalPerms(permList);
        setLocalRoles(roleList);
        if (!ready) setReady(true);
      } catch (e) {
        console.error('[Permissions] refresh error:', (e as Error).message);
        setLocalPerms([]);
        setLocalRoles([]);
        if (!ready) setReady(true);
      }
    },
    [ready]
  );

  // debounce para eventos silenciosos
  const debouncedSilent = useMemo(
    () =>
      debounce(() => {
        void _refresh({ silent: true });
      }, 300),
    [_refresh]
  );

  // carga inicial
  useEffect(() => {
    const hasLocal = codes.length > 0 || roles.length > 0;
    setReady(false);
    void _refresh({ silent: hasLocal }).finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // escucha eventos de auth
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      switch (evt) {
        case 'SIGNED_IN':
        case 'SIGNED_OUT':
          // invalida caches y refresca (hard)
          cachedPerms = null;
          permsTs = 0;
          cachedRoles = null;
          rolesTs = 0;
          if (evt === 'SIGNED_OUT') {
            setLocalPerms([]);
            setLocalRoles([]);
            setReady(true);
            try {
              localStorage.removeItem(LS_PERMS);
              localStorage.removeItem(LS_ROLES);
            } catch {
              /* empty */
            }
          } else {
            void _refresh({ silent: false });
          }
          break;

        case 'USER_UPDATED':
        case 'TOKEN_REFRESHED':
          if (!ignoreSilentRef.current) {
            cachedPerms = null;
            permsTs = 0;
            cachedRoles = null;
            rolesTs = 0;
            debouncedSilent(); // no bloquees UI
          }
          break;

        default:
          break;
      }
    });
    return () => sub?.subscription.unsubscribe();
  }, [_refresh, debouncedSilent]);

  const setObj = useMemo(() => new Set(codes), [codes]);

  const has = useCallback(
    (q: string | string[]) => {
      if (Array.isArray(q)) return q.some((code) => setObj.has(code));
      return setObj.has(q);
    },
    [setObj]
  );

  const value = useMemo<PermsState>(
    () => ({
      set: setObj,
      list: codes,
      roles,
      ready,
      has,
      refresh: (opts?: { silent?: boolean }) => _refresh(opts),
    }),
    [setObj, codes, roles, ready, has, _refresh]
  );

  return <PermCtx.Provider value={value}>{children}</PermCtx.Provider>;
}

export function usePermissions() {
  return useContext(PermCtx);
}

export function useCan(code: string | string[]) {
  const { has } = usePermissions();
  return has(code);
}

export function Can({
  perm,
  children,
  fallback = null,
}: {
  perm: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return useCan(perm) ? <>{children}</> : <>{fallback}</>;
}
