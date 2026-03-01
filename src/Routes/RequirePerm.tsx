// src/components/Routes/RequirePerm.tsx
import { Navigate } from 'react-router-dom';
import type { JSX } from 'react';
import { usePermissions } from '../rbac/PermissionsContext';
import ScreenLoader from '../components/ui/ScreenLoader';

export default function RequirePerm({
  allow,
  children,
}: {
  allow: string[];
  children: JSX.Element;
}) {
  const { ready, has } = usePermissions();

  if (!ready) {
    return (
      <ScreenLoader
        title="Cargando permisos"
        hint="Sincronizando accesos del usuario..."
      />
    );
  }

  const ok = has(allow); // any-of
  return ok ? children : <Navigate to="/403" replace />;
}
