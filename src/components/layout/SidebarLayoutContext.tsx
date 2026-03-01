import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

const SidebarLayoutContext = createContext(false);

export function SidebarLayoutProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SidebarLayoutContext.Provider value={true}>
      {children}
    </SidebarLayoutContext.Provider>
  );
}

export function useHasPersistentSidebar() {
  return useContext(SidebarLayoutContext);
}
