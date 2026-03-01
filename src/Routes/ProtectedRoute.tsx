// src/components/Routes/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppTopBar from '../components/layout/AppTopBar';
import Sidebar from '../components/layout/Sidebar';
import ScreenLoader from '../components/ui/ScreenLoader';
import { SidebarLayoutProvider } from '../components/layout/SidebarLayoutContext';

export default function ProtectedRoute({
  children,
}: {
  children?: React.ReactNode;
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

  const content = children ?? <Outlet />;

  return isAuthenticated ? (
    <SidebarLayoutProvider>
      <AppTopBar />
      <div className="app-shell-safe flex min-h-[100dvh]">
        <Sidebar persistent />
        <div className="min-w-0 flex-1">{content}</div>
      </div>
    </SidebarLayoutProvider>
  ) : (
    <Navigate to="/login" state={{ from: location_id }} replace />
  );
}
