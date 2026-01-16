import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Assignee, AssigneeSection } from '../types/Assignee';
import {
  getAllAssignees,
  groupBySection,
  makeAssigneeMap,
} from '../services/assigneeService';
import { useAuth } from './AuthContext';

export type AssigneeState = {
  loading: boolean;
  error: string | null;
  list: Assignee[]; // todos
  byId: Record<number, Assignee>; // todos
  bySection: Record<AssigneeSection, Assignee[]>; // todos
  bySectionActive: Record<AssigneeSection, Assignee[]>; // solo activos
  refresh: () => Promise<void>;
};

const AssigneeContext = createContext<AssigneeState | undefined>(undefined);

export const AssigneeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<Assignee[]>([]);
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
      const data = await getAllAssignees();
      setList(data);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Error cargando responsables';
      setError(msg);
      console.error('[AssigneeContext] refresh error:', msg);
    } finally {
      if (!hydratedRef.current) hydratedRef.current = true;
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const value = useMemo<AssigneeState>(() => {
    const activeList = list.filter((a) => a.is_active);
    return {
      loading,
      error,
      list,
      byId: makeAssigneeMap(list),
      bySection: groupBySection(list),
      bySectionActive: groupBySection(activeList),
      refresh,
    };
  }, [loading, error, list]);

  return (
    <AssigneeContext.Provider value={value}>
      {children}
    </AssigneeContext.Provider>
  );
};

export function useAssignees() {
  const ctx = useContext(AssigneeContext);
  if (!ctx)
    throw new Error('useAssignees must be used within AssigneeProvider');
  return ctx;
}
