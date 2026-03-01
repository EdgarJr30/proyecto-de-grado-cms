// src/components/Routes/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppTopBar from '../components/layout/AppTopBar';
import ScreenLoader from '../components/ui/ScreenLoader';

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, isAuthenticated } = useAuth();
  const location_id = useLocation();

  // 🔇 Importante: NO hay listener de visibilitychange aquí.

  if (loading) {
    return (
      <ScreenLoader
        fullScreen
        title="Validando sesion"
        hint="Comprobando autenticacion y permisos..."
      />
    );
  }

  return isAuthenticated ? (
    <>
      <AppTopBar />
      <div className="app-shell-safe">{children}</div>
    </>
  ) : (
    <Navigate to="/login" state={{ from: location_id }} replace />
  );
}
