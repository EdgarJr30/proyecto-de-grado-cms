import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getPublicSociety } from '../services/societyService';
import { getBrandingPublicUrl } from '../services/brandingStorageService';

type PublicSociety = {
  id: number;
  name: string;
  logo_url: string | null;
  login_img_url: string | null;
  updated_at: string;
};

type BrandingState = {
  society: PublicSociety | null;
  loading: boolean;
  // “resolved urls” (ya listas para <img src="...">)
  societyName: string;
  logoSrc: string | null; // null si aún no tenemos nada cacheado
  loginImgSrc: string | null; // null si aún no tenemos nada cacheado
  refresh: (opts?: { silent?: boolean }) => Promise<void>;
};

const BrandingContext = createContext<BrandingState | null>(null);

const LS_KEY = 'mlm:branding:v1';

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

// cache minimal para pintar sin flash
type BrandingCache = {
  society: PublicSociety | null;
  resolved: {
    societyName: string;
    logoSrc: string | null;
    loginImgSrc: string | null;
  };
  updatedAt: string; // para debugging
};

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  // 1) hidrata desde localStorage SIN esperar red (evita flash)
  const cached = useMemo(() => {
    const c = safeJsonParse<BrandingCache>(localStorage.getItem(LS_KEY));
    return c;
  }, []);

  const [society, setSociety] = useState<PublicSociety | null>(
    cached?.society ?? null
  );
  const [loading, setLoading] = useState<boolean>(!cached); // si hay cache, no bloquees UI
  const [resolved, setResolved] = useState<BrandingCache['resolved']>(() => {
    return (
      cached?.resolved ?? {
        societyName: 'CompanyName',
        logoSrc: null,
        loginImgSrc: null,
      }
    );
  });

  const refresh = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? true;
    if (!silent) setLoading(true);

    try {
      const s = (await getPublicSociety()) as PublicSociety | null;

      setSociety(s);

      const societyName = s?.name?.trim() || 'CompanyName';
      const logoSrc = s?.logo_url
        ? getBrandingPublicUrl(s.logo_url)
        : resolved.logoSrc;
      const loginImgSrc = s?.login_img_url
        ? getBrandingPublicUrl(s.login_img_url)
        : resolved.loginImgSrc;

      const nextResolved = {
        societyName,
        logoSrc: logoSrc ?? null,
        loginImgSrc: loginImgSrc ?? null,
      };
      setResolved(nextResolved);

      const payload: BrandingCache = {
        society: s,
        resolved: nextResolved,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch (error: unknown) {
      // no rompas UI; mantén cache
      if (error instanceof Error)
        console.error('[BrandingProvider] refresh error:', error.message);
      else console.error('[BrandingProvider] refresh error:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // 2) refresca una sola vez en background al iniciar la app
  useEffect(() => {
    void refresh({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: BrandingState = {
    society,
    loading,
    societyName: resolved.societyName,
    logoSrc: resolved.logoSrc,
    loginImgSrc: resolved.loginImgSrc,
    refresh,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider');
  return ctx;
}
