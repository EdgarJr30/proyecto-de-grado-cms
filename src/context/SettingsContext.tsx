import { createContext, useContext, useEffect, useState } from 'react';
import {
  getMaxSecondaryAssignees,
  setMaxSecondaryAssignees,
} from '../services/settingsService';
import { useCan } from '../rbac/PermissionsContext';

type SettingsCtx = {
  maxSecondary: number;
  refresh: () => Promise<void>;
  update: (n: number) => Promise<void>;
  canManage: boolean;
};

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [maxSecondary, setMaxSecondary] = useState<number>(() => {
    const raw = localStorage.getItem('mlm:maxSecondary');
    return raw ? Number(raw) : 2;
  });
  const canManage = useCan('rbac:manage_permissions'); // o 'settings:manage'

  const refresh = async () => {
    const n = await getMaxSecondaryAssignees();
    setMaxSecondary(n);
    localStorage.setItem('mlm:maxSecondary', String(n));
  };

  const update = async (n: number) => {
    await setMaxSecondaryAssignees(n);
    await refresh();
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Ctx.Provider value={{ maxSecondary, refresh, update, canManage }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
