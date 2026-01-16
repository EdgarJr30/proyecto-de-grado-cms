// src/components/Routes/RequireRole.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../rbac/PermissionsContext';
import type { RoleName } from '../../services/userService';
import type { JSX } from 'react';
import Spinner from '../ui/Spinner';

type RequireRoleProps = {
  allow: RoleName[];
  children: JSX.Element;
};

export default function RequireRole({ allow, children }: RequireRoleProps) {
  const { loading, isAuthenticated } = useAuth();
  const { ready, has } = usePermissions(); // 👈 usamos permisos, no role directo

  // 1) Mientras carga auth o permisos → spinner
  if (loading || !ready) {
    return (
      <div className="h-screen w-screen grid place-items-center">
        <Spinner />
      </div>
    );
  }

  // 2) Si no está autenticado → login
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // 3) ¿Tiene alguno de los roles permitidos?
  const allowed = allow.some((r) => has(r));
  return allowed ? children : <Navigate to="/403" replace />;
}
