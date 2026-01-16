import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { SpecialIncident } from '../types/SpecialIncident';
import {
  getAllSpecialIncidents,
  makeSpecialIncidentMap,
  makeSpecialIncidentCodeMap,
} from '../services/specialIncidentsService';
import { useAuth } from './AuthContext';

export type SpecialIncidentsState = {
  loading: boolean;
  error: string | null;

  // colecciones completas
  list: SpecialIncident[];
  byId: Record<number, SpecialIncident>;
  byCode: Record<string, SpecialIncident>;

  // solo activas (útil para combos)
  listActive: SpecialIncident[];
  byIdActive: Record<number, SpecialIncident>;
  byCodeActive: Record<string, SpecialIncident>;

  // acciones
  refresh: () => Promise<void>;
};

const SpecialIncidentsContext = createContext<
  SpecialIncidentsState | undefined
>(undefined);

export const SpecialIncidentsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<SpecialIncident[]>([]);
  const hydratedRef = useRef(false);

  const refresh = async () => {
    setError(null);
    const firstLoad = !hydratedRef.current;
    if (firstLoad) setLoading(true);

    try {
      if (!isAuthenticated) {
        setList([]);
        return;
      }
      const data = await getAllSpecialIncidents();
      setList(data);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Error cargando special incidents';
      setError(msg);
      console.error('[SpecialIncidentsContext] refresh error:', msg);
    } finally {
      if (!hydratedRef.current) hydratedRef.current = true;
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const value = useMemo<SpecialIncidentsState>(() => {
    const listActive = list.filter((s) => s.is_active);

    return {
      loading,
      error,

      list,
      byId: makeSpecialIncidentMap(list),
      byCode: makeSpecialIncidentCodeMap(list),

      listActive,
      byIdActive: makeSpecialIncidentMap(listActive),
      byCodeActive: makeSpecialIncidentCodeMap(listActive),

      refresh,
    };
  }, [loading, error, list]);

  return (
    <SpecialIncidentsContext.Provider value={value}>
      {children}
    </SpecialIncidentsContext.Provider>
  );
};

export function useSpecialIncidents() {
  const ctx = useContext(SpecialIncidentsContext);
  if (!ctx) {
    throw new Error(
      'useSpecialIncidents must be used within SpecialIncidentsProvider'
    );
  }
  return ctx;
}
