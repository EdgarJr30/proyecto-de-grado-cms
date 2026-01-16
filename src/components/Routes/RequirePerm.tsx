// src/components/Routes/RequirePerm.tsx
import { Navigate } from 'react-router-dom';
import type { JSX } from 'react';
import { usePermissions } from '../../rbac/PermissionsContext';
import Spinner from '../ui/Spinner';

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
      <div className="min-h-[40vh] grid place-items-center">
        <Spinner />
      </div>
    );
  }

  const ok = has(allow); // any-of
  return ok ? children : <Navigate to="/403" replace />;
}
